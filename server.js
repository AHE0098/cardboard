// What changed / how to test:
// - Added optional per-role deck payload support on create/join so server-authoritative battle can load saved decks reliably.
// - Added server-side applyDeckToBattleState helper usage through applyDeckToPlayer for chosen seats.
// - Test: create/join room with deckCardsByRole payload; verify initial hand/deck reflect chosen deck and draws operate normally.
const express = require("express");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const {
  DEFAULT_BATTLE_DECK_P1,
  DEFAULT_BATTLE_DECK_P2
} = require("./battleDecks");

const PORT = process.env.PORT || 3000;
const PRIVATE_ZONES = ["hand", "deck", "graveyard"];
const BATTLEFIELD_ZONES = ["lands", "permanents"];
const SHARED_ZONES = ["stack"];
const rooms = new Map();
const socketPresence = new Map(); // socket.id -> { roomId, role }


function normalizeRoomId(raw) {
  const s = String(raw || "").trim().toUpperCase();
  // keep it simple & safe
  if (!/^[A-Z0-9]{4,10}$/.test(s)) return null;
  return s;
}

// "Open game" = room exists and at least one seat is available
function getOpenRoomsList() {
  return Array.from(rooms.values())
    .filter((r) => !r?.state?.players?.p1?.id || !r?.state?.players?.p2?.id)
    .map((r) => ({
      roomId: r.roomId,
      createdAt: r.createdAt || 0,
      p1: !!r.state?.players?.p1?.id,
      p2: !!r.state?.players?.p2?.id
    }))
    .sort((a, b) => (b.createdAt - a.createdAt));
}


function code() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function seedDeck(offset = 0) {
  const base = [200, 201, 202, 203, 204, 205, 210, 211, 212, 213, 220, 221, 222, 230, 231, 240, 241, 101, 102, 103, 104, 105];
  return base.map((_, i) => base[(i + offset) % base.length]);
}

function makePlayer(id = null, name = "") {
  const deck = seedDeck(name ? name.length % 7 : 0);
  const hand = [deck.shift(), deck.shift(), deck.shift()];
  return { id, name, zones: { hand, deck, graveyard: [], lands: [], permanents: [] } };
}

function sanitizeDeckCards(cards) {
  const arr = Array.isArray(cards) ? cards : [];
  return arr
    .map((id) => String(id || "").trim())
    .filter((id) => id.length > 0);
}

function sanitizeDeckCardsByRole(payload) {
  const src = payload && typeof payload === "object" ? payload : {};
  return {
    p1: sanitizeDeckCards(src.p1),
    p2: sanitizeDeckCards(src.p2)
  };
}

function applyDeckToPlayer(player, cards) {
  const deckCards = sanitizeDeckCards(cards);
  if (!deckCards.length) return ensurePlayerZones(player);
  const nextDeck = [...deckCards];
  const hand = [];
  for (let i = 0; i < 3 && nextDeck.length; i += 1) hand.push(nextDeck.shift());
  player.zones = {
    hand,
    deck: nextDeck,
    graveyard: [],
    lands: [],
    permanents: []
  };
  return ensurePlayerZones(player);
}

function ensurePlayerZones(player) {
  const zones = player.zones || {};
  zones.hand ||= [];
  zones.deck ||= [];
  zones.graveyard ||= [];
  zones.lands ||= [];
  zones.permanents ||= [];
  player.zones = zones;
  return player;
}

function clearSeat(room, role, waitingName) {
  const existing = ensurePlayerZones(room.state.players[role] || makePlayer(null, waitingName));
  room.state.players[role] = { ...existing, id: null, name: waitingName };
}

function makeRoom(creator, opts = {}) {
  const requested = normalizeRoomId(opts.requestedRoomId);
  const roomId = requested || code();

  if (rooms.has(roomId)) return null;

  const p1 = makePlayer(creator.playerId, creator.playerName);
  const p2 = makePlayer(null, "Waiting...");
  const requestedDecks = sanitizeDeckCardsByRole(opts.deckCardsByRole);
  applyDeckToPlayer(p1, requestedDecks.p1.length ? requestedDecks.p1 : DEFAULT_BATTLE_DECK_P1);
  applyDeckToPlayer(p2, requestedDecks.p2.length ? requestedDecks.p2 : DEFAULT_BATTLE_DECK_P2);

  const room = {
    roomId,
    createdAt: Date.now(),
    state: {
      sharedZones: { stack: [] },
      players: {
        p1,
        p2
      },
      tapped: {},
      tarped: {},
      version: 1
    }
  };

  rooms.set(roomId, room);
  return room;
}


function getRole(room, playerId) {
  if (room.state.players.p1.id === playerId) return "p1";
  if (room.state.players.p2.id === playerId) return "p2";
  return null;
}

function zoneIsShared(zone) {
  return SHARED_ZONES.includes(zone);
}

function zoneExists(zone) {
  return zoneIsShared(zone) || PRIVATE_ZONES.includes(zone) || BATTLEFIELD_ZONES.includes(zone);
}

function zoneArr(state, owner, zone) {
  if (!zoneExists(zone)) return null;
  if (zoneIsShared(zone)) {
    state.sharedZones[zone] ||= [];
    return state.sharedZones[zone];
  }
  state.players[owner].zones[zone] ||= [];
  return state.players[owner].zones[zone];
}


function sameCardId(a, b) {
  return String(a) === String(b);
}

function findCardIndex(arr, cardId) {
  if (!Array.isArray(arr)) return -1;
  return arr.findIndex((id) => sameCardId(id, cardId));
}

function validateZoneAccess(role, move) {
  const fromShared = zoneIsShared(move.from.zone);
  const toShared = zoneIsShared(move.to.zone);

  if (!zoneExists(move.from.zone) || !zoneExists(move.to.zone)) return "Illegal zone";

  const fromPrivate = PRIVATE_ZONES.includes(move.from.zone);
  const toPrivate = PRIVATE_ZONES.includes(move.to.zone);

  // Private zones remain owner-only.
  if (fromPrivate && move.from.owner !== role) return "Cannot move opponent card";
  if (toPrivate && move.to.owner !== role) return "Cannot move to opponent zone";

  // Keep cross-owner private moves blocked.
  if (fromPrivate && toPrivate && move.from.owner !== move.to.owner && !(fromShared || toShared)) {
    return "Cross-owner private move blocked";
  }

  // Battlefield/shared moves are intentionally free-for-all in 2P mode.
  return null;
}

function validateDeckPlace(role, payload) {
  const from = payload.from || {};
  const owner = payload.owner || role;
  if (owner !== role) return "Cannot place into opponent deck";
  if (!zoneExists(from.zone)) return "Illegal source zone";
  if (!from.zone || from.zone === "deck") return "Illegal source zone";
  if (from.owner !== role && !zoneIsShared(from.zone)) return "Cannot move opponent card";
  if (!["top", "bottom"].includes(payload.where)) return "Invalid deck placement";
  return null;
}

function applyIntent(room, role, intent) {
  const { type, payload = {} } = intent;
  const s = room.state;

  if (type === "DRAW_CARD") {
    const owner = payload.owner || role;
    if (owner !== role) return { ok: false, error: "Cannot draw from opponent deck" };
    const deck = s.players[owner].zones.deck;
    if (!deck.length) return { ok: false, error: "Deck empty" };
    s.players[owner].zones.hand.unshift(deck.shift());
  } else if (type === "TOGGLE_TAP") {
    const presentInAnyZone = ["p1", "p2"].some((pk) =>
      Object.values(s.players[pk].zones).some((arr) => findCardIndex(arr, payload.cardId) >= 0)
    ) || findCardIndex(s.sharedZones.stack, payload.cardId) >= 0;
    if (!presentInAnyZone) return { ok: false, error: "Card not found" };

    const map = payload.kind === "tarped" ? s.tarped : s.tapped;
    const key = String(payload.cardId);
    const next = !map[key] && !map[payload.cardId];
    map[key] = next;
    map[payload.cardId] = next;
  } else if (type === "MOVE_CARD") {
    const cardId = payload.cardId;
    const from = payload.from || {};
    const to = payload.to || {};
    const move = {
      from: { owner: from.owner || role, zone: from.zone },
      to: { owner: to.owner || role, zone: to.zone }
    };

    const invalid = validateZoneAccess(role, move);
    if (invalid) return { ok: false, error: invalid };

    const fromArr = zoneArr(s, move.from.owner, move.from.zone);
    const toArr = zoneArr(s, move.to.owner, move.to.zone);
    if (!fromArr || !toArr) return { ok: false, error: "Illegal zone" };

    const idx = findCardIndex(fromArr, cardId);
    if (idx < 0) return { ok: false, error: "Card not in source" };

    const [movedCardId] = fromArr.splice(idx, 1);
    toArr.push(movedCardId);
  } else if (type === "DECK_PLACE") {
    const invalid = validateDeckPlace(role, payload);
    if (invalid) return { ok: false, error: invalid };
    const cardId = payload.cardId;
    const from = { owner: payload.from?.owner || role, zone: payload.from?.zone };
    const fromArr = zoneArr(s, from.owner, from.zone);
    const deck = zoneArr(s, role, "deck");
    if (!fromArr || !deck) return { ok: false, error: "Illegal zone" };
    const idx = findCardIndex(fromArr, cardId);
    if (idx < 0) return { ok: false, error: "Card not in source" };
    const [movedCardId] = fromArr.splice(idx, 1);
    if (payload.where === "top") deck.unshift(movedCardId);
    else deck.push(movedCardId);
  } else if (type === "SET_DECK") {
    const owner = payload.owner || role;
    if (owner !== role) return { ok: false, error: "Cannot set opponent deck" };
    const cards = Array.isArray(payload.cards) ? payload.cards.map((id) => String(id)) : [];
    if (!cards.length) return { ok: false, error: "Deck list empty" };
    s.players[owner].zones.deck = cards;
  } else {
    return { ok: false, error: "Unknown intent" };
  }

  s.version += 1;
  return { ok: true };
}

function createServer() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: "*" } });

  app.use(express.static(path.join(__dirname, "public")));
  app.get("/health", (_, res) => res.send("ok"));

  const battle = io.of("/battle");
  battle.on("connection", (socket) => {
    const broadcastRoomsList = () => {
      battle.emit("rooms_list", { rooms: getOpenRoomsList() });
    };

    const detachFromRoomIfPresent = ({ releaseSeat = true } = {}) => {
      const pres = socketPresence.get(socket.id);
      if (!pres) return;

      const room = rooms.get(pres.roomId);
      if (room && releaseSeat && (pres.role === "p2" || pres.role === "p1")) {
        // free seat but preserve board state so reconnects/replacements remain stable
        const waitingName = pres.role === "p1" ? "Waiting for Player 1..." : "Waiting...";
        clearSeat(room, pres.role, waitingName);
        room.state.version += 1;
        battle.to(room.roomId).emit("room_state", { roomId: room.roomId, state: room.state });
      }

      socket.leave(pres.roomId);
      socketPresence.delete(socket.id);
      broadcastRoomsList();
    };

    // Push initial open rooms list on connect (nice UX)
    socket.emit("rooms_list", { rooms: getOpenRoomsList() });

    // Allow lobby to request refresh (optional ack)
    socket.on("rooms_list_request", (_, ack) => {
      const payload = { rooms: getOpenRoomsList() };
      socket.emit("rooms_list", payload);
      ack?.({ ok: true, ...payload });
    });

    // Create a room, optionally with a requested code (from the same input as join)
    socket.on("create_room", ({ playerId, playerName, roomId, deckCardsByRole }, ack) => {
      detachFromRoomIfPresent();

      const room = makeRoom({ playerId, playerName }, { requestedRoomId: roomId, deckCardsByRole });
      if (!room) return ack?.({ ok: false, error: "Room code already exists (or invalid)" });

      socket.join(room.roomId);
      socketPresence.set(socket.id, { roomId: room.roomId, role: "p1" });

      ack?.({ ok: true, roomId: room.roomId, role: "p1", state: room.state });
      broadcastRoomsList();
    });

    socket.on("join_room", ({ roomId, playerId, playerName, preferredRole, deckCardsByRole }, ack) => {
      detachFromRoomIfPresent();

      roomId = String(roomId || "").trim().toUpperCase();
      const room = rooms.get(roomId);
      if (!room) return ack?.({ ok: false, error: "Room not found" });

      let role = getRole(room, playerId);
      if (!role) {
        const preferred = preferredRole === "p1" || preferredRole === "p2" ? preferredRole : null;

        if (preferred) {
          if (room.state.players[preferred].id) {
            return ack?.({ ok: false, error: `Seat ${preferred.toUpperCase()} is already taken` });
          }
          room.state.players[preferred] = ensurePlayerZones({
            ...room.state.players[preferred],
            id: playerId,
            name: playerName || room.state.players[preferred].name
          });
          const defaultDeck = preferred === "p1" ? DEFAULT_BATTLE_DECK_P1 : DEFAULT_BATTLE_DECK_P2;
          applyDeckToPlayer(room.state.players[preferred], defaultDeck);
          role = preferred;
        } else if (!room.state.players.p2.id) {
          room.state.players.p2 = ensurePlayerZones({
            ...room.state.players.p2,
            id: playerId,
            name: playerName || room.state.players.p2.name
          });
          applyDeckToPlayer(room.state.players.p2, DEFAULT_BATTLE_DECK_P2);
          role = "p2";
        } else if (!room.state.players.p1.id) {
          room.state.players.p1 = ensurePlayerZones({
            ...room.state.players.p1,
            id: playerId,
            name: playerName || room.state.players.p1.name
          });
          applyDeckToPlayer(room.state.players.p1, DEFAULT_BATTLE_DECK_P1);
          role = "p1";
        } else {
          return ack?.({ ok: false, error: "Room full" });
        }
      }

      const requestedDecks = sanitizeDeckCardsByRole(deckCardsByRole);
      if (role === "p1" && requestedDecks.p1.length) applyDeckToPlayer(room.state.players.p1, requestedDecks.p1);
      if (role === "p2" && requestedDecks.p2.length) applyDeckToPlayer(room.state.players.p2, requestedDecks.p2);

      socket.join(roomId);
      socketPresence.set(socket.id, { roomId, role });

      battle.to(roomId).emit("room_state", { roomId, state: room.state });
      ack?.({ ok: true, roomId, role, state: room.state });

      broadcastRoomsList();
    });

    socket.on("leave_room", () => {
      detachFromRoomIfPresent();
    });

    socket.on("delete_room", ({ roomId }, ack) => {
      const normalized = String(roomId || "").trim().toUpperCase();
      if (!normalized || !rooms.has(normalized)) return ack?.({ ok: false, error: "Room not found" });
      rooms.delete(normalized);
      battle.to(normalized).emit("room_closed", { roomId: normalized });
      broadcastRoomsList();
      return ack?.({ ok: true });
    });

    socket.on("delete_all_rooms", (_, ack) => {
      const ids = Array.from(rooms.keys());
      ids.forEach((id) => {
        rooms.delete(id);
        battle.to(id).emit("room_closed", { roomId: id });
      });
      broadcastRoomsList();
      return ack?.({ ok: true, deleted: ids.length });
    });

    socket.on("disconnect", () => {
      detachFromRoomIfPresent({ releaseSeat: false });
    });

    socket.on("intent", (intent) => {
      const room = rooms.get(intent.roomId);
      if (!room) return;

      const role = getRole(room, intent.playerId);
      if (!role) {
        socket.emit("intent_rejected", { error: "Not in room", state: room.state });
        return;
      }

      if ((intent.baseVersion || 0) !== room.state.version) {
        socket.emit("intent_rejected", { error: "Version mismatch", state: room.state });
        socket.emit("room_state", { roomId: room.roomId, state: room.state, role });
        return;
      }

      const res = applyIntent(room, role, intent);
      if (!res.ok) {
        socket.emit("intent_rejected", { error: res.error, state: room.state });
        socket.emit("room_state", { roomId: room.roomId, state: room.state, role });
        return;
      }

      battle.to(room.roomId).emit("room_state", { roomId: room.roomId, state: room.state });
    });
  });

  return { app, server };
}


if (require.main === module) {
  const { server } = createServer();
  server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

module.exports = {
  createServer,
  applyIntent,
  makeRoom,
  rooms,
  validateZoneAccess,
  zoneExists,
  PRIVATE_ZONES,
  BATTLEFIELD_ZONES,
  SHARED_ZONES,
  validateDeckPlace,
  findCardIndex,
  sameCardId
};

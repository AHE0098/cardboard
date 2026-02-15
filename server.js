const express = require("express");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");

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

function makeRoom(creator, opts = {}) {
  const requested = normalizeRoomId(opts.requestedRoomId);
  const roomId = requested || code();

  if (rooms.has(roomId)) return null;

  const room = {
    roomId,
    createdAt: Date.now(),
    state: {
      sharedZones: { stack: [] },
      players: {
        p1: makePlayer(creator.playerId, creator.playerName),
        p2: makePlayer(null, "Waiting...")
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

function validateZoneAccess(role, move) {
  const fromShared = zoneIsShared(move.from.zone);
  const toShared = zoneIsShared(move.to.zone);

  if (!zoneExists(move.from.zone) || !zoneExists(move.to.zone)) return "Illegal zone";

  if (!fromShared && move.from.owner !== role) return "Cannot move opponent card";
  if (!toShared && move.to.owner !== role) return "Cannot move to opponent zone";

  const fromPrivate = PRIVATE_ZONES.includes(move.from.zone);
  const toPrivate = PRIVATE_ZONES.includes(move.to.zone);
  if ((fromPrivate || toPrivate) && move.from.owner !== move.to.owner && !(fromShared || toShared)) {
    return "Cross-owner private move blocked";
  }

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
    const targetZone = Object.keys(s.players[role].zones).find((zone) => s.players[role].zones[zone].includes(payload.cardId));
    const sharedHasCard = s.sharedZones.stack.includes(payload.cardId);
    if (!targetZone && !sharedHasCard) return { ok: false, error: "Cannot toggle unowned card" };
    const map = payload.kind === "tarped" ? s.tarped : s.tapped;
    map[payload.cardId] = !map[payload.cardId];
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

    const idx = fromArr.indexOf(cardId);
    if (idx < 0) return { ok: false, error: "Card not in source" };

    fromArr.splice(idx, 1);
    toArr.push(cardId);
  } else if (type === "DECK_PLACE") {
    const invalid = validateDeckPlace(role, payload);
    if (invalid) return { ok: false, error: invalid };
    const cardId = payload.cardId;
    const from = { owner: payload.from?.owner || role, zone: payload.from?.zone };
    const fromArr = zoneArr(s, from.owner, from.zone);
    const deck = zoneArr(s, role, "deck");
    if (!fromArr || !deck) return { ok: false, error: "Illegal zone" };
    const idx = fromArr.indexOf(cardId);
    if (idx < 0) return { ok: false, error: "Card not in source" };
    fromArr.splice(idx, 1);
    if (payload.where === "top") deck.unshift(cardId);
    else deck.push(cardId);
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

    const detachFromRoomIfPresent = () => {
      const pres = socketPresence.get(socket.id);
      if (!pres) return;

      const room = rooms.get(pres.roomId);
      if (room) {
        if (pres.role === "p2" || pres.role === "p1") {
          // free seat, keep room open until explicitly deleted
          const waitingName = pres.role === "p1" ? "Waiting for Player 1..." : "Waiting...";
          room.state.players[pres.role] = makePlayer(null, waitingName);
          room.state.version += 1;
          battle.to(room.roomId).emit("room_state", { roomId: room.roomId, state: room.state });
        }
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
    socket.on("create_room", ({ playerId, playerName, roomId }, ack) => {
      detachFromRoomIfPresent();

      const room = makeRoom({ playerId, playerName }, { requestedRoomId: roomId });
      if (!room) return ack?.({ ok: false, error: "Room code already exists (or invalid)" });

      socket.join(room.roomId);
      socketPresence.set(socket.id, { roomId: room.roomId, role: "p1" });

      ack?.({ ok: true, roomId: room.roomId, role: "p1", state: room.state });
      broadcastRoomsList();
    });

    socket.on("join_room", ({ roomId, playerId, playerName, preferredRole }, ack) => {
      detachFromRoomIfPresent();

      roomId = String(roomId || "").trim().toUpperCase();
      const room = rooms.get(roomId);
      if (!room) return ack?.({ ok: false, error: "Room not found" });

      let role = getRole(room, playerId);
      if (!role) {
        const preferred = preferredRole === "p1" || preferredRole === "p2" ? preferredRole : null;
        if (preferred && !room.state.players[preferred].id) {
          room.state.players[preferred] = makePlayer(playerId, playerName);
          role = preferred;
        } else if (!room.state.players.p2.id) {
          room.state.players.p2 = makePlayer(playerId, playerName);
          role = "p2";
        } else if (!room.state.players.p1.id) {
          room.state.players.p1 = makePlayer(playerId, playerName);
          role = "p1";
        } else {
          return ack?.({ ok: false, error: "Room full" });
        }
      }

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
      detachFromRoomIfPresent();
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
  validateDeckPlace
};

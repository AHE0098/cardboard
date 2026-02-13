const express = require("express");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");

const PORT = process.env.PORT || 3000;
const PRIVATE_ZONES = ["hand", "deck", "graveyard"];
const BATTLEFIELD_ZONES = ["lands", "permanents"];
const SHARED_ZONES = ["stack"];
const rooms = new Map();

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

function makeRoom(creator) {
  const roomId = code();
  const room = {
    roomId,
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
  if (move.to.zone === "deck") return "Cannot move to deck";

  if (!fromShared && move.from.owner !== role) return "Cannot move opponent card";
  if (!toShared && move.to.owner !== role) return "Cannot move to opponent zone";

  const fromPrivate = PRIVATE_ZONES.includes(move.from.zone);
  const toPrivate = PRIVATE_ZONES.includes(move.to.zone);
  if ((fromPrivate || toPrivate) && move.from.owner !== move.to.owner && !(fromShared || toShared)) {
    return "Cross-owner private move blocked";
  }

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
    socket.on("create_room", ({ playerId, playerName }, ack) => {
      const room = makeRoom({ playerId, playerName });
      socket.join(room.roomId);
      ack?.({ ok: true, roomId: room.roomId, role: "p1", state: room.state });
    });

    socket.on("join_room", ({ roomId, playerId, playerName }, ack) => {
      const room = rooms.get(roomId);
      if (!room) return ack?.({ ok: false, error: "Room not found" });

      let role = getRole(room, playerId);
      if (!role) {
        if (!room.state.players.p2.id) {
          room.state.players.p2 = makePlayer(playerId, playerName);
          role = "p2";
        } else {
          return ack?.({ ok: false, error: "Room full" });
        }
      }

      socket.join(roomId);
      battle.to(roomId).emit("room_state", { roomId, state: room.state });
      ack?.({ ok: true, roomId, role, state: room.state });
    });

    socket.on("leave_room", ({ roomId }) => socket.leave(roomId));

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
  SHARED_ZONES
};

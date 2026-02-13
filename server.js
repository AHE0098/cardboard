const express = require("express");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || 3000;

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
  return { id, name, zones: { hand, deck, graveyard: [] } };
}

function makeRoom(creator) {
  const roomId = code();
  const room = {
    roomId,
    state: {
      sharedZones: { lands: [], permanents: [], stack: [] },
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
  return ["lands", "permanents", "stack"].includes(zone);
}

function zoneArr(state, role, zone) {
  if (zoneIsShared(zone)) return state.sharedZones[zone];
  return state.players[role].zones[zone];
}

function applyIntent(room, role, intent) {
  const { type, payload } = intent;
  const s = room.state;

  if (type === "DRAW_CARD") {
    const deck = s.players[role].zones.deck;
    if (!deck.length) return { ok: false, error: "Deck empty" };
    s.players[role].zones.hand.unshift(deck.shift());
  } else if (type === "TOGGLE_TAP") {
    const map = payload.kind === "tarped" ? s.tarped : s.tapped;
    map[payload.cardId] = !map[payload.cardId];
  } else if (type === "MOVE_CARD") {
    const { cardId, from, to } = payload;
    const fromShared = zoneIsShared(from.zone);
    const toShared = zoneIsShared(to.zone);
    if (!fromShared && from.zone !== "hand" && from.zone !== "graveyard") return { ok: false, error: "Illegal from zone" };
    if (!toShared && to.zone !== "hand" && to.zone !== "graveyard") return { ok: false, error: "Illegal to zone" };

    if (!fromShared && from.zone !== "hand" && from.zone !== "graveyard") return { ok: false, error: "Not allowed" };

    const fromArr = zoneArr(s, role, from.zone);
    const idx = fromArr.indexOf(cardId);
    if (idx < 0) return { ok: false, error: "Card not in source" };
    fromArr.splice(idx, 1);
    zoneArr(s, role, to.zone).push(cardId);
  } else {
    return { ok: false, error: "Unknown intent" };
  }

  s.version += 1;
  return { ok: true };
}

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

app.get("/health", (_, res) => res.send("ok"));

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});

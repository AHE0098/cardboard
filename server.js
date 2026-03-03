// What changed / how to test:
// - Added optional per-role deck payload support on create/join so server-authoritative battle can load saved decks reliably.
// - Added server-side applyDeckToBattleState helper usage through applyDeckToPlayer for chosen seats.
// - Test: create/join room with deckCardsByRole payload; verify initial hand/deck reflect chosen deck and draws operate normally.
const express = require("express");
const path = require("path");
const fs = require("fs");
const http = require("http");
const crypto = require("crypto");
const { Server } = require("socket.io");
const {
  DEFAULT_BATTLE_DECK_P1,
  DEFAULT_BATTLE_DECK_P2
} = require("./battleDecks");

const {
  loadSharedDefinitions
} = require("./shared/loadSharedDefinitions");

const {
  buildStarterDeck,
  buildDeckFromList,
  simulateGame,
  simulateMany
} = require("./sim/engine");
const { createSeededRng, randomInt } = require("./shared/rng");

const PORT = process.env.PORT || 3000;
const PRIVATE_ZONES = ["hand", "deck", "graveyard"];
const BATTLEFIELD_ZONES = ["lands", "permanents"];
const SHARED_ZONES = ["stack"];
const rooms = new Map();
const socketPresence = new Map(); // socket.id -> { roomId, role }


const PREFER_SHARED_DEFINITIONS = process.env.PREFER_SHARED_DEFINITIONS === "1";


let roomCodeCounter = 0;

function getSimulationRulesStamp() {
  const rulesPath = path.join(__dirname, "rules", "SIMULATION_RULES.md");
  const text = fs.readFileSync(rulesPath, "utf8");
  const stat = fs.statSync(rulesPath);
  const hash = crypto.createHash("sha256").update(text).digest("hex").slice(0, 16);
  return {
    path: "rules/SIMULATION_RULES.md",
    mtimeMs: stat.mtimeMs,
    hash,
    text
  };
}

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

  if (typeof crypto.randomInt === "function") {
    for (let i = 0; i < 6; i += 1) out += chars[crypto.randomInt(chars.length)];
    return out;
  }

  roomCodeCounter += 1;
  const entropy = typeof process.hrtime?.bigint === "function" ? String(process.hrtime.bigint()) : String(roomCodeCounter);
  const rng = createSeededRng(`${Date.now()}|room-code|${entropy}|${roomCodeCounter}`);
  for (let i = 0; i < 6; i += 1) out += chars[randomInt(rng, chars.length)];
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
    .map((id) => (id == null ? "" : String(id).trim()))
    .filter((id) => id.length > 0);
}

function sanitizeDeckCardsByRole(payload) {
  const src = payload && typeof payload === "object" ? payload : {};
  return {
    p1: sanitizeDeckCards(src.p1),
    p2: sanitizeDeckCards(src.p2)
  };
}

function shuffleInPlace(arr) {
  const fallbackRng = createSeededRng(`${Date.now()}|shuffle|${arr.length}`);
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = typeof crypto.randomInt === "function"
      ? crypto.randomInt(i + 1)
      : randomInt(fallbackRng, i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function summarizeRoomState(state) {
  return {
    version: state?.version,
    p1: Object.fromEntries(Object.entries(state?.players?.p1?.zones || {}).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0])),
    p2: Object.fromEntries(Object.entries(state?.players?.p2?.zones || {}).map(([k, v]) => [k, Array.isArray(v) ? v.length : 0])),
    stack: Array.isArray(state?.sharedZones?.stack) ? state.sharedZones.stack.length : 0
  };
}

function assertIntentInvariants(room, role, intent) {
  const state = room.state;
  if (!Number.isInteger(state?.version) || state.version < 1) {
    throw new Error(`[invariant] invalid version; role=${role}; intent=${intent?.type}; summary=${JSON.stringify(summarizeRoomState(state))}`);
  }
  for (const owner of ["p1", "p2"]) {
    const zones = state.players?.[owner]?.zones || {};
    for (const zoneName of ["hand", "deck", "graveyard", "lands", "permanents"]) {
      const zone = zones[zoneName] || [];
      if (!Array.isArray(zone)) {
        throw new Error(`[invariant] zone not array (${owner}.${zoneName}); role=${role}; intent=${intent?.type}; summary=${JSON.stringify(summarizeRoomState(state))}`);
      }
    }
  }
}

function applyDeckToPlayer(player, cards) {
  const deckCards = sanitizeDeckCards(cards);
  if (!deckCards.length) return ensurePlayerZones(player);
  const nextDeck = shuffleInPlace([...deckCards]);
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
    const cards = sanitizeDeckCards(payload.cards);
    if (!cards.length) return { ok: false, error: "Deck list empty" };
    s.players[owner].zones.deck = shuffleInPlace(cards);
  } else {
    return { ok: false, error: "Unknown intent" };
  }

  s.version += 1;
  assertIntentInvariants(room, role, intent);
  return { ok: true };
}

function createServer() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, { cors: { origin: "*" } });

  app.use(express.static(path.join(__dirname, "public")));
  app.get("/health", (_, res) => res.send("ok"));
  app.get("/api/shared/definitions", (_, res) => {
    const loaded = loadSharedDefinitions({ rootDir: path.join(__dirname, "shared") });
    if (!loaded.found) return res.status(404).json({ ok: false, error: "shared definitions not found" });
    if (loaded.error) return res.status(500).json({ ok: false, error: loaded.error.message });
    return res.json({ ok: true, preferSharedDefinitions: PREFER_SHARED_DEFINITIONS, data: loaded.data });
  });
  app.get("/api/sim/rules", (_, res) => {
    try {
      const stamp = getSimulationRulesStamp();
      return res.json({ ok: true, rules: stamp });
    } catch (error) {
      return res.status(500).json({ ok: false, error: error.message || "rules_unavailable" });
    }
  });


  function parsePositiveInt(raw, fallback, { min = 1, max = Number.MAX_SAFE_INTEGER } = {}) {
    const n = Number(raw);
    if (!Number.isFinite(n)) return fallback;
    const i = Math.floor(n);
    if (i < min || i > max) return fallback;
    return i;
  }

  function buildSimDecks(mode) {
    if (mode === "lands-only") {
      return {
        deckA: buildDeckFromList([{ type: "land", name: "Basic Land", qty: 40 }], "RA"),
        deckB: buildDeckFromList([{ type: "land", name: "Basic Land", qty: 40 }], "RB")
      };
    }

    if (mode === "low-land") {
      return {
        deckA: buildDeckFromList([
          { type: "land", name: "Basic Land", qty: 8 },
          { type: "creature", name: "Greedy 4/4", cost: 4, power: 4, toughness: 4, qty: 16 },
          { type: "creature", name: "Huge 6/6", cost: 6, power: 6, toughness: 6, qty: 16 }
        ], "RLA"),
        deckB: buildDeckFromList([
          { type: "land", name: "Basic Land", qty: 8 },
          { type: "creature", name: "Greedy 4/4", cost: 4, power: 4, toughness: 4, qty: 16 },
          { type: "creature", name: "Huge 6/6", cost: 6, power: 6, toughness: 6, qty: 16 }
        ], "RLB")
      };
    }

    return {
      deckA: buildStarterDeck("RA"),
      deckB: buildStarterDeck("RB")
    };
  }

  function applyLaneCertainty(aiConfig, certaintyKey, certaintyPct) {
    const next = { ...(aiConfig || {}), certainty: { ...(aiConfig?.certainty || {}) } };
    if (certaintyKey === "attack" || certaintyKey === "both") next.certainty.attack = certaintyPct;
    if (certaintyKey === "defend" || certaintyKey === "both") next.certainty.defend = certaintyPct;
    return next;
  }

  const SWEEP_FEATURE_DEFS = {
    summoningSickness: { scope: "rules", label: "Summoning Sickness" },
    noBlockAfterAttacking: { scope: "rules", label: "No block after attacking" },
    smartBlocking: { scope: "ai", label: "Smart Blocking" },
    smartAttacking: { scope: "ai", label: "Smart Attacking" }
  };

  function applyStrategyTogglesToConfig(baseConfig, toggles) {
    const nextConfig = {
      ...baseConfig,
      rules: { ...(baseConfig?.rules || {}) },
      ai: { ...(baseConfig?.ai || {}) }
    };
    Object.entries(toggles || {}).forEach(([key, value]) => {
      const featureDef = SWEEP_FEATURE_DEFS[key];
      if (!featureDef) return;
      if (featureDef.scope === "rules") nextConfig.rules[key] = !!value;
      if (featureDef.scope === "ai") nextConfig.ai[key] = !!value;
    });
    return nextConfig;
  }



  function hashStringToUInt32(value) {
    const str = String(value || "");
    let hash = 2166136261;
    for (let i = 0; i < str.length; i += 1) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function parseSweepStrategiesParam(rawValue) {
    if (!rawValue) return null;
    const normalized = String(rawValue).trim();
    if (!normalized) return null;
    const candidates = [normalized];
    try { candidates.push(decodeURIComponent(normalized)); } catch {}
    for (const candidate of candidates) {
      try {
        const parsed = JSON.parse(candidate);
        if (Array.isArray(parsed)) return parsed;
      } catch {}
    }
    throw new Error("Invalid sweepStrategies payload");
  }

  function normalizeSweepStrategiesInput(strategies) {
    const seen = new Set();
    const normalized = [];
    (Array.isArray(strategies) ? strategies : []).forEach((strategy, idx) => {
      const id = String(strategy?.id || "").trim();
      if (!id || seen.has(id)) return;
      seen.add(id);
      const name = String(strategy?.name || `Strategy ${idx + 1}`).trim() || `Strategy ${idx + 1}`;
      const enabled = strategy?.enabled !== false;
      const toggles = {};
      Object.entries(strategy?.toggles || {}).forEach(([key, value]) => {
        if (!SWEEP_FEATURE_DEFS[key]) return;
        if (value) toggles[key] = true;
      });
      normalized.push({ id, name, enabled, toggles });
    });
    return normalized;
  }

  function buildLaneSummary({ lane, batch }) {
    const winsA = Number(batch?.summary?.winsA || 0);
    const winsB = Number(batch?.summary?.winsB || 0);
    const games = Number(batch?.summary?.games || 0);
    return {
      strategyId: lane.strategyId,
      strategyName: lane.strategyName,
      strategyIndex: lane.strategyIndex,
      strategyToggles: lane.strategyToggles,
      toggleKey: lane.toggleKey,
      toggleValue: lane.toggleValue,
      certaintyPct: lane.certaintyPct,
      seed: lane.seed,
      games,
      deckA_wins: winsA,
      deckA_losses: winsB,
      deckA_winRate: games > 0 ? Number((winsA / games).toFixed(6)) : 0
    };
  }

  function runSimulationSweep({ sweep, config, deckA, deckB }) {
    const certaintySteps = Array.isArray(sweep.certaintySteps) && sweep.certaintySteps.length
      ? sweep.certaintySteps
      : [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const strategies = Array.isArray(sweep.strategies) && sweep.strategies.length
      ? sweep.strategies
      : [
          {
            name: `${sweep.toggleKey} OFF`,
            toggles: { [sweep.toggleKey]: false },
            legacyToggleValue: false
          },
          {
            name: `${sweep.toggleKey} ON`,
            toggles: { [sweep.toggleKey]: true },
            legacyToggleValue: true
          }
        ];
    const sweepRows = [];

    strategies.forEach((strategy, strategyIdx) => {
      certaintySteps.forEach((certaintyPct) => {
        const strategySeedComponent = hashStringToUInt32(strategy.id || strategy.name || strategyIdx) % 1000000;
        const laneSeed = (Number(sweep.baseSeed || 0) + Number(certaintyPct || 0) + (strategySeedComponent * 1000)) >>> 0;
        const laneConfigWithStrategy = applyStrategyTogglesToConfig(config, strategy.toggles || {});
        const laneAi = applyLaneCertainty({ ...(laneConfigWithStrategy.ai || {}) }, sweep.certaintyKey, certaintyPct);
        const laneConfig = { ...laneConfigWithStrategy, ai: laneAi };
        const batch = simulateMany({ iterations: sweep.iterationsPerLane, seedBase: laneSeed, deckA, deckB, config: laneConfig });
        const lane = {
          strategyId: String(strategy.id || `strategy-${strategyIdx + 1}`),
          strategyName: String(strategy.name || `Strategy ${strategyIdx + 1}`),
          strategyIndex: strategyIdx,
          strategyToggles: strategy.toggles || {},
          toggleKey: sweep.toggleKey,
          toggleValue: strategy.legacyToggleValue,
          certaintyPct,
          seed: laneSeed
        };
        const laneSummary = buildLaneSummary({ lane, batch });
        if (sweep.debugSweep) {
          console.info("[sim.sweep] lane", {
            toggleKey: lane.toggleKey,
            toggleValue: lane.toggleValue,
            strategyId: lane.strategyId,
            strategyName: lane.strategyName,
            strategyIndex: lane.strategyIndex,
            certaintyPct: lane.certaintyPct,
            seed: lane.seed,
            games: laneSummary.games,
            deckA_wins: laneSummary.deckA_wins,
            deckA_losses: laneSummary.deckA_losses
          });
        }
        sweepRows.push(laneSummary);
      });
    });

    return { sweepRows };
  }

  function runSingleSimulation({ iterations, seed, config, deckA, deckB }) {
    const sampleGame = simulateGame({ seed, deckA, deckB, config: { ...config, logMode: "full" } });
    const batch = simulateMany({ iterations, seedBase: seed, deckA, deckB, config });
    const runsMeta = Array.isArray(batch.games)
      ? batch.games.map((g, idx) => ({
          index: idx,
          seed: g.seed,
          winner: g.winner,
          turns: g.turns,
          endedReason: g.endedReason
        }))
      : [];
    return { sampleGame, batch, runsMeta };
  }

  app.get("/api/sim/run", (req, res) => {
    try {
      const iterations = parsePositiveInt(req.query.iterations, 100, { min: 1, max: 10000 });
      const seed = parsePositiveInt(req.query.seed, 1337, { min: 0, max: 0xffffffff });
      const maxTurns = parsePositiveInt(req.query.maxTurns, 200, { min: 1, max: 10000 });
      const startingLife = parsePositiveInt(req.query.startingLife, 20, { min: 1, max: 1000 });
      const deckModeRaw = String(req.query.deckMode || "starter").trim();
      const deckMode = ["starter", "lands-only", "low-land"].includes(deckModeRaw) ? deckModeRaw : "starter";
      const logModeRaw = String(req.query.log || "summary").trim();
      const logMode = ["none", "summary", "full"].includes(logModeRaw) ? logModeRaw : "summary";
      const includeSampleLog = String(req.query.includeSampleLog || "0") === "1";
      const summoningSickness = String(req.query.summoningSickness || "0") === "1";
      const noBlockAfterAttacking = String(req.query.noBlockAfterAttacking || "0") === "1";
      const smartBlocking = String(req.query.smartBlocking || "0") === "1";
      const smartAttacking = String(req.query.smartAttacking || "0") === "1";
      const aiDebugDecisions = String(req.query.aiDebugDecisions || "0") === "1";
      const attackCertainty = parsePositiveInt(req.query.attackCertainty, 100, { min: 0, max: 100 });
      const defendCertainty = parsePositiveInt(req.query.defendCertainty, 100, { min: 0, max: 100 });

      const sweepEnabled = String(req.query.sweepEnabled || "0") === "1";
      const sweepToggleKeyRaw = String(req.query.sweepToggleKey || "smartBlocking").trim();
      const sweepToggleKey = ["smartBlocking", "smartAttacking"].includes(sweepToggleKeyRaw) ? sweepToggleKeyRaw : "smartBlocking";
      const sweepCertaintyKeyRaw = String(req.query.sweepCertaintyKey || "both").trim();
      const sweepCertaintyKey = ["attack", "defend", "both"].includes(sweepCertaintyKeyRaw) ? sweepCertaintyKeyRaw : "both";
      const sweepIterationsPerLane = parsePositiveInt(req.query.sweepIterationsPerLane, iterations, { min: 1, max: 10000 });
      const sweepConcurrency = parsePositiveInt(req.query.sweepConcurrency, 2, { min: 1, max: 4 });
      const sweepToggleValuesRaw = String(req.query.sweepToggleValues || "0,1").trim();
      const sweepToggleValues = sweepToggleValuesRaw
        .split(",")
        .map((x) => String(x).trim())
        .filter((x) => x === "0" || x === "1")
        .map((x) => x === "1");
      const sweepFeatureKeysRaw = String(req.query.sweepFeatureKeys || "").trim();
      const sweepFeatureKeys = sweepFeatureKeysRaw
        .split(",")
        .map((x) => String(x).trim())
        .filter((x) => !!SWEEP_FEATURE_DEFS[x]);
      const sweepIncludeCombined = String(req.query.sweepIncludeCombined || "0") === "1";
      const parsedSweepStrategies = parseSweepStrategiesParam(req.query.sweepStrategies);
      const debugSweep = String(req.query.simDebugSweep || "0") === "1";

      const { deckA, deckB } = buildSimDecks(deckMode);
      const config = {
        startingLife,
        maxTurns,
        logMode,
        devAssertions: true,
        rules: {
          summoningSickness,
          noBlockAfterAttacking
        },
        ai: {
          smartBlocking,
          smartAttacking,
          debugDecisions: aiDebugDecisions,
          certainty: {
            attack: attackCertainty,
            defend: defendCertainty
          }
        }
      };

      const { sampleGame, batch, runsMeta } = runSingleSimulation({ iterations, seed, config, deckA, deckB });
      const ruleStamp = getSimulationRulesStamp();

      const strategyLabel = (featureKey) => SWEEP_FEATURE_DEFS[featureKey]?.label || featureKey;
      const strategyLabelCombined = (keys) => {
        if (keys.length <= 1) return strategyLabel(keys[0] || "Combined");
        const short = keys.map((k) => strategyLabel(k).split(" ").map((word) => word[0]).join(""));
        return `Combined ${short.join(" + ")}`;
      };

      const legacySweepStrategies = sweepFeatureKeys.map((featureKey, idx) => ({
        id: `legacy-${featureKey}-${idx + 1}`,
        name: strategyLabel(featureKey),
        enabled: true,
        toggles: { [featureKey]: true }
      }));
      if (sweepIncludeCombined && sweepFeatureKeys.length > 1) {
        legacySweepStrategies.push({
          id: `legacy-combined-${sweepFeatureKeys.join("-")}`,
          name: strategyLabelCombined(sweepFeatureKeys),
          enabled: true,
          toggles: sweepFeatureKeys.reduce((acc, key) => {
            acc[key] = true;
            return acc;
          }, {})
        });
      }

      const normalizedSweepStrategies = normalizeSweepStrategiesInput(
        Array.isArray(parsedSweepStrategies) ? parsedSweepStrategies : legacySweepStrategies
      )
        .filter((strategy) => strategy.enabled)
        .slice(0, 12);

      if (Array.isArray(parsedSweepStrategies) && parsedSweepStrategies.length > 12) {
        throw new Error("Too many sweep strategies (max 12)");
      }
      if (sweepEnabled && !normalizedSweepStrategies.length) {
        throw new Error("At least one enabled sweep strategy is required");
      }
      if (debugSweep) {
        console.info("[sim.sweep] parsed strategies", {
          count: normalizedSweepStrategies.length,
          strategies: normalizedSweepStrategies
        });
      }

      const sweep = sweepEnabled
        ? {
            enabled: true,
            toggleKey: sweepToggleKey,
            toggleValues: sweepToggleValues.length ? sweepToggleValues : [false, true],
            strategies: normalizedSweepStrategies,
            certaintyKey: sweepCertaintyKey,
            certaintySteps: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
            iterationsPerLane: sweepIterationsPerLane,
            baseSeed: seed,
            concurrency: sweepConcurrency,
            debugSweep
          }
        : null;

      const sweepResult = sweep ? runSimulationSweep({ sweep, config, deckA, deckB }) : null;
      if (debugSweep) {
        console.info("[sim.sweep] lane-count", {
          strategies: normalizedSweepStrategies.length,
          certaintySteps: sweep?.certaintySteps?.length || 0,
          lanes: sweepResult?.sweepRows?.length || 0
        });
      }

      return res.json({
        ok: true,
        config: {
          iterations,
          seed,
          maxTurns,
          startingLife,
          deckMode,
          logMode,
          rules: {
            summoningSickness,
            noBlockAfterAttacking
          },
          ai: {
            smartBlocking,
            smartAttacking,
            debugDecisions: aiDebugDecisions,
            certainty: {
              attack: attackCertainty,
              defend: defendCertainty
            }
          },
          sweep
        },
        sampleGame: {
          seed: sampleGame.seed,
          winner: sampleGame.winner,
          turns: sampleGame.turns,
          endedReason: sampleGame.endedReason,
          finalLife: sampleGame.finalLife,
          turnSummaries: sampleGame.turnSummaries || {},
          warnings: sampleGame.warnings || [],
          logLength: sampleGame.log.length,
          log: includeSampleLog ? sampleGame.log : undefined
        },
        summary: batch.summary,
        runsMeta,
        sweepSummary: sweepResult ? { lanes: sweepResult.sweepRows } : null,
        ruleStamp: { path: ruleStamp.path, mtimeMs: ruleStamp.mtimeMs, hash: ruleStamp.hash }
      });
    } catch (error) {
      return res.status(400).json({ ok: false, error: error.message || "simulation_failed" });
    }
  });

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
  sameCardId,
  shuffleInPlace
};

/*
Screen + data architecture:
- uiScreen: playerMenu -> mainMenu -> mode
- appMode: sandbox | battle | deckbuilder
- localStorage keys:
  - cb_players: { players:[{id,name,createdAt,lastSeenAt}], lastPlayerId }
  - cb_save_<playerId>: { lastMode, sandboxState, lastBattleRoomId, updatedAt }
- Battle networking uses Socket.IO with a server-authoritative room state and client intents.
*/

(() => {
  const boot = () => {
    const root = document.getElementById("root");
    const subtitle = document.getElementById("subtitle");
    if (!root || !subtitle) throw new Error("Missing required DOM roots");

    const PLAYER_KEY = "cb_players";
    const SAVE_PREFIX = "cb_save_";
    const ALL_ZONES = ["permanents", "lands", "hand", "stack", "deck", "graveyard", "opponentPermanents", "opponentLands"];
    const BATTLEFIELD_ZONES = ["lands", "permanents", "opponentPermanents", "opponentLands"];
    const SHARED_ZONES = ["stack"];
    const PRIVATE_ZONES = ["hand", "deck", "graveyard"];
    const PILE_ZONES = ["stack", "deck", "graveyard"];
    const demo = window.DEMO_STATE || { zones: { hand: [], lands: [], permanents: [] }, tapped: {}, tarped: {} };

    let uiScreen = "playerMenu";
    let appMode = null;
    let dragging = null;
    let inspectorDragging = null;
    let inspector = null;
    let battleViewRole = "p1";
    let deckPlacementChoice = null;
    let legacySandboxHandle = null;
    let legacyBattleHandle = null;
    let battleLobbyRoomsRequested = false;
    const DEBUG_BATTLE = true;

    let session = { playerId: null, playerName: null, role: null };
    let playerRegistry = loadPlayerRegistry();
    let saveTimer = null;

    let sandboxState = createSandboxState();

    let battleState = null;
    let battleRoomId = "";
    let openRooms = [];
    let battleClient = window.CardboardMeta?.createBattleClient({
      getSession: () => session,
      getBattleState: () => battleState,
      getBattleRoomId: () => battleRoomId,
      getBattleViewRole: () => battleViewRole,
      setBattleSession: ({ roomId, role, state, viewRole }) => {
        try {
          if (DEBUG_BATTLE) {
            console.info("[battle] setBattleSession:start", {
              roomId,
              role,
              viewRole,
              hasState: !!state,
              version: state?.version,
              p1: state?.players?.p1?.id || null,
              p2: state?.players?.p2?.id || null
            });
          }

          battleRoomId = roomId;

          if (state && typeof state === "object") {
            if (battleState && typeof battleState === "object") {
              Object.keys(battleState).forEach((k) => { delete battleState[k]; });
              Object.assign(battleState, state);
            } else {
              battleState = state;
            }
            ensureBattleStateShape(battleState);
            battleLobbyRoomsRequested = false;
          } else {
            battleState = null;
          }

          session.role = role;
          battleViewRole = viewRole || battleViewRole || role || "p1";

          if (DEBUG_BATTLE) {
            console.info("[battle] setBattleSession:done", {
              battleRoomId,
              hasBattleState: !!battleState,
              version: battleState?.version,
              sessionRole: session.role,
              battleViewRole
            });
          }
        } catch (err) {
          console.error("[battle] setBattleSession failed", err, { roomId, role, hasState: !!state });
          battleState = null;
        }
      },

      persistPlayerSaveDebounced,
      onBattleStateChanged: () => {
        try {
          if (DEBUG_BATTLE) {
            console.info("[battle] onBattleStateChanged", {
              hasHandle: !!legacyBattleHandle,
              hasState: !!battleState,
              version: battleState?.version,
              rootChildren: root?.childElementCount
            });
          }

          if (legacyBattleHandle?.invalidate && battleState) {
            legacyBattleHandle.invalidate();
            return;
          }

          renderApp();
        } catch (err) {
          console.error("[battle] onBattleStateChanged failed", err);
          try { legacyBattleHandle?.unmount?.(); } catch (e) { console.error("[battle] failed to unmount stale handle", e); }
          legacyBattleHandle = null;
          renderApp();
        }
      },

      onBattleLeaveRoom: () => { deckPlacementChoice = null; },
      onRoomsListChanged: (rooms) => { openRooms = Array.isArray(rooms) ? rooms : []; renderApp(); },
      uid
    }) || { connect: async () => null, createRoom: async () => ({ ok: false, error: "Missing CardboardMeta" }), joinRoom: async () => ({ ok: false, error: "Missing CardboardMeta" }), refreshRoomsList: async () => [], getOpenRooms: () => [], sendIntent: () => {}, leaveRoom: () => {} };

    const topBackBtn = document.createElement("button");
    topBackBtn.className = "topBackBtn";
    topBackBtn.textContent = "Back";
    document.querySelector(".topbar")?.insertBefore(topBackBtn, subtitle);
    topBackBtn.addEventListener("click", onBack);

// ============================
// ACTION REDUCER (shared)
// ============================
function ensureBattleStateShape(s) {
  s.sharedZones ||= {};
  s.sharedZones.stack ||= [];
  s.players ||= {};
  ["p1", "p2"].forEach((pk) => {
    s.players[pk] ||= { id: pk, name: pk === "p2" ? "Player 2" : "Player 1", zones: {} };
    s.players[pk].zones ||= {};
    ["hand", "deck", "graveyard", "lands", "permanents"].forEach((z) => {
      s.players[pk].zones[z] ||= [];
    });
  });
  s.tapped ||= {};
  s.tarped ||= {};
  if (!Number.isFinite(s.version)) s.version = 0;
  return s;
}

function ensureSandboxStateShape(s) {
  s.zones ||= {};
  ["hand", "deck", "graveyard", "lands", "permanents", "stack"].forEach((z) => (s.zones[z] ||= []));
  s.tapped ||= {};
  s.tarped ||= {};
  return s;
}

function getZoneRef(state, owner, zone) {
  if (owner === "solo") {
    ensureSandboxStateShape(state);
    return state.zones[zone] || (state.zones[zone] = []);
  }
  if (owner === "shared") {
    ensureBattleStateShape(state);
    state.sharedZones[zone] ||= [];
    return state.sharedZones[zone];
  }
  // p1/p2
  ensureBattleStateShape(state);
  state.players[owner] ||= { id: owner, name: owner, zones: {} };
  state.players[owner].zones ||= {};
  state.players[owner].zones[zone] ||= [];
  return state.players[owner].zones[zone];
}

function removeOnce(arr, cardId) {
  const idx = arr.indexOf(cardId);
  if (idx >= 0) arr.splice(idx, 1);
  return idx >= 0;
}

// Pure-ish: mutates `state` in place (by design for perf/simple integration)
function applyActionToState(state, action) {
  if (!action || !action.type) return;

  switch (action.type) {
    case "MOVE_CARD": {
      const fromArr = getZoneRef(state, action.from.owner, action.from.zone);
      const toArr = getZoneRef(state, action.to.owner, action.to.zone);

      if (!removeOnce(fromArr, action.cardId)) return;

      // stack "top" = end of array in your UI
      if (action.to.zone === "stack") toArr.push(action.cardId);
      else toArr.push(action.cardId);

      return;
    }

    case "DRAW_CARD": {
      // owner draws from their deck to their hand (leftmost = unshift)
      const deck = getZoneRef(state, action.owner, "deck");
      if (!deck.length) return;
      const cardId = deck[0];
      deck.shift();

      const hand = getZoneRef(state, action.owner, "hand");
      hand.unshift(cardId);
      return;
    }

case "TOGGLE_TAP": {
  const strKey = String(action.cardId);
  const numKey = Number(action.cardId);

  state.tapped ||= {};
  state.tarped ||= {};

  const setBoth = (obj, val) => {
    obj[strKey] = val;
    if (Number.isFinite(numKey)) obj[numKey] = val;
  };

  if (action.kind === "tarped") {
    const next = !state.tarped[strKey] && !state.tarped[numKey];
    setBoth(state.tarped, next);
    if (next) setBoth(state.tapped, false);
    return;
  }

  const next = !state.tapped[strKey] && !state.tapped[numKey];
  setBoth(state.tapped, next);
  if (next) setBoth(state.tarped, false);
  return;
}



    case "DECK_PLACE": {
      // Remove card from `from`, then place into deck of `owner`
      const fromArr = getZoneRef(state, action.from.owner, action.from.zone);
      if (!removeOnce(fromArr, action.cardId)) return;

      const deck = getZoneRef(state, action.owner, "deck");
      if (action.where === "top") deck.unshift(action.cardId);
      else deck.push(action.cardId);
      return;
    }

    case "REORDER_ZONE": {
      const arr = getZoneRef(state, action.owner, action.zone);
      // minimal validation: only accept if same multiset length
      if (!Array.isArray(action.ids)) return;
      if (action.ids.length !== arr.length) return;
      // optional stronger check: same elements (O(n^2) ok for tiny lists)
      const a = [...arr].sort((x, y) => x - y);
      const b = [...action.ids].sort((x, y) => x - y);
      for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return;

      // commit
      arr.length = 0;
      action.ids.forEach((id) => arr.push(id));
      return;
    }

    default:
      return;
  }
}


    
    
    function uid() {
      return (window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`);
    }

    function clone(x) { return JSON.parse(JSON.stringify(x)); }

    function createSeedDeck(offset = 0) {
      const seed = [200, 201, 202, 203, 204, 205, 210, 211, 212, 213, 220, 221, 222, 230, 231, 240, 241, 101, 102, 103, 104, 105];
      return seed.map((_, i) => seed[(i + offset) % seed.length]);
    }

    function createSandboxState() {
      return {
        zones: {
          permanents: [...(demo.zones?.permanents || [])],
          lands: [...(demo.zones?.lands || [])],
          hand: [...(demo.zones?.hand || [])],
          stack: [],
          deck: createSeedDeck(),
          graveyard: []
        },
        tapped: clone(demo.tapped || {}),
        tarped: clone(demo.tarped || {})
      };
    }

    function loadPlayerRegistry() {
      try {
        const parsed = JSON.parse(localStorage.getItem(PLAYER_KEY) || "{}");
        return {
          players: Array.isArray(parsed.players) ? parsed.players : [],
          lastPlayerId: parsed.lastPlayerId || null
        };
      } catch {
        return { players: [], lastPlayerId: null };
      }
    }

    function savePlayerRegistry() {
      localStorage.setItem(PLAYER_KEY, JSON.stringify(playerRegistry));
    }

    function getSaveKey(playerId) { return `${SAVE_PREFIX}${playerId}`; }

    function loadPlayerSave(playerId) {
      try {
        return JSON.parse(localStorage.getItem(getSaveKey(playerId)) || "{}");
      } catch {
        return {};
      }
    }

    function persistPlayerSaveDebounced() {
      if (!session.playerId) return;
      clearTimeout(saveTimer);
      saveTimer = setTimeout(() => {
        const prev = loadPlayerSave(session.playerId);
        const payload = {
          ...prev,
          lastMode: appMode || prev.lastMode || "sandbox",
          sandboxState,
          lastBattleRoomId: battleRoomId || prev.lastBattleRoomId || "",
          updatedAt: Date.now()
        };
        localStorage.setItem(getSaveKey(session.playerId), JSON.stringify(payload));
      }, 400);
    }

    function setActivePlayer(player) {
      session.playerId = player.id;
      session.playerName = player.name;
      player.lastSeenAt = Date.now();
      playerRegistry.lastPlayerId = player.id;
      savePlayerRegistry();
      const save = loadPlayerSave(player.id);
      sandboxState = save.sandboxState ? clone(save.sandboxState) : createSandboxState();
      appMode = null;
      uiScreen = "mainMenu";
      renderApp();
    }

    function createPlayer(name) {
      const trimmed = (name || "").trim();
      if (!trimmed) return;
      const existing = playerRegistry.players.find((p) => p.name.toLowerCase() === trimmed.toLowerCase());
      if (existing) return setActivePlayer(existing);
      const now = Date.now();
      const p = { id: uid(), name: trimmed, createdAt: now, lastSeenAt: now };
      playerRegistry.players.push(p);
      savePlayerRegistry();
      setActivePlayer(p);
    }

function onBack() {
  if (uiScreen === "mode") {
    if (appMode === "sandbox") {
      persistPlayerSaveDebounced();
      clearSandboxTopPilesHost();
      try { legacySandboxHandle?.unmount?.(); } catch {}
      legacySandboxHandle = null;
    }

    if (appMode === "battle") {
      // If battle is using legacy sandbox UI, unmount it too
      clearSandboxTopPilesHost();
      try { legacyBattleHandle?.unmount?.(); } catch {}
      legacyBattleHandle = null;

      battleClient.leaveRoom();
      battleLobbyRoomsRequested = false;
    }

    uiScreen = "mainMenu";
    appMode = null;
  } else if (uiScreen === "mainMenu") {
    uiScreen = "playerMenu";
  }

  renderApp();
}


    function cardName(cardId) {
      return window.CARD_REPO?.[String(cardId)]?.name || `Card ${cardId}`;
    }

    function modeState() {
      return appMode === "battle" ? battleState : sandboxState;
    }

    function getOpponentRole() {
      return session.role === "p1" ? "p2" : "p1";
    }

    function getViewedRole() {
      return appMode === "battle" ? (battleViewRole || session.role || "p1") : "solo";
    }

    function resolveZoneBinding(zoneKey, ownerRole = session.role) {
      if (appMode !== "battle") return { zone: zoneKey, owner: ownerRole };
      if (zoneKey === "opponentPermanents") return { zone: "permanents", owner: getOpponentRole() };
      if (zoneKey === "opponentLands") return { zone: "lands", owner: getOpponentRole() };
      return { zone: zoneKey, owner: ownerRole };
    }

    function isSharedZone(zoneKey) {
      return SHARED_ZONES.includes(zoneKey);
    }

    function isPrivateZone(zoneKey) {
      return PRIVATE_ZONES.includes(zoneKey);
    }

    function isBattlefieldZone(zoneKey) {
      return BATTLEFIELD_ZONES.includes(zoneKey);
    }

    function getZoneOwner(zoneKey, ownerRole = session.role) {
      const resolved = resolveZoneBinding(zoneKey, ownerRole);
      zoneKey = resolved.zone;
      ownerRole = resolved.owner;
      if (appMode !== "battle") return "solo";
      return isSharedZone(zoneKey) ? "shared" : (ownerRole || session.role || "p1");
    }

    function getZone(zoneKey, ownerRole = session.role) {
      const resolved = resolveZoneBinding(zoneKey, ownerRole);
      zoneKey = resolved.zone;
      ownerRole = resolved.owner;
      const s = modeState();
      if (!s) return [];
      if (appMode === "battle") {
        if (isSharedZone(zoneKey)) return s.sharedZones?.[zoneKey] || [];
        return s.players?.[ownerRole]?.zones?.[zoneKey] || [];
      }
      return s.zones?.[zoneKey] || [];
    }

    function setZone(zoneKey, arr, ownerRole = session.role) {
      const resolved = resolveZoneBinding(zoneKey, ownerRole);
      zoneKey = resolved.zone;
      ownerRole = resolved.owner;
      const s = modeState();
      if (!s) return;
      if (appMode === "battle") {
        if (isSharedZone(zoneKey)) s.sharedZones[zoneKey] = arr;
        else s.players[ownerRole].zones[zoneKey] = arr;
      } else {
        s.zones[zoneKey] = arr;
        persistPlayerSaveDebounced();
      }
    }

    function canSeeZone(zoneKey, ownerRole = session.role) {
      const resolved = resolveZoneBinding(zoneKey, ownerRole);
      zoneKey = resolved.zone;
      ownerRole = resolved.owner;
      if (appMode !== "battle") return true;
      if (isPrivateZone(zoneKey)) return ownerRole === getViewedRole();
      return isSharedZone(zoneKey) || isBattlefieldZone(zoneKey);
    }

    function getCardCostString(cardId) {
      const data = window.CARD_REPO?.[String(cardId)] || {};
      return (data.costs ?? data.cost ?? "").toString().trim();
    }

    function parseManaCost(costStr) {
      if (!costStr) return [];
      const tokens = String(costStr).trim().match(/(\d+|[WUBRGX])/g);
      return tokens || [];
    }

    function buildManaSymbolEl(tok) {
      if (!tok) return null;
      const el = document.createElement("div");
      el.className = "manaSymbol";
      if (/^\d+$/.test(tok)) {
        el.dataset.mana = "c";
        el.textContent = tok;
        return el;
      }
      const key = tok.toUpperCase();
      const manaKey = ["W", "U", "B", "R", "G", "X"].includes(key) ? key.toLowerCase() : "c";
      el.dataset.mana = manaKey;
      if (["W", "U", "B", "R", "G"].includes(key)) return el;
      el.textContent = key;
      return el;
    }

    function renderManaCostOverlay(costStr, opts = {}) {
      const mode = opts.mode || "mini";
      const tokens = parseManaCost(costStr);
      if (!tokens.length) return null;
      const icon = mode === "inspector" ? 22 : 12;
      const gap = mode === "inspector" ? 6 : 3;
      const cardW = mode === "inspector" ? 260 : 56;
      const cols = Math.max(1, Math.floor((Math.max(10, cardW - 10) + gap) / (icon + gap)));
      const wrap = document.createElement("div");
      wrap.className = `manaCost ${mode === "inspector" ? "isInspector" : "isMini"}`;
      for (let i = 0; i < tokens.length; i += cols) {
        const row = document.createElement("div");
        row.className = "manaRow";
        tokens.slice(i, i + cols).forEach((tok) => {
          const sym = buildManaSymbolEl(tok);
          if (sym) row.appendChild(sym);
        });
        wrap.appendChild(row);
      }
      return wrap;
    }

    function getCardImgSrc(cardId, opts = {}) {
      if (window.resolveCardImage) return window.resolveCardImage(cardId, { playerKey: opts.playerKey || session.role || "p1" });
      return `/cards/image${cardId}.png`;
    }

   function canDragFrom(zoneKey, ownerRole = session.role) {
  // In solo: everything works as before
  if (appMode !== "battle") return true;

  // Never drag FROM deck (we draw instead)
  if (zoneKey === "deck") return false;

  // Must be visible
  if (!canSeeZone(zoneKey, ownerRole)) return false;

  // Private zones stay private (only your own hand/deck/graveyard)
  if (isPrivateZone(zoneKey)) return ownerRole === session.role;

  // Battlefield + shared zones: allow for ANY owner
  // (lands/permanents/opponentLands/opponentPermanents/stack etc.)
  return true;
}


  function canDropTo(fromZone, toZone, fromOwner = session.role, toOwner = session.role) {
  if (appMode !== "battle") return true;

  if (!ALL_ZONES.includes(fromZone) || !ALL_ZONES.includes(toZone)) return false;

  // Cannot drop TO deck unless it's your own deck (and deck placement chooser handles it)
  if (toZone === "deck") return toOwner === session.role;

  // Private zones: only interact if you are the owner of the destination
  if (isPrivateZone(toZone)) return toOwner === session.role;

  // If you're moving FROM a private zone, you must own it
  if (isPrivateZone(fromZone) && fromOwner !== session.role) return false;

  // Otherwise: battlefield + shared zones are free-for-all (by design request)
  return true;
}


    function toggleMark(cardId, kind) {
      const s = modeState();
      if (!s) return;
      s[kind][cardId] = !s[kind][cardId];
      if (appMode === "battle") {
        battleClient.sendIntent("TOGGLE_TAP", { cardId, kind });
      } else {
        persistPlayerSaveDebounced();
      }
      renderApp();
    }

    function drawCard(ownerRole = session.role) {
      if (appMode === "battle" && ownerRole !== session.role) return;
      const deck = [...getZone("deck", ownerRole)];
      const hand = [...getZone("hand", ownerRole)];
      if (!deck.length) return;
      hand.unshift(deck.shift());
      setZone("deck", deck, ownerRole);
      setZone("hand", hand, ownerRole);
      if (appMode === "battle") battleClient.sendIntent("DRAW_CARD", { count: 1, owner: ownerRole });
      renderApp();
    }

    function openDeckPlacementChooser({ cardId, from, to, optimistic = true }) {
      if (deckPlacementChoice) return;
      const fromArr = [...getZone(from.zone, from.owner)];
      const idx = fromArr.indexOf(cardId);
      if (idx < 0) return;
      fromArr.splice(idx, 1);
      setZone(from.zone, fromArr, from.owner);
      const onCommit = (where) => {
        const deck = [...getZone(to.zone, to.owner)];
        if (where === "top") deck.unshift(cardId);
        else deck.push(cardId);
        setZone(to.zone, deck, to.owner);
        if (appMode === "battle" && optimistic) {
          battleClient.sendIntent("DECK_PLACE", { cardId, from, owner: to.owner, where });
        }
        deckPlacementChoice = null;
        renderApp();
      };
      const onCancel = () => {
        const back = [...getZone(from.zone, from.owner), cardId];
        setZone(from.zone, back, from.owner);
        deckPlacementChoice = null;
        renderApp();
      };
      deckPlacementChoice = { cardId, onCommit, onCancel };
      renderApp();
    }

    function moveCard(intentPayload, optimistic = true) {
      const { cardId, from, to } = intentPayload;
      const fromOwner = from.owner || session.role;
      const toOwner = to.owner || session.role;
      if (!ALL_ZONES.includes(from.zone) || !ALL_ZONES.includes(to.zone)) return;
      if (!canDropTo(from.zone, to.zone, fromOwner, toOwner)) return;
      if (to.zone === "deck" && from.zone !== "deck") {
        openDeckPlacementChooser({ cardId, from: { owner: fromOwner, zone: from.zone }, to: { owner: toOwner, zone: to.zone }, optimistic });
        return;
      }
      const fromArr = [...getZone(from.zone, fromOwner)];
      const idx = fromArr.indexOf(cardId);
      if (idx < 0) return;
      fromArr.splice(idx, 1);
      const toArr = [...getZone(to.zone, toOwner), cardId];
      setZone(from.zone, fromArr, fromOwner);
      setZone(to.zone, toArr, toOwner);
      if (appMode === "battle" && optimistic) battleClient.sendIntent("MOVE_CARD", { cardId, from: { owner: fromOwner, zone: from.zone }, to: { owner: toOwner, zone: to.zone } });
      renderApp();
    }

    function isPileZone(zoneKey) {
      return PILE_ZONES.includes(zoneKey);
    }

    function layoutHandFan(slotRowEl, cardIds) {
      const overlap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--hand-overlap")) || 0.55;
      const rx = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--hand-arc-rx")) || 340;
      const ry = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--hand-arc-ry")) || 130;
      const arcY = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--hand-arc-y")) || 18;
      const niceMax = 7;
      const n = cardIds.length;
      const baseRange = 42;
      const range = baseRange * (1.15 - overlap);
      const niceN = Math.min(n, niceMax);
      const centerNice = (niceN - 1) / 2;
      const niceStep = niceN > 1 ? (range / centerNice) : 0;
      const extraStep = 7.5 * (0.95 - overlap);

      const cards = Array.from(slotRowEl.querySelectorAll(".miniCard"));
      cards.forEach((el, i) => {
        let thetaDeg;
        if (i < niceN) thetaDeg = (i - centerNice) * niceStep;
        else {
          const extra = i - (niceN - 1);
          thetaDeg = (niceN - 1 - centerNice) * niceStep + extra * extraStep;
        }
        const theta = (thetaDeg * Math.PI) / 180;
        const x = rx * Math.sin(theta);
        const y = ry * (1 - Math.cos(theta)) + arcY;
        const rot = thetaDeg * 0.9;
        el.style.zIndex = String(1000 + i);
        el.style.transform = `translate(-50%, 0) translate(${x}px, ${y}px) rotate(${rot}deg)`;
      });
    }

    function onPilePointerDown(e) {
      e.preventDefault();
      e.stopPropagation();
    }

    function positionGhost(el, x, y) {
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
    }

    function hitTestZoneWithOwner(x, y) {
      const els = document.elementsFromPoint(x, y);
      for (const el of els) {
        const zone = el?.classList?.contains("dropArea") ? el : el?.closest?.(".dropArea");
        if (zone?.dataset?.zone) return { zone: zone.dataset.zone, owner: zone.dataset.owner };
      }
      return null;
    }

    function syncDropTargetHighlights(activeDrop) {
      document.querySelectorAll(".dropArea").forEach((area) => {
        const same = activeDrop && area.dataset.zone === activeDrop.zone && area.dataset.owner === activeDrop.owner;
        area.classList.toggle("active", !!same);
      });
    }

    function renderCard(cardId, zoneKey, ownerRole = session.role) {
      const card = document.createElement("div");
      card.className = "miniCard";
      card.dataset.cardId = String(cardId);
      card.dataset.fromZone = zoneKey;
      card.dataset.owner = ownerRole;
      card.title = cardName(cardId);

      const pic = document.createElement("div");
      pic.className = "miniPic";
      const img = document.createElement("img");
      img.className = "miniImg";
      img.alt = "";
      img.draggable = false;
      const src = getCardImgSrc(cardId, { playerKey: ownerRole });
      if (src) {
        img.onload = () => img.classList.add("isLoaded");
        img.onerror = () => img.remove();
        img.src = src;
        pic.appendChild(img);
      }
      card.appendChild(pic);

      const costEl = renderManaCostOverlay(getCardCostString(cardId), { mode: "mini" });
      if (costEl) card.appendChild(costEl);

      const data = window.CARD_REPO?.[String(cardId)] || {};
      if (Number.isFinite(data.power) && Number.isFinite(data.toughness)) {
        const pt = document.createElement("div");
        pt.className = "miniPT";
        pt.textContent = `${data.power}|${data.toughness}`;
        card.appendChild(pt);
      }

      const s = modeState();
      if (s?.tapped?.[cardId]) card.classList.add("tapped");
      if (s?.tarped?.[cardId]) card.classList.add("tarped");

      card.addEventListener("click", (e) => {
        e.stopPropagation();
        if (!dragging && !inspectorDragging && canSeeZone(zoneKey, ownerRole)) {
          inspector = { zoneKey, ownerRole, cardId };
          renderApp();
        }
      });

      card.addEventListener("contextmenu", (e) => {
        e.preventDefault();
        if (!canDragFrom(zoneKey, ownerRole)) return;
        toggleMark(cardId, "tapped");
      });
      card.addEventListener("dblclick", (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (zoneKey === "hand" || !canDragFrom(zoneKey, ownerRole)) return;
        toggleMark(cardId, e.shiftKey ? "tarped" : "tapped");
      });

      if (appMode === "battle") {
        card.addEventListener("pointerdown", (e) => {
          if (!canDragFrom(zoneKey, ownerRole)) return;
          e.preventDefault();
          const pointerId = e.pointerId;
          try { card.setPointerCapture(pointerId); } catch {}
          const start = { x: e.clientX, y: e.clientY };
          let holdTimer = null;
          let lifted = false;
          const lift = (cx, cy) => {
            if (lifted) return;
            lifted = true;
            const ghost = document.createElement("div");
            ghost.className = "dragGhost";
            ghost.textContent = String(cardId);
            document.body.appendChild(ghost);
            positionGhost(ghost, cx, cy);
            dragging = { cardId, from: zoneKey, owner: ownerRole, ghostEl: ghost, pointerId };
            if (navigator.vibrate) navigator.vibrate(10);
          };
          holdTimer = setTimeout(() => lift(e.clientX, e.clientY), 140);

          const cleanup = () => {
            clearTimeout(holdTimer);
            try { card.releasePointerCapture(pointerId); } catch {}
            card.removeEventListener("pointermove", onMove);
            card.removeEventListener("pointerup", onUp);
            card.removeEventListener("pointercancel", onCancel);
          };

          const onMove = (ev) => {
            ev.preventDefault();
            const dx = ev.clientX - start.x;
            const dy = ev.clientY - start.y;
            if (!lifted && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
              clearTimeout(holdTimer);
              lift(ev.clientX, ev.clientY);
            }
            if (dragging?.ghostEl) {
              positionGhost(dragging.ghostEl, ev.clientX, ev.clientY);
              syncDropTargetHighlights(hitTestZoneWithOwner(ev.clientX, ev.clientY));
            }
          };

          const onUp = (ev) => {
            ev.preventDefault();
            clearTimeout(holdTimer);
            if (dragging) {
              const drop = hitTestZoneWithOwner(ev.clientX, ev.clientY);
              if (drop && canDropTo(dragging.from, drop.zone, dragging.owner, drop.owner)) {
                moveCard({ cardId: dragging.cardId, from: { owner: dragging.owner, zone: dragging.from }, to: { owner: drop.owner, zone: drop.zone } }, true);
              }
              if (dragging.ghostEl?.parentNode) dragging.ghostEl.remove();
              dragging = null;
              syncDropTargetHighlights(null);
            }
            cleanup();
          };

          const onCancel = (ev) => {
            ev.preventDefault();
            if (dragging?.ghostEl) dragging.ghostEl.remove();
            dragging = null;
            syncDropTargetHighlights(null);
            cleanup();
          };

          card.addEventListener("pointermove", onMove, { passive: false });
          card.addEventListener("pointerup", onUp, { passive: false });
          card.addEventListener("pointercancel", onCancel, { passive: false });
        }, { passive: false });
      } else {
        card.draggable = canDragFrom(zoneKey, ownerRole);
        card.addEventListener("dragstart", () => { dragging = { cardId, from: zoneKey, owner: ownerRole }; });
        card.addEventListener("dragend", () => { dragging = null; });
      }
      return card;
    }

    function renderZone(zoneKey, ownerRole = session.role, opts = {}) {
      const zone = document.createElement("section");
      zone.className = `dropArea zone-${zoneKey}`;
      if (opts.mirrored) zone.classList.add("battleMirrorZone");
      if (opts.flipped) zone.classList.add("battleFlipZone");
      if (opts.compactPile) zone.classList.add("pileCompactTop");
      zone.dataset.zone = zoneKey;
      zone.dataset.owner = getZoneOwner(zoneKey, ownerRole);
      const zoneCardsRaw = getZone(zoneKey, ownerRole);
      const zoneCards = (appMode === "battle" && isPrivateZone(zoneKey) && !canSeeZone(zoneKey, ownerRole)) ? [] : zoneCardsRaw;

      if (isPileZone(zoneKey)) {
        zone.classList.add("isPile");
        const pile = document.createElement("div");
        pile.className = "pileSilhouette";
        const pileCard = document.createElement("div");
        pileCard.className = "miniCard pileCard";
        const count = document.createElement("div");
        count.className = "pileCount";
        count.textContent = String(zoneCardsRaw.length);
        pileCard.appendChild(count);
        if (zoneKey === "stack") {
          const intensity = Math.max(0, Math.min(10, zoneCards.length));
          pileCard.classList.add("stackPileCard");
          pileCard.style.setProperty("--stackI", String(intensity));
          pileCard.style.setProperty("--stackOn", zoneCards.length > 0 ? "1" : "0");
        }
        pile.appendChild(pileCard);

        const label = document.createElement("div");
        label.className = "pileLabel";
        label.textContent = zoneKey === "stack" ? "THE STACK" : zoneKey.toUpperCase();
        zone.append(pile, label);

        pileCard.addEventListener("pointerdown", onPilePointerDown, { passive: false });

        if (zoneKey === "deck") {
          let lastTapAt = 0;
          let singleTimer = null;
          const dblMs = 320;
          pileCard.addEventListener("click", (e) => {
            e.stopPropagation();
            if (!canSeeZone(zoneKey, ownerRole)) return;
            const now = performance.now();
            if (now - lastTapAt <= dblMs) {
              if (singleTimer) clearTimeout(singleTimer);
              singleTimer = null;
              lastTapAt = 0;
              drawCard(ownerRole);
              return;
            }
            lastTapAt = now;
            if (singleTimer) clearTimeout(singleTimer);
            singleTimer = setTimeout(() => {
              singleTimer = null;
              if (lastTapAt === 0) return;
              inspector = { zoneKey, ownerRole, cardId: null };
              renderApp();
            }, dblMs + 10);
          });
        } else {
          pileCard.addEventListener("click", (e) => {
            e.stopPropagation();
            if (!canSeeZone(zoneKey, ownerRole)) return;
            inspector = { zoneKey, ownerRole, cardId: null };
            renderApp();
          });
        }

        return zone;
      }

      zone.addEventListener("click", () => {
        if (!canSeeZone(zoneKey, ownerRole) || dragging || inspectorDragging) return;
        inspector = { zoneKey, ownerRole, cardId: null };
        renderApp();
      });

      const row = document.createElement("div");
      row.className = "slotRow";
      if (appMode === "battle" && isPrivateZone(zoneKey) && !canSeeZone(zoneKey, ownerRole)) {
        const hidden = document.createElement("div");
        hidden.className = "zoneMeta";
        hidden.textContent = "Hidden";
        row.appendChild(hidden);
      } else {
        zoneCards.forEach((id) => row.appendChild(renderCard(id, zoneKey, ownerRole)));
      }
      if (zoneKey === "hand") layoutHandFan(row, zoneCards);
      zone.appendChild(row);
      return zone;
    }

    function attachInspectorLongPress(cardEl, cardId, fromZoneKey, ownerRole) {
      let holdTimer = null;
      let lifted = false;
      let reordering = false;
      let start = null;
      let overlayEl = null;
      let trackEl = null;
      let placeholderEl = null;
      let draggingEl = null;
      let lastClientX = 0;
      let autoScrollRaf = null;
      let autoScrollDir = 0;
      const EDGE_PX = 84;
      const MAX_SPEED = 22;
      const ACTIVATION_DX = 10;
      const SWAP_HYSTERESIS = 0.08;
      const clamp01 = (x) => Math.max(0, Math.min(1, x));

      const cleanupOverlay = () => {
        if (!overlayEl) return;
        overlayEl.classList.remove("reordering");
        overlayEl.classList.remove("liftDragging");
        overlayEl.style.overflowX = "auto";
      };

      const stopAutoScroll = () => {
        autoScrollDir = 0;
        if (autoScrollRaf) cancelAnimationFrame(autoScrollRaf);
        autoScrollRaf = null;
      };

      const updatePlaceholderFromPointer = (clientX) => {
        if (!trackEl || !placeholderEl || !draggingEl) return;
        const cards = Array.from(trackEl.querySelectorAll(".inspectorCard")).filter((el) => el !== draggingEl);
        if (!cards.length) return;
        let best = null; let bestMid = 0; let bestDist = Infinity;
        cards.forEach((c) => {
          const r = c.getBoundingClientRect();
          const mid = r.left + (r.width / 2);
          const d = Math.abs(clientX - mid);
          if (d < bestDist) { bestDist = d; best = c; bestMid = mid; }
        });
        if (!best) return;
        const dead = best.getBoundingClientRect().width * SWAP_HYSTERESIS;
        const insertBefore = clientX < (bestMid - dead) ? true : (clientX > (bestMid + dead) ? false : null);
        if (insertBefore === null) return;
        if (insertBefore) trackEl.insertBefore(placeholderEl, best);
        else trackEl.insertBefore(placeholderEl, best.nextSibling);
      };

      const tickAutoScroll = () => {
        if (!reordering || !overlayEl || autoScrollDir === 0) { stopAutoScroll(); return; }
        const rect = overlayEl.getBoundingClientRect();
        let intensity = 0;
        if (autoScrollDir < 0) intensity = (rect.left + EDGE_PX - lastClientX) / EDGE_PX;
        else intensity = (lastClientX - (rect.right - EDGE_PX)) / EDGE_PX;
        const speed = Math.round(MAX_SPEED * clamp01(intensity));
        if (speed > 0) {
          overlayEl.scrollLeft += autoScrollDir * speed;
          updatePlaceholderFromPointer(lastClientX);
        }
        autoScrollRaf = requestAnimationFrame(tickAutoScroll);
      };

      const updateAutoScrollDir = (clientX) => {
        const rect = overlayEl.getBoundingClientRect();
        let dir = 0;
        if (clientX < rect.left + EDGE_PX) dir = -1;
        else if (clientX > rect.right - EDGE_PX) dir = 1;
        if (dir !== autoScrollDir) {
          autoScrollDir = dir;
          if (!dir) stopAutoScroll();
          else if (!autoScrollRaf) autoScrollRaf = requestAnimationFrame(tickAutoScroll);
        }
      };

      cardEl.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        if (!canDragFrom(fromZoneKey, ownerRole)) return;
        const pointerId = e.pointerId;
        try { cardEl.setPointerCapture(pointerId); } catch {}
        overlayEl = document.getElementById("inspectorOverlay");
        trackEl = overlayEl?.querySelector(".inspectorTrack") || null;
        if (!overlayEl || !trackEl) return;
        start = { x: e.clientX, y: e.clientY };
        lifted = false;
        reordering = false;

        const cancel = () => {
          clearTimeout(holdTimer);
          stopAutoScroll();
          try { cardEl.releasePointerCapture(pointerId); } catch {}
          cardEl.removeEventListener("pointermove", onMove);
          cardEl.removeEventListener("pointerup", onUp);
          cardEl.removeEventListener("pointercancel", onCancel);
        };

        const lift = () => {
          if (reordering) return;
          lifted = true;
          overlayEl.classList.add("liftDragging");
          overlayEl.style.overflowX = "hidden";
          const ghost = document.createElement("div");
          ghost.className = "dragGhost";
          ghost.textContent = String(cardId);
          document.body.appendChild(ghost);
          positionGhost(ghost, e.clientX, e.clientY);
          inspectorDragging = { cardId, fromZone: fromZoneKey, owner: ownerRole, ghostEl: ghost };
        };

        holdTimer = setTimeout(lift, 2200);

        const onMove = (ev) => {
          ev.preventDefault();
          lastClientX = ev.clientX;
          const dx = ev.clientX - start.x;
          const dy = ev.clientY - start.y;
          if (!lifted && !reordering && Math.abs(dx) > ACTIVATION_DX && Math.abs(dx) > Math.abs(dy)) {
            reordering = true;
            clearTimeout(holdTimer);
            overlayEl.classList.add("reordering");
            placeholderEl = document.createElement("div");
            placeholderEl.className = "inspectorPlaceholder";
            const r = cardEl.getBoundingClientRect();
            placeholderEl.style.width = `${r.width}px`;
            placeholderEl.style.height = `${r.height}px`;
            trackEl.insertBefore(placeholderEl, cardEl.nextSibling);
            draggingEl = cardEl;
            draggingEl.style.zIndex = "10010";
            draggingEl.style.transition = "transform 0ms";
          }
          if (!reordering && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) clearTimeout(holdTimer);
          if (reordering && draggingEl) {
            draggingEl.style.transform = `translateX(${dx}px) translateY(-6px) rotate(${dx * 0.02}deg)`;
            updatePlaceholderFromPointer(ev.clientX);
            updateAutoScrollDir(ev.clientX);
          } else if (inspectorDragging?.ghostEl) {
            positionGhost(inspectorDragging.ghostEl, ev.clientX, ev.clientY);
            syncDropTargetHighlights(hitTestZoneWithOwner(ev.clientX, ev.clientY));
          }
        };

        const onUp = (ev) => {
          ev.preventDefault();
          clearTimeout(holdTimer);
          if (reordering) {
            stopAutoScroll();
            if (placeholderEl && draggingEl) trackEl.insertBefore(draggingEl, placeholderEl);
            placeholderEl?.remove();
            if (draggingEl) {
              draggingEl.style.transform = "";
              draggingEl.style.zIndex = "";
              draggingEl.style.transition = "";
            }
            const ids = Array.from(trackEl.querySelectorAll(".inspectorCard")).map((el) => Number(el.dataset.cardId)).filter(Number.isFinite);
            setZone(fromZoneKey, ids, ownerRole);
            reordering = false;
            cleanupOverlay();
            renderApp();
            cancel();
            return;
          }
          if (inspectorDragging) {
            const drop = hitTestZoneWithOwner(ev.clientX, ev.clientY);
            inspectorDragging.ghostEl?.remove();
            if (drop && canDropTo(fromZoneKey, drop.zone, ownerRole, drop.owner)) {
              moveCard({ cardId: inspectorDragging.cardId, from: { owner: ownerRole, zone: fromZoneKey }, to: { owner: drop.owner, zone: drop.zone } }, true);
            }
            inspectorDragging = null;
            syncDropTargetHighlights(null);
            cleanupOverlay();
            renderApp();
          }
          cancel();
        };

        const onCancel = (ev) => {
          ev.preventDefault();
          clearTimeout(holdTimer);
          placeholderEl?.remove();
          if (draggingEl) {
            draggingEl.style.transform = "";
            draggingEl.style.zIndex = "";
            draggingEl.style.transition = "";
          }
          if (inspectorDragging?.ghostEl) inspectorDragging.ghostEl.remove();
          inspectorDragging = null;
          cleanupOverlay();
          syncDropTargetHighlights(null);
          cancel();
        };

        cardEl.addEventListener("pointermove", onMove, { passive: false });
        cardEl.addEventListener("pointerup", onUp, { passive: false });
        cardEl.addEventListener("pointercancel", onCancel, { passive: false });
      }, { passive: false });
    }

    function renderInspector() {
      if (!inspector) return null;
      if (!canSeeZone(inspector.zoneKey, inspector.ownerRole)) return null;
      const overlay = document.createElement("div");
      overlay.id = "inspectorOverlay";
      overlay.className = "inspectorOverlay";
      overlay.addEventListener("click", (e) => {
        if (inspectorDragging) return;
        if (e.target === overlay) { inspector = null; renderApp(); }
      });

      const closeBtn = document.createElement("button");
      closeBtn.className = "inspectorCloseBtn";
      closeBtn.textContent = "✕";
      closeBtn.addEventListener("click", (e) => { e.stopPropagation(); inspector = null; inspectorDragging = null; renderApp(); });

      const panel = document.createElement("div");
      panel.className = "inspectorTrack";
      const zoneCards = getZone(inspector.zoneKey, inspector.ownerRole);
      if (!zoneCards.length) {
        const empty = document.createElement("div");
        empty.className = "inspectorEmpty";
        empty.innerHTML = "<div>🗄️</div><p>No cards in this zone.</p>";
        panel.appendChild(empty);
      }

      zoneCards.forEach((id) => {
        const row = document.createElement("div");
        row.className = "inspectorCard";
        row.dataset.cardId = String(id);
        const src = getCardImgSrc(id, { playerKey: inspector.ownerRole });
        if (src) {
          const img = document.createElement("img");
          img.src = src;
          img.alt = "";
          img.onerror = () => img.remove();
          row.appendChild(img);
        }
        const costEl = renderManaCostOverlay(getCardCostString(id), { mode: "inspector" });
        if (costEl) row.appendChild(costEl);
        const name = document.createElement("div");
        name.className = "inspectorName";
        name.textContent = cardName(id);
        row.appendChild(name);
        const data = window.CARD_REPO?.[String(id)] || {};
        if (Number.isFinite(data.power) && Number.isFinite(data.toughness)) {
          const pt = document.createElement("div");
          pt.className = "inspectorPT";
          pt.textContent = `${data.power}|${data.toughness}`;
          row.appendChild(pt);
        }
        const s = modeState();
        if (s?.tapped?.[id]) row.classList.add("tapped");
        if (s?.tarped?.[id]) row.classList.add("tarped");
        attachInspectorLongPress(row, id, inspector.zoneKey, inspector.ownerRole);
        panel.appendChild(row);
      });

      overlay.append(closeBtn, panel);
      return overlay;
    }

    function renderDeckPlacementChooser() {
      if (!deckPlacementChoice) return null;
      const ov = document.createElement("div");
      ov.className = "deckChoiceOverlay";
      const card = document.createElement("div");
      card.className = "deckChoiceCard";
      const src = getCardImgSrc(deckPlacementChoice.cardId, { playerKey: session.role });
      if (src) card.style.backgroundImage = `url("${src}")`;
      const hint = document.createElement("div");
      hint.className = "deckChoiceHint";
      hint.textContent = "Swipe → TOP • Swipe ← BOTTOM";
      const btnRow = document.createElement("div");
      btnRow.className = "deckChoiceButtons";
      const btm = document.createElement("button");
      btm.className = "deckChoiceBtn bottom";
      btm.textContent = "Bottom";
      const top = document.createElement("button");
      top.className = "deckChoiceBtn top";
      top.textContent = "Top";
      btnRow.append(btm, top);
      ov.append(card, hint, btnRow);

      const commit = (where) => deckPlacementChoice?.onCommit(where);
      const cancel = () => deckPlacementChoice?.onCancel();
      top.addEventListener("click", (e) => { e.stopPropagation(); commit("top"); });
      btm.addEventListener("click", (e) => { e.stopPropagation(); commit("bottom"); });
      ov.addEventListener("click", (e) => { if (e.target === ov) cancel(); });

      let sx = 0;
      let active = false;
      card.addEventListener("pointerdown", (e) => { e.preventDefault(); active = true; sx = e.clientX; card.style.transition = "transform 0ms"; }, { passive: false });
      card.addEventListener("pointermove", (e) => {
        if (!active) return;
        e.preventDefault();
        const dx = e.clientX - sx;
        const rot = Math.max(-12, Math.min(12, dx * 0.06));
        card.style.transform = `translate(${dx}px, 0px) rotate(${rot}deg)`;
      }, { passive: false });
      card.addEventListener("pointerup", (e) => {
        if (!active) return;
        active = false;
        e.preventDefault();
        const dx = e.clientX - sx;
        if (dx > 90) return commit("top");
        if (dx < -90) return commit("bottom");
        card.style.transition = "transform 160ms cubic-bezier(.2,.9,.2,1)";
        card.style.transform = "translate(0,0) rotate(0deg)";
      }, { passive: false });
      return ov;
    }

    function renderBattlefieldTrack(ownerRole, label, opts = {}) {
      const section = document.createElement("section");
      section.className = "battleTrack";
      const title = document.createElement("div");
      title.className = "zoneMeta";
      title.textContent = `${label} battlefield`;
      section.appendChild(title);
      section.appendChild(renderZone("permanents", ownerRole, opts));
      section.appendChild(renderZone("lands", ownerRole, opts));
      return section;
    }

    function renderBoard() {
      if (appMode !== "battle") {
        const wrap = document.createElement("div");
        wrap.className = "board";
        const piles = document.createElement("div");
        piles.className = "pilesBar";
        ["stack", "deck", "graveyard"].forEach((z) => piles.appendChild(renderZone(z)));
        wrap.appendChild(piles);
        ["permanents", "lands", "hand"].forEach((z) => wrap.appendChild(renderZone(z)));
        return wrap;
      }

      const viewedRole = getViewedRole();
      const otherRole = viewedRole === "p1" ? "p2" : "p1";
      const wrap = document.createElement("div");
      wrap.className = "board battleBoard";

      const topTitle = document.createElement("div");
      topTitle.className = "zoneMeta";
      topTitle.textContent = `${otherRole.toUpperCase()} side`;
      wrap.appendChild(topTitle);

      wrap.appendChild(renderBattlefieldTrack(otherRole, otherRole.toUpperCase(), { mirrored: true }));

      const midLine = document.createElement("div");
      midLine.className = "midLine";
      wrap.appendChild(midLine);

      const bottomTitle = document.createElement("div");
      bottomTitle.className = "zoneMeta";
      bottomTitle.textContent = `${viewedRole.toUpperCase()} side`;
      wrap.appendChild(bottomTitle);

      wrap.appendChild(renderBattlefieldTrack(viewedRole, viewedRole.toUpperCase()));

      wrap.appendChild(renderZone("hand", viewedRole));

      const topPrivate = document.createElement("div");
      topPrivate.className = "battleTopPrivate";
      topPrivate.append(
        renderZone("deck", viewedRole, { compactPile: true }),
        renderZone("graveyard", viewedRole, { compactPile: true }),
        renderZone("stack", viewedRole, { compactPile: true })
      );
      wrap.appendChild(topPrivate);

      return wrap;
    }

    function renderPlayerMenu() {
      subtitle.textContent = "Choose player";
      const card = document.createElement("div");
      card.className = "menuCard";
      card.innerHTML = "<h2>Player Menu</h2>";

      const list = document.createElement("div");
      playerRegistry.players.sort((a, b) => b.lastSeenAt - a.lastSeenAt).forEach((p) => {
        const b = document.createElement("button");
        b.className = "menuBtn";
        b.textContent = `${p.name}`;
        b.onclick = () => setActivePlayer(p);
        list.appendChild(b);
      });
      if (!playerRegistry.players.length) {
        const empty = document.createElement("div");
        empty.className = "zoneMeta";
        empty.textContent = "No saved players yet.";
        list.appendChild(empty);
      }

      const input = document.createElement("input");
      input.className = "menuInput";
      input.placeholder = "Create new player name";
      const create = document.createElement("button");
      create.className = "menuBtn";
      create.textContent = "Create / Select";
      create.onclick = () => createPlayer(input.value);

      card.append(list, input, create);
      root.replaceChildren(card);
    }

    function renderMainMenu() {
      subtitle.textContent = `${session.playerName || "No player"}`;
      const card = document.createElement("div");
      card.className = "menuCard";
      card.innerHTML = "<h2>Main Menu</h2>";

      const sandboxBtn = document.createElement("button");
      sandboxBtn.className = "menuBtn";
      sandboxBtn.textContent = "Sandbox Mode";
      sandboxBtn.onclick = () => { appMode = "sandbox"; uiScreen = "mode"; renderApp(); };

      const battleBtn = document.createElement("button");
      battleBtn.className = "menuBtn";
      battleBtn.textContent = "2P Battle Mode";
      battleBtn.onclick = () => { appMode = "battle"; uiScreen = "mode"; renderApp(); };

      const deckBtn = document.createElement("button");
      deckBtn.className = "menuBtn";
      deckBtn.textContent = "Deckbuilder Mode";
      deckBtn.onclick = () => { appMode = "deckbuilder"; uiScreen = "mode"; renderApp(); };

      card.append(sandboxBtn, battleBtn, deckBtn);
      root.replaceChildren(card);
    }

    function clearSandboxTopPilesHost() {
      const host = document.getElementById("topPiles");
      if (host) host.remove();
    }

   function mountLegacySandboxInApp() {
  // If we already mounted once in this session, don't mount again
  // (renderModeScreen can run multiple times)
  if (legacySandboxHandle) return;

  // Prefer passing initialState directly instead of relying on window.DEMO_STATE
  const initialState = sandboxState;

  // Remove any previously injected legacy script (hot reload safe)
  const existing = document.querySelector('script[data-in-app-sandbox="1"]');
  if (existing) existing.remove();

  const script = document.createElement("script");
  script.src = `./legacySandbox.js?t=${Date.now()}`;
  script.dataset.inAppSandbox = "1";

  script.onload = () => {
    if (!window.LegacySandbox?.mount) {
      console.error("legacySandbox loaded but window.LegacySandbox.mount is missing");
      return;
    }

    // Mount into the SAME root/subtitle/topbar/back button that app.js already owns
   legacySandboxHandle = window.LegacySandbox.mount({
  root,
  subtitle,
  dragLayer: document.getElementById("dragLayer"),
  initialState,
  sandboxPlayerId: session.playerId || null,

  getMode: () => "solo",
  getActivePlayerKey: () => "p1",

  // ✅ allow legacy UI to apply actions (tap, move, draw, reorder, etc.)
  dispatch: (action) => {
    if (!action || !action.type) return;

    // Apply to the SAME object legacy is rendering from
    try { applyActionToState(sandboxState, action); } catch (e) { console.warn(e); }

    // Persist + repaint
    persistPlayerSaveDebounced();
    legacySandboxHandle?.invalidate?.();
  },

  onPersist: () => {
    persistPlayerSaveDebounced();
  }
});

  };

  script.onerror = () => {
    console.error("Failed to load legacySandbox.js");
  };

  document.body.appendChild(script);
}

function mountLegacyBattleInApp() {
  if (DEBUG_BATTLE) {
    console.info("[battle] mountLegacyBattleInApp", {
      hasState: !!battleState,
      hasHandle: !!legacyBattleHandle,
      version: battleState?.version
    });
  }

  if (!battleState) return;
  ensureBattleStateShape(battleState);

  if (legacyBattleHandle) {
    try {
      legacyBattleHandle.invalidate?.();
      return;
    } catch (err) {
      console.error("[battle] stale legacy handle, remounting", err);
      try { legacyBattleHandle.unmount?.(); } catch (e) { console.error("[battle] failed to unmount stale handle", e); }
      legacyBattleHandle = null;
    }
  }

  const ensureScript = () => new Promise((resolve, reject) => {
    if (window.LegacySandbox?.mount) return resolve();
    const existing = document.querySelector('script[data-in-app-legacy="1"]');
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
      return;
    }
    const s = document.createElement("script");
    s.src = `./legacySandbox.js?t=${Date.now()}`;
    s.dataset.inAppLegacy = "1";
    s.onload = resolve;
    s.onerror = reject;
    document.body.appendChild(s);
  });

  const roleOther = (r) => (r === "p1" ? "p2" : "p1");

  ensureScript().then(() => {
    const dragLayer = document.getElementById("dragLayer");
    if (!dragLayer) throw new Error("Missing #dragLayer for battle mount");

    const getArr = (zoneKey, opts2 = {}) => {
      const viewed = battleViewRole || session.role || "p1";
      const owner = opts2.playerKey || viewed;

      if (zoneKey === "stack") return battleState.sharedZones?.stack || [];
      if (zoneKey === "opponentLands") return battleState.players?.[roleOther(viewed)]?.zones?.lands || [];
      if (zoneKey === "opponentPermanents") return battleState.players?.[roleOther(viewed)]?.zones?.permanents || [];
      if (zoneKey === "lands" || zoneKey === "permanents") return battleState.players?.[viewed]?.zones?.[zoneKey] || [];
      return battleState.players?.[owner]?.zones?.[zoneKey] || [];
    };

    const setArr = () => {};

    const dispatch = (action) => {
      if (!action || !action.type) return;
      try {
        applyActionToState(battleState, action);
      } catch (err) {
        console.error("[battle] optimistic apply failed", err, action);
      }

      try {
        legacyBattleHandle?.invalidate?.();
      } catch (err) {
        console.error("[battle] invalidate after dispatch failed", err);
      }

      if (action.type === "MOVE_CARD") return battleClient.sendIntent("MOVE_CARD", { cardId: action.cardId, from: action.from, to: action.to });
      if (action.type === "DRAW_CARD") return battleClient.sendIntent("DRAW_CARD", { count: 1, owner: action.owner });
      if (action.type === "TOGGLE_TAP") return battleClient.sendIntent("TOGGLE_TAP", { cardId: action.cardId, kind: action.kind });
      if (action.type === "DECK_PLACE") return battleClient.sendIntent("DECK_PLACE", { cardId: action.cardId, from: action.from, owner: action.owner, where: action.where });
      if (action.type === "REORDER_ZONE") return battleClient.sendIntent("REORDER_ZONE", { owner: action.owner, zone: action.zone, ids: action.ids });
    };

    legacyBattleHandle = window.LegacySandbox.mount({
      root,
      subtitle,
      dragLayer,
      initialState: battleState,
      getMode: () => "battle",
      getActivePlayerKey: () => (battleViewRole || session.role || "p1"),
      setActivePlayerKey: (pk) => {
        battleViewRole = pk;
        try { legacyBattleHandle?.invalidate?.(); } catch (err) { console.error("[battle] invalidate after view switch failed", err); }
      },
      getZoneArray: (zoneKey, opts2) => getArr(zoneKey, opts2),
      setZoneArray: setArr,
      getMarks: () => ({ tapped: battleState?.tapped || {}, tarped: battleState?.tarped || {} }),
      dispatch,
      persistIntervalMs: 0
    });

    try { legacyBattleHandle.invalidate?.(); } catch (err) { console.error("[battle] initial invalidate failed", err); }

    if (DEBUG_BATTLE) {
      console.info("[battle] mountLegacyBattleInApp:mounted", {
        hasHandle: !!legacyBattleHandle,
        rootChildren: root?.childElementCount
      });
    }
  }).catch((err) => {
    console.error("Failed to mount legacy battle", err);
  });
}


    


    let battleLobbyBusy = false;

    function renderBattleLobby(host) {
      if (!window.CardboardMeta?.renderBattleLobby) return;
      window.CardboardMeta.renderBattleLobby({
        host,
        lastBattleRoomId: loadPlayerSave(session.playerId).lastBattleRoomId,
        openRooms,
        isBusy: battleLobbyBusy,
        onRefreshRooms: async () => {
          if (battleLobbyBusy) return;
          battleLobbyBusy = true;
          renderApp();
          try {
            await battleClient.refreshRoomsList?.();
            openRooms = battleClient.getOpenRooms?.() || openRooms;
          } finally {
            battleLobbyBusy = false;
            renderApp();
          }
        },
        onCreateRoom: async (requestedRoomCode) => {
          if (battleLobbyBusy) return;
          battleLobbyBusy = true;
          renderApp();
          try {
            const res = await battleClient.createRoom(requestedRoomCode);
            if (!res?.ok) alert(res?.error || "Failed to create room");
          } finally {
            battleLobbyBusy = false;
            renderApp();
          }
        },
        onJoinRoom: async (code, preferredRole) => {
          if (!code || battleLobbyBusy) return;
          battleLobbyBusy = true;
          renderApp();
          try {
            const res = await battleClient.joinRoom(code, preferredRole);
            if (!res?.ok) alert(res?.error || "Join failed");
          } finally {
            battleLobbyBusy = false;
            renderApp();
          }
        },
        onDeleteRoom: async (code) => {
          if (!code || battleLobbyBusy) return;
          battleLobbyBusy = true;
          renderApp();
          try {
            const res = await battleClient.deleteRoom(code);
            if (!res?.ok) alert(res?.error || "Delete failed");
            await battleClient.refreshRoomsList?.();
          } finally {
            battleLobbyBusy = false;
            renderApp();
          }
        },
        onDeleteAllRooms: async () => {
          if (battleLobbyBusy) return;
          battleLobbyBusy = true;
          renderApp();
          try {
            const res = await battleClient.deleteAllRooms();
            if (!res?.ok) alert(res?.error || "Delete all failed");
            await battleClient.refreshRoomsList?.();
          } finally {
            battleLobbyBusy = false;
            renderApp();
          }
        }
      });
    }

  function renderModeScreen() {
  if (appMode === "battle") {
    if (!battleState && !openRooms.length) battleClient.refreshRoomsList?.();
    if (!battleState && legacyBattleHandle) {
      try { legacyBattleHandle.unmount?.(); } catch (err) { console.error("[battle] unmount on lobby transition failed", err); }
      legacyBattleHandle = null;
      clearSandboxTopPilesHost();
    }
    subtitle.textContent = battleRoomId
      ? `${session.playerName} • battle • Game ${battleRoomId} • ${session.role || "-"}`
      : `${session.playerName} • battle`;
  } else {
    subtitle.textContent = `${session.playerName} • ${appMode}`;
  }

  const wrap = document.createElement("div");
  wrap.className = "view";

  if (appMode === "deckbuilder") {
    const card = document.createElement("div");
    card.className = "menuCard";
    card.innerHTML = "<h2>Deckbuilder coming soon</h2>";
    wrap.appendChild(card);

    const panel = renderInspector();
    const deckPanel = renderDeckPlacementChooser();
    root.replaceChildren(wrap);
    if (panel) root.appendChild(panel);
    if (deckPanel) root.appendChild(deckPanel);
    return;
  }

  if (appMode === "battle") {
    if (DEBUG_BATTLE) {
      console.info("[battle] renderModeScreen", {
        branch: battleState ? "board" : "lobby",
        hasHandle: !!legacyBattleHandle,
        version: battleState?.version
      });
    }

    if (!battleState) {
      renderBattleLobby(wrap);
      const panel = renderInspector();
      const deckPanel = renderDeckPlacementChooser();
      root.replaceChildren(wrap);
      if (panel) root.appendChild(panel);
      if (deckPanel) root.appendChild(deckPanel);
      return;
    }

    // IMPORTANT: do not clear root while legacy battle is already mounted.
    if (!legacyBattleHandle) root.replaceChildren(wrap);
    mountLegacyBattleInApp();
    return;
  }

  root.replaceChildren(wrap);
  mountLegacySandboxInApp();
}


    function renderApp() {
      topBackBtn.style.visibility = uiScreen === "playerMenu" ? "hidden" : "visible";
      const usingLegacyUI =
        (uiScreen === "mode" && appMode === "sandbox") ||
        (uiScreen === "mode" && appMode === "battle" && !!battleState);

      if (DEBUG_BATTLE) {
        console.info("[battle] renderApp", {
          uiScreen,
          appMode,
          hasBattleState: !!battleState,
          hasHandle: !!legacyBattleHandle,
          usingLegacyUI
        });
      }

      if (!usingLegacyUI) clearSandboxTopPilesHost();

      try {
        if (uiScreen === "playerMenu") return renderPlayerMenu();
        if (uiScreen === "mainMenu") return renderMainMenu();
        return renderModeScreen();
      } catch (err) {
        console.error("[battle] renderApp failed", err);
        const fallback = document.createElement("div");
        fallback.className = "menuCard";
        fallback.innerHTML = `<h3>Render error</h3><div class="zoneMeta">${String(err?.message || err)}</div>`;
        root.replaceChildren(fallback);
      }
    }

    if (playerRegistry.lastPlayerId) {
      const last = playerRegistry.players.find((p) => p.id === playerRegistry.lastPlayerId);
      if (last) setActivePlayer(last);
      else renderApp();
    } else {
      renderApp();
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot, { once: true });
  } else {
    boot();
  }
})();

/*
 * app2.js
 * Unified shell + board entrypoint.
 * - Embeds the legacy board renderer implementation directly in this file.
 * - Reuses app shell logic for player menu, sandbox, battle, and deckbuilder flows.
 * - Avoids runtime script injection for legacySandbox.js to prevent double-bind regressions.
 *
 * QC checklist:
 * 1) Sandbox: drag/drop all zones, inspector reorder/lift, tap/tarp, deck draw, deck placement chooser.
 * 2) Battle: lobby refresh/create/join/delete, view swap p1/p2, legal drops only, no random exits.
 * 3) Deckbuilder: save deck, pick p1/p2 deck, join/create room, verify shuffle + opening draw behavior.
 */

(() => {
  // Mountable sandbox module (no auto-boot).
  // app.js (or any host) calls: window.LegacySandbox.mount({...})
  // Returns: { unmount() }

  function mount(opts) {
    const root = opts?.root;
    const subtitle = opts?.subtitle;
    const dragLayer = opts?.dragLayer;

    if (!root) throw new Error("LegacySandbox.mount missing opts.root");
    if (!subtitle) throw new Error("LegacySandbox.mount missing opts.subtitle");
    if (!dragLayer) throw new Error("LegacySandbox.mount missing opts.dragLayer");

    // Optional: initial state is injected by host; fallback keeps standalone dev workable.
    const fallbackState = {
      playerName: "Player 1",
      zones: { hand: [200, 201, 202], lands: [101, 102], permanents: [210], deck: [], graveyard: [] },
      tapped: {},
      tarped: {},
    };

    const state = typeof structuredClone === "function"
      ? structuredClone(opts.initialState || window.DEMO_STATE || fallbackState)
      : JSON.parse(JSON.stringify(opts.initialState || window.DEMO_STATE || fallbackState));

    // ---- Adapters (host can override for battle mode) ----
    // These default to the current legacy in-file state.
    const api = {
      getMode: opts.getMode || (() => state.mode || "solo"),
      getActivePlayerKey: opts.getActivePlayerKey || (() => state.activePlayerKey || "p1"),
      setActivePlayerKey: opts.setActivePlayerKey || ((pk) => { state.activePlayerKey = pk; }),

      getZoneArray: opts.getZoneArray || ((zoneKey, opts2 = {}) => {
        ensureZoneArrays();
        if ((state.mode || "solo") === "solo") {
          state.zones ||= {};
          state.zones[zoneKey] ||= [];
          return state.zones[zoneKey];
        }
        // battle-like local default (still works standalone)
        if (zoneKey === "stack") {
          state.sharedZones ||= {};
          state.sharedZones[zoneKey] ||= [];
          return state.sharedZones[zoneKey];
        }
        if (zoneKey === "opponentLands" || zoneKey === "opponentPermanents") {
          const viewing = opts2.playerKey || (state.activePlayerKey || "p1");
          const opponent = otherPlayerKey(viewing);
          const p = getPlayer(opponent);
          const realZone = zoneKey === "opponentLands" ? "lands" : "permanents";
          p.zones[realZone] ||= [];
          return p.zones[realZone];
        }
        const p = getPlayer(opts2.playerKey || (state.activePlayerKey || "p1"));
        p.zones[zoneKey] ||= [];
        return p.zones[zoneKey];
      }),

      setZoneArray: opts.setZoneArray || ((zoneKey, arr, opts2 = {}) => {
        ensureZoneArrays();
        if ((state.mode || "solo") === "solo") {
          state.zones ||= {};
          state.zones[zoneKey] = arr;
          return;
        }
        if (zoneKey === "stack") {
          state.sharedZones ||= {};
          state.sharedZones[zoneKey] = arr;
          return;
        }
        if (zoneKey === "opponentLands" || zoneKey === "opponentPermanents") {
          const viewing = opts2.playerKey || (state.activePlayerKey || "p1");
          const opponent = otherPlayerKey(viewing);
          const p = getPlayer(opponent);
          const realZone = zoneKey === "opponentLands" ? "lands" : "permanents";
          p.zones[realZone] = arr;
          return;
        }
        const p = getPlayer(opts2.playerKey || (state.activePlayerKey || "p1"));
        p.zones[zoneKey] = arr;
      }),

      canSeeZone: opts.canSeeZone || (() => true),
      getMarks: opts.getMarks || (() => ({ tapped: state.tapped || {}, tarped: state.tarped || {} })),
      onPersist: opts.onPersist || (() => {}),
    };

    // ============================
    // DISPATCH SUPPORT (Option A)
    // ============================
    const dispatch = typeof opts.dispatch === "function" ? opts.dispatch : null;
    const authoritativeDispatch = !!opts.authoritativeDispatch;
    const debugEnabled = !!opts.debugDnD;
    const debugLog = (...args) => {
      if (!debugEnabled) return;
      console.info("[battle:dnd]", ...args);
    };

    function otherPlayerKey(pk) {
      return pk === "p1" ? "p2" : "p1";
    }

    // Map UI zoneKeys to canonical action zones + owners.
    // Owners: "solo" | "shared" | "p1" | "p2"
    function resolveOwnerZone(zoneKey, opts2 = {}) {
      const mode = getMode();
      const viewing = getActivePlayerKey();
      const other = otherPlayerKey(viewing);

      // Canonicalize opponent mirror zones -> real zone + other owner
      if (zoneKey === "opponentLands") return { owner: mode === "solo" ? "solo" : other, zone: "lands" };
      if (zoneKey === "opponentPermanents") return { owner: mode === "solo" ? "solo" : other, zone: "permanents" };

      // Shared stack
      if (zoneKey === "stack") return { owner: mode === "solo" ? "solo" : "shared", zone: "stack" };

      // In solo, everything is owned by "solo"
      if (mode === "solo") return { owner: "solo", zone: zoneKey };

      // Battle-like: default to currently viewed player for non-shared zones
      // (hand/deck/graveyard/lands/permanents)
      const forcedOwner = opts2.owner; // optional override if host wants
      return { owner: forcedOwner || viewing, zone: zoneKey };
    }

   function emitAction(action, fallbackFn) {
  if (dispatch) {
    try { dispatch(action); } catch {}

    if (authoritativeDispatch) {
      return true;
    }

    if (typeof fallbackFn === "function") {
      fallbackFn();            // ✅ local apply as fallback
      persistSandboxForPlayer();
      render();
    }
    return true;
  }

  if (typeof fallbackFn === "function") {
    fallbackFn();
    persistSandboxForPlayer();
    render();
  }
  return false;
}


    
    
    // --- sandbox persistence wiring (optional; host can disable/replace) ---
    const sandboxPlayerId = opts.sandboxPlayerId ?? window.__CB_PLAYER_ID ?? null;
    let sandboxSaveTimer = null;
    function persistSandboxForPlayer() {
      api.onPersist();
      if (!sandboxPlayerId) return;
      clearTimeout(sandboxSaveTimer);
      sandboxSaveTimer = setTimeout(() => {
        try {
          const key = `cb_save_${sandboxPlayerId}`;
          const prev = JSON.parse(localStorage.getItem(key) || "{}");
          const snapshot = {
            playerName: state.playerName,
            zones: state.zones,
            sharedZones: state.sharedZones,
            players: state.players,
            tapped: state.tapped,
            tarped: state.tarped,
            mode: state.mode,
            activePlayerKey: state.activePlayerKey,
          };
          localStorage.setItem(key, JSON.stringify({
            ...prev,
            lastMode: "sandbox",
            sandboxState: snapshot,
            updatedAt: Date.now(),
          }));
        } catch {}
      }, 500);
    }

    // If host wants to keep the old interval, keep it (but only while mounted)
    const persistIntervalMs = opts.persistIntervalMs ?? 1500;
    const intervalId = persistIntervalMs ? setInterval(persistSandboxForPlayer, persistIntervalMs) : null;

    // ============================
    // EVERYTHING BELOW IS YOUR OLD boot() BODY
    // ============================

    // ✅ declare UI vars BEFORE any code uses them
    let view = { type: "overview" };
    let dragging = null;
    let inspector = null;
    let inspectorDragging = null;

    // --- helpers rewritten to go through api ---
    function getMode() { return api.getMode(); }
    function getActivePlayerKey() { return api.getActivePlayerKey(); }
    function getMarkMaps() {
      const marks = api.getMarks?.() || {};
      return {
        tapped: marks.tapped || {},
        tarped: marks.tarped || {}
      };
    }

    function getPlayer(playerKey = getActivePlayerKey()) {
      state.players ||= {};
      state.players[playerKey] ||= { name: playerKey === "p2" ? "Player 2" : "Player 1", zones: {} };
      state.players[playerKey].zones ||= {};
      return state.players[playerKey];
    }

    function isSharedZone(zoneKey) {
      return zoneKey === "stack";
    }

    function getZoneOwnerKey(zoneKey, opts2 = {}) {
      if (getMode() === "solo") return "solo";
      if (isSharedZone(zoneKey)) return "shared";
      if (zoneKey === "opponentLands" || zoneKey === "opponentPermanents") {
        return otherPlayerKey(opts2.playerKey || getActivePlayerKey());
      }
      return opts2.playerKey || getActivePlayerKey();
    }

    function getZoneArray(zoneKey, opts2 = {}) {
      return api.getZoneArray(zoneKey, opts2);
    }

    function setZoneArray(zoneKey, arr, opts2 = {}) {
      api.setZoneArray(zoneKey, arr, opts2);
      persistSandboxForPlayer();
    }

    // ✅ EVERYTHING BELOW this point: paste your legacy code exactly as-is,
    // except for TWO tiny edits described in Step 3.



// ✅ EVERYTHING BELOW (your existing code) goes inside boot(), so it can see state/root/etc.








  
function ensureZoneArrays() {
  const soloKeys = ["hand", "lands", "permanents", "deck", "graveyard", "stack", "opponentLands", "opponentPermanents"];
  const sharedKeys = ["lands", "permanents", "stack", "opponentLands", "opponentPermanents"];
  const playerKeys = ["hand", "deck", "graveyard"];

  if (!state.mode) state.mode = "solo";
  if (!state.activePlayerKey) state.activePlayerKey = "p1";

  state.zones ||= {};
  for (const k of soloKeys) state.zones[k] ||= [];

  state.sharedZones ||= {};
  for (const k of sharedKeys) state.sharedZones[k] ||= [];

  state.players ||= {};
  ["p1", "p2"].forEach((pk, idx) => {
    state.players[pk] ||= { name: idx === 0 ? "Player 1" : "Player 2", zones: {} };
    state.players[pk].name ||= idx === 0 ? "Player 1" : "Player 2";
    state.players[pk].zones ||= {};
    for (const zk of playerKeys) state.players[pk].zones[zk] ||= [];
  });
}



function ensureDeckSeeded() {
  const seedDeck = [
200, 201, 202, 203, 204, 205,
210, 211, 212, 213,
101, 102, 103, 104, 105,
220, 221, 222, 230, 231, 240, 241,
  ];

  if (getMode() === "solo") {
    const deck = getZoneArray("deck");
    if (Array.isArray(deck) && deck.length === 0) setZoneArray("deck", [...seedDeck]);
    return;
  }

  ["p1", "p2"].forEach((pk, idx) => {
    const deck = getZoneArray("deck", { playerKey: pk });
    if (deck.length === 0) {
      const rotated = seedDeck.map((id, i) => seedDeck[(i + (idx * 5)) % seedDeck.length]);
      setZoneArray("deck", rotated, { playerKey: pk });
    }

    const hand = getZoneArray("hand", { playerKey: pk });
    if (hand.length === 0) {
      const d = getZoneArray("deck", { playerKey: pk });
      for (let i = 0; i < 3 && d.length > 0; i++) hand.unshift(d.shift());
    }
  });
}


// ✅ init once (ONLY ONCE)
ensureZoneArrays();
ensureDeckSeeded();

state.mode ||= "solo";
state.activePlayerKey ||= "p1";

function updateSubtitle() {
  // battle: show which player you're "viewing"
  if (getMode() === "battle") {
    const active = getPlayer(getActivePlayerKey());
    subtitle.textContent = `Battle • Viewing: ${active.name}`;
    return;
  }

  // solo: show playerName
  subtitle.textContent = state.playerName || "Player";
}

updateSubtitle();


const ZONES = [
  // opponent mirrored battlefield rows (top)
   { key: "opponentLands", label: "Opponent Lands", kind: "row" },
  { key: "opponentPermanents", label: "Opponent Permanents", kind: "row" },
 
  // your battlefield + hand (bottom)
  { key: "permanents", label: "Permanents", kind: "row" },
  { key: "lands", label: "Lands", kind: "row" },
  { key: "hand", label: "Hand", kind: "hand" },

  // piles
  { key: "stack", label: "THE STACK", kind: "pile" },
  { key: "deck", label: "Deck", kind: "pile" },
  { key: "graveyard", label: "Graveyard", kind: "pile" },
];



function getCardCostString(cardId) {
  const data = window.CARD_REPO?.[String(cardId)] || {};
  // support both "cost" and "costs"
  const c = (data.costs ?? data.cost ?? "").toString().trim();
  return c;
}

function parseManaCost(costStr) {
  // Accepts: "1W", "2UU", "10G", "XRR", "" etc.
  // Returns array like: ["1","W","U","U"]
  if (!costStr) return [];
  const s = String(costStr).trim();
  if (!s) return [];
  const tokens = s.match(/(\d+|[WUBRGX])/g);
  return tokens ? tokens : [];
}

function getManaTokenKey(tok) {
  // normalize token to a display key
  if (!tok) return "";
  if (/^\d+$/.test(tok)) return "C"; // generic for numerals (we'll print the number)
  const t = tok.toUpperCase();
  if (["W","U","B","R","G","X"].includes(t)) return t;
  return "";
}

function buildManaSymbolEl(tok) {
  // Fallback symbol: a styled circle.
  // NEW: colored pips show NO LETTERS — just a stronger color fill.
  // Neutral costs (numbers) remain as text. Colorless stays neutral. X stays as text.

  const key = getManaTokenKey(tok);
  if (!key) return null;

  const el = document.createElement("div");
  el.className = "manaSymbol";

  const isNumber = /^\d+$/.test(tok);
  const manaKey =
    key === "W" ? "w" :
    key === "U" ? "u" :
    key === "B" ? "b" :
    key === "R" ? "r" :
    key === "G" ? "g" :
    key === "X" ? "x" : "c";

  el.dataset.mana = manaKey;

  // ✅ Keep neutral costs as-is (numbers)
  if (isNumber) {
    el.textContent = tok;
    return el;
  }

  // ✅ For the 5 colored pips: no letters, just color fill
  if (["W", "U", "B", "R", "G"].includes(key)) {
    el.textContent = "";            // remove letter
    el.setAttribute("aria-label", key);
    return el;
  }

  // ✅ Keep X visible as text (still neutral-ish)
  if (key === "X") {
    el.textContent = "X";
    return el;
  }

  // ✅ Colorless / generic fallback
  el.textContent = key;
  return el;
}

function renderManaCostOverlay(costStr, opts = {}) {
  // opts: { mode: "mini" | "inspector" }
  const mode = opts.mode || "mini";

  const tokens = parseManaCost(costStr);
  if (!tokens.length) return null;

  // icon sizing assumptions (must match CSS presets)
  const icon = mode === "inspector" ? 22 : 12;
  const gap = mode === "inspector" ? 6 : 3;

  // card widths in your UI:
  // miniCard = 56px; inspectorCard varies but we can estimate 260 max (you set max-width 260)
  const cardW = mode === "inspector" ? 260 : 56;

  const pad = 10; // matches CSS max-width calc
  const usable = Math.max(10, cardW - pad);
  const cols = Math.max(1, Math.floor((usable + gap) / (icon + gap)));

  const wrap = document.createElement("div");
  wrap.className = "manaCost " + (mode === "inspector" ? "isInspector" : "isMini");

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
  const playerKey = opts.playerKey || "p1";

  if (window.resolveCardImage) {
    return window.resolveCardImage(cardId, { playerKey }); // may return null
  }

  // old local convention as a last resort:
  return `/cards/image${cardId}.png`;
}

 
function makeMiniCardEl(cardId, fromZoneKey, { overlay = false, flipped = false } = {}) {
  const c = document.createElement("div");
  c.className = "miniCard";
  c.dataset.cardId = String(cardId);
  c.dataset.fromZoneKey = fromZoneKey;

  if (flipped) c.classList.add("flip180");

  // ===== Art layer =====
  const pic = document.createElement("div");
  pic.className = "miniPic";

  const img = document.createElement("img");
  img.className = "miniImg";
  img.alt = "";
  img.draggable = false;

  const src = getCardImgSrc(cardId, { playerKey: getActivePlayerKey() });
  if (src) {
    img.onload = () => img.classList.add("isLoaded");
    img.onerror = () => img.remove(); // silhouette fallback
    img.src = src;
    pic.appendChild(img);
  }

  c.appendChild(pic);

  // ===== Mana cost =====
  const costStr = getCardCostString(cardId);
  const costEl = renderManaCostOverlay(costStr, { mode: "mini" });
  if (costEl) c.appendChild(costEl);

  // ===== PT badge =====
  const data = window.CARD_REPO?.[String(cardId)];
  if (data && Number.isFinite(data.power) && Number.isFinite(data.toughness)) {
    const pt = document.createElement("div");
    pt.className = "miniPT";
    pt.textContent = `${data.power}|${data.toughness}`;
    c.appendChild(pt);
  }

  const marks = getMarkMaps();
  if (marks.tapped?.[String(cardId)]) c.classList.add("tapped");
  if (marks.tarped?.[String(cardId)]) c.classList.add("tarped");

if (!overlay) {
  c.style.touchAction = "none"; // ✅ CRITICAL: prevents browser scroll/zoom from killing pointer events
  c.addEventListener("pointerdown", onCardPointerDown, { passive: false });
  c.addEventListener("click", (e) => e.stopPropagation());
}


  return c;
}

  
function removeInspectorOverlay() {
  const existing = document.getElementById("inspectorOverlay");
  if (existing) existing.remove();
}

  function removeBoardOverlay() {
  const existing = document.getElementById("boardOverlay");
  if (existing) existing.remove();
}

function layoutHandFan(slotRowEl, cardIds) {
  // Tweak these constants to taste (they map to CSS vars too)
  const overlap = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--hand-overlap")) || 0.55;

  const rx = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--hand-arc-rx")) || 340;
  const ry = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--hand-arc-ry")) || 130;
  const arcY = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--hand-arc-y")) || 18;

  // The “nice” spread for up to 7 cards
  const niceMax = 7;
  const n = cardIds.length;

  // Angle range for the "nice" portion (degrees)
  const baseRange = 42; // total spread (~-21..+21) at overlap ~0.55
  const range = baseRange * (1.15 - overlap); // higher overlap -> smaller range

  // For >7, keep the first 7 nicely centered, and let the rest march to the right
  const niceN = Math.min(n, niceMax);
  const startIdx = 0;

  // Centering for the nice set
  const centerNice = (niceN - 1) / 2;

  // Step for angles inside the nice range
  const niceStep = niceN > 1 ? (range / centerNice) : 0;

  // Extra cards: extend angles to the right; overlap controls how fast they “fall away”
  const extraStep = 7.5 * (0.95 - overlap); // smaller overlap => faster spread; larger => tighter

  // Apply transform to each .miniCard in slotRow order
  const cards = Array.from(slotRowEl.querySelectorAll(".miniCard"));
  cards.forEach((el, i) => {
    // Base index for curve
    let thetaDeg;
    if (i < niceN) {
      thetaDeg = (i - centerNice) * niceStep; // centered fan
    } else {
      const extra = i - (niceN - 1);
      thetaDeg = (niceN - 1 - centerNice) * niceStep + extra * extraStep; // keep going right
    }

    const theta = (thetaDeg * Math.PI) / 180;

    // Parametric ellipse: x = rx*sin(theta), y = ry*(1 - cos(theta))
    // y grows downward as theta increases; perfect for “disappear down-right”
    const x = rx * Math.sin(theta);
    const y = ry * (1 - Math.cos(theta)) + arcY;

    // Rotate slightly to match curve
    const rot = thetaDeg * 0.9;

    // Z-order: later cards should sit on top (typical hand feel)
    el.style.zIndex = String(1000 + i);

    // Anchor at center then move to arc point, then rotate.
    // translate(-50%,0) pulls element center to the 50% left anchor.
    el.style.transform = `translate(-50%, 0) translate(${x}px, ${y}px) rotate(${rot}deg)`;

    // Optional: tiny scale taper for depth, feels "globe eye"
    // const scale = 1 - Math.min(Math.abs(thetaDeg) / 140, 0.06);
    // el.style.transform += ` scale(${scale})`;
  });
}

function goBackToOverview() {
  // always close transient UI first
  inspector = null;
  inspectorDragging = null;
  dragging = null;

  removeInspectorOverlay();
  removeBoardOverlay();
  syncDropTargetHighlights(null);

  const dc = document.getElementById("deckChoiceOverlay");
  if (dc) dc.remove();

  view = { type: "overview" };
  render();
}  
  
function renderBoardOverlay() {
  removeBoardOverlay();

  const wrap = document.createElement("div");
  wrap.id = "boardOverlay";
  wrap.className = "boardOverlay";

  const inner = document.createElement("div");
  inner.className = "boardOverlayInner";

  const board = document.createElement("div");
  board.className = "board";

  // reuse same drop areas (they already have dataset.zoneKey)
  ZONES.forEach(z => board.appendChild(renderDropArea(z.key, { overlay: true })));


  inner.appendChild(board);
  wrap.appendChild(inner);
  document.body.appendChild(wrap);
}

function render() {
  root.innerHTML = "";

  document.body.classList.toggle("isFocus", view?.type === "focus");
  document.body.classList.toggle("isOverview", view?.type !== "focus");

  // show Back only when we're in focus
  const b = document.querySelector(".topBackBtn");
  if (b) b.style.display = (view?.type === "focus") ? "inline-flex" : "none";

  updateSubtitle();

  if (view?.type === "focus" && view.zoneKey) {
    root.appendChild(renderFocus(view.zoneKey));
  } else {
    root.appendChild(renderOverview());
  }

  // Mount top piles OUTSIDE root (so they stay at real top)
  renderTopPilesBar();

  // Inspector overlay handling stays global
  if (inspector) {
    renderInspector(inspector.zoneKey);
  } else {
    removeInspectorOverlay();
    removeBoardOverlay();
    syncDropTargetHighlights(null);
  }
}

function renderOverview() {
  const wrap = document.createElement("div");
  wrap.className = "overview";

  const tiles = document.createElement("div");
  tiles.className = "zoneTiles";

  // main zones
  ["permanents", "lands", "hand"].forEach((k) => {
    const z = ZONES.find(x => x.key === k);
    tiles.appendChild(renderZoneTile(z.key, z.label, true));
  });

  // piles
  ["stack", "deck", "graveyard"].forEach((k) => {
    const z = ZONES.find(x => x.key === k);
    tiles.appendChild(renderZoneTile(z.key, z.label, true));
  });

  const battleTile = document.createElement("button");
  battleTile.className = "zoneTile";
  battleTile.type = "button";
  battleTile.innerHTML = `<div class="zoneHead"><div class="zoneName">${getMode() === "battle" ? "Leave Battle" : "Battle (2P)"}</div><div class="zoneMeta">Prototype</div></div><div class="previewRow"></div>`;
  battleTile.addEventListener("click", () => {
    if (getMode() === "battle") {
      state.mode = "solo";
      inspector = null;
      view = { type: "overview" };
      render();
      return;
    }

    state.mode = "battle";
    state.activePlayerKey = "p1";
    ensureZoneArrays();
    ensureDeckSeeded();
    inspector = null;
    view = { type: "focus", zoneKey: "hand" };
    render();
  });
  tiles.appendChild(battleTile);

  wrap.appendChild(tiles);

  const hint = document.createElement("div");
  hint.className = "overviewHint";
  hint.textContent = "Tap a zone to inspect. Double-tap a zone to focus.";
  wrap.appendChild(hint);

  return wrap;
}


function showDock(active) {
  const overlay = document.getElementById("inspectorOverlay");
  if (overlay) {
    // Do NOT toggle ".dragging" here (that's reserved for lift-mode UI only)
    overlay.style.overflowX = active ? "hidden" : "auto";
  }
}



function moveCard(cardId, fromZoneKey, toZoneKey) {
  if (!toZoneKey) return;
  if (!fromZoneKey) return;
  if (toZoneKey === fromZoneKey) return;

  ensureZoneArrays();

  // If moving INTO deck, we need chooser (top/bottom).
  // In dispatch mode: do NOT mutate now; chooser will dispatch DECK_PLACE on commit.
  if (toZoneKey === "deck" && fromZoneKey !== "deck") {
    if (dispatch) {
      openDeckPlacementChooser(cardId, fromZoneKey);
      return;
    }

    // legacy local behavior
    const fromArr = getZoneArray(fromZoneKey);
    const idx = fromArr.indexOf(cardId);
    if (idx < 0) return;
    fromArr.splice(idx, 1);
    openDeckPlacementChooser(cardId, fromZoneKey);
    return;
  }

  if (dispatch) {
  const from = resolveOwnerZone(fromZoneKey);
  const to = resolveOwnerZone(toZoneKey);

  emitAction(
    {
      type: "MOVE_CARD",
      cardId,
      from: { owner: from.owner, zone: from.zone },
      to: { owner: to.owner, zone: to.zone },
    },
    () => {
      // ✅ local fallback mutation (same as legacy path)
      const fromArr = getZoneArray(fromZoneKey);
      const toArr = getZoneArray(toZoneKey);
      const idx = fromArr.indexOf(cardId);
      if (idx < 0) return;

      if (toZoneKey === "stack") {
        fromArr.splice(idx, 1);
        toArr.push(cardId);
        return;
      }

      fromArr.splice(idx, 1);
      toArr.push(cardId);
    }
  );

  return;
}


  // ===== legacy local mutation behavior =====
  const fromArr = getZoneArray(fromZoneKey);
  const toArr = getZoneArray(toZoneKey);

  const idx = fromArr.indexOf(cardId);
  if (idx < 0) return;

  // Special: stack always receives cards "on top"
  if (toZoneKey === "stack") {
    fromArr.splice(idx, 1);
    toArr.push(cardId); // top = end of array
    return;
  }

  fromArr.splice(idx, 1);
  toArr.push(cardId);
}

  

function attachInspectorLongPress(cardEl, cardId, fromZoneKey, ownerKey) {
  let holdTimer = null;

  // modes
  let lifted = false;     // long-press lift-to-board mode
  let reordering = false; // short horizontal drag reorder mode

  // refs/state
  let start = null;
  let overlayEl = null;
  let trackEl = null;

  // reorder UX
  let placeholderEl = null;
  let draggingEl = null;        // same as cardEl but we treat as “floating”
  let dragStartRect = null;
  let lastClientX = 0;

  // auto-scroll
  let autoScrollRaf = null;
  let autoScrollDir = 0; // -1 left, +1 right, 0 none

  // tuning
  const EDGE_PX = 84;            // edge zone for auto-scroll
  const MAX_SPEED = 22;          // px/frame at extreme edge
  const ACTIVATION_DX = 10;      // how quickly reorder starts
  const SWAP_HYSTERESIS = 0.08;  // deadzone around midpoints (0.0-0.2)
  const CENTER_ON_DROP = true;

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

  const updateAutoScrollDir = (clientX) => {
    if (!overlayEl) return;
    const rect = overlayEl.getBoundingClientRect();

    let dir = 0;
    if (clientX < rect.left + EDGE_PX) dir = -1;
    else if (clientX > rect.right - EDGE_PX) dir = +1;

    if (dir !== autoScrollDir) {
      autoScrollDir = dir;
      if (autoScrollDir === 0) stopAutoScroll();
      else if (!autoScrollRaf) autoScrollRaf = requestAnimationFrame(tickAutoScroll);
    }
  };

  const tickAutoScroll = () => {
    if (!reordering || !overlayEl || autoScrollDir === 0) {
      stopAutoScroll();
      return;
    }

    const rect = overlayEl.getBoundingClientRect();

    // intensity based on how deep into edge zone pointer is
    let intensity = 0;
    if (autoScrollDir < 0) {
      intensity = (rect.left + EDGE_PX - lastClientX) / EDGE_PX;
    } else {
      intensity = (lastClientX - (rect.right - EDGE_PX)) / EDGE_PX;
    }
    intensity = clamp01(intensity);

    const speed = Math.round(MAX_SPEED * intensity);
    if (speed > 0) {
      overlayEl.scrollLeft += autoScrollDir * speed;
      // while scrolling, keep placeholder updated
      updatePlaceholderFromPointer(lastClientX);
    }

    autoScrollRaf = requestAnimationFrame(tickAutoScroll);
  };

  const ensurePlaceholder = () => {
    if (placeholderEl) return;

    placeholderEl = document.createElement("div");
    placeholderEl.className = "inspectorPlaceholder";

    // inline style so you don’t need CSS
    const r = cardEl.getBoundingClientRect();
    placeholderEl.style.width = `${r.width}px`;
    placeholderEl.style.height = `${r.height}px`;
    placeholderEl.style.borderRadius = "18px";
    placeholderEl.style.border = "1px dashed rgba(255,255,255,0.22)";
    placeholderEl.style.background = "rgba(255,255,255,0.06)";
    placeholderEl.style.boxShadow = "inset 0 0 0 1px rgba(0,0,0,0.25)";

    trackEl.insertBefore(placeholderEl, cardEl.nextSibling);
  };

  const beginReorderMode = () => {
    reordering = true;
    lifted = false;
    clearTimeout(holdTimer);

    overlayEl.classList.add("reordering");
    overlayEl.classList.remove("liftDragging");
    overlayEl.style.overflowX = "auto"; // MUST allow scroll for auto-scroll

    ensurePlaceholder();

    // freeze the card’s “home” rect (so translation feels stable)
    dragStartRect = cardEl.getBoundingClientRect();
    draggingEl = cardEl;

    // lift visual a bit
    draggingEl.style.zIndex = "10010";
    draggingEl.style.opacity = "0.96";
    draggingEl.style.willChange = "transform";
    draggingEl.style.transition = "transform 0ms"; // no lag while dragging
  };

  const endReorderModeCommit = () => {
    stopAutoScroll();

    // Drop card into placeholder spot
    if (placeholderEl && trackEl && draggingEl) {
      trackEl.insertBefore(draggingEl, placeholderEl);
      placeholderEl.remove();
      placeholderEl = null;
    }

    // reset styles
    if (draggingEl) {
      draggingEl.style.transform = "";
      draggingEl.style.zIndex = "";
      draggingEl.style.opacity = "";
      draggingEl.style.transition = "transform 140ms cubic-bezier(.2,.9,.2,1)";
      draggingEl.style.willChange = "";
    }

    // commit new order to state
        // commit new order to state
    if (trackEl) {
      const ids = Array.from(trackEl.querySelectorAll(".inspectorCard"))
        .map(el => Number(el.dataset.cardId))
        .filter(n => Number.isFinite(n));

      if (dispatch) {
        const r = resolveOwnerZone(fromZoneKey);
        emitAction({ type: "REORDER_ZONE", owner: r.owner, zone: r.zone, ids });
      } else {
        setZoneArray(fromZoneKey, ids, { playerKey: ownerKey === "shared" ? undefined : ownerKey });
      }
    }


    // optional: center the card that was dragged
    if (CENTER_ON_DROP && draggingEl) {
      try {
        draggingEl.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
      } catch {}
    }

    reordering = false;
    draggingEl = null;
    dragStartRect = null;

    cleanupOverlay();
    render();
  };

  const endReorderModeCancel = () => {
    stopAutoScroll();

    // remove placeholder, put card back where it was (placeholder was after card)
    if (placeholderEl) {
      placeholderEl.remove();
      placeholderEl = null;
    }

    if (draggingEl) {
      draggingEl.style.transform = "";
      draggingEl.style.zIndex = "";
      draggingEl.style.opacity = "";
      draggingEl.style.transition = "";
      draggingEl.style.willChange = "";
    }

    reordering = false;
    draggingEl = null;
    dragStartRect = null;

    cleanupOverlay();
  };

  const updatePlaceholderFromPointer = (clientX) => {
    if (!trackEl || !placeholderEl || !draggingEl) return;

    // Decide where placeholder should go based on closest midpoint
    const cards = Array.from(trackEl.querySelectorAll(".inspectorCard")).filter(el => el !== draggingEl);

    // If there are no other cards, keep placeholder where it is
    if (cards.length === 0) return;

    // find best candidate by midpoint distance
    let best = null;
    let bestMid = 0;
    let bestDist = Infinity;

    for (const c of cards) {
      const r = c.getBoundingClientRect();
      const mid = r.left + r.width / 2;
      const d = Math.abs(clientX - mid);
      if (d < bestDist) {
        bestDist = d;
        best = c;
        bestMid = mid;
      }
    }

    if (!best) return;

    // Hysteresis: don’t flip-flop near the midpoint
    const br = best.getBoundingClientRect();
    const mid = bestMid;
    const dead = br.width * SWAP_HYSTERESIS;

    const insertBefore = clientX < (mid - dead) ? true : (clientX > (mid + dead) ? false : null);
    if (insertBefore === null) return; // in deadzone: do nothing

    // move placeholder (NOT the actual card) — much smoother
    if (insertBefore) {
      if (placeholderEl.nextSibling === best) return; // already right before best
      trackEl.insertBefore(placeholderEl, best);
    } else {
      if (best.nextSibling === placeholderEl) return; // already right after best
      trackEl.insertBefore(placeholderEl, best.nextSibling);
    }
  };

  const updateDraggingTransform = (clientX) => {
    if (!draggingEl || !dragStartRect) return;

    // translate relative to original rect center
    const dx = clientX - start.x;

    // subtle “lift” and tiny tilt makes it feel better
    draggingEl.style.transform = `translateX(${dx}px) translateY(-6px) rotate(${dx * 0.02}deg)`;
  };

  cardEl.addEventListener("pointerdown", (e) => {

    const pointerId = e.pointerId;
    try { cardEl.setPointerCapture(pointerId); } catch {}

    overlayEl = document.getElementById("inspectorOverlay");
    trackEl = overlayEl?.querySelector(".inspectorTrack") || null;

    if (!overlayEl || !trackEl) return;

    start = { x: e.clientX, y: e.clientY };
    lastClientX = e.clientX;
    lifted = false;
    reordering = false;

    // wipe stale states
    cleanupOverlay();
    stopAutoScroll();

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
      overlayEl.classList.remove("reordering");
      overlayEl.style.overflowX = "hidden"; // lift-mode: don't scroll

      const ghost = document.createElement("div");
      ghost.className = "dragGhost";
      ghost.textContent = cardId;
      ghost.style.pointerEvents = "none";
      dragLayer.appendChild(ghost);
      positionGhost(ghost, e.clientX, e.clientY);

      inspectorDragging = { cardId, fromZoneKey, ghostEl: ghost, pointerId };
      showDock(true);
      renderBoardOverlay();
      syncDropTargetHighlights(null);

      if (navigator.vibrate) navigator.vibrate(10);
    };

    holdTimer = setTimeout(lift, 260);

    const onMove = (ev) => {
      lastClientX = ev.clientX;

      const dx = ev.clientX - start.x;
      const dy = ev.clientY - start.y;

      // Decide reorder vs lift
      if (!lifted && !reordering) {
        if (Math.abs(dx) > ACTIVATION_DX && Math.abs(dx) > Math.abs(dy)) {
          beginReorderMode();
        }

        // if they move a lot vertically, cancel lift timer
        if (!reordering && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
          clearTimeout(holdTimer);
        }
      }

      // Reorder mode
      if (reordering) {
        updateDraggingTransform(ev.clientX);
        updatePlaceholderFromPointer(ev.clientX);
        updateAutoScrollDir(ev.clientX);
        return;
      }

      // Lift-mode ghost drag to zones
      if (inspectorDragging?.ghostEl) {
        ev.preventDefault();
        positionGhost(inspectorDragging.ghostEl, ev.clientX, ev.clientY);
        const overZoneKey = hitTestZone(ev.clientX, ev.clientY);
        syncDropTargetHighlights(overZoneKey);
      }
    };

    const onUp = (ev) => {
      ev.preventDefault();
      clearTimeout(holdTimer);

      // Reorder commit
      if (reordering) {
        endReorderModeCommit();
        cancel();
        return;
      }

      // Lift-mode drop
      if (inspectorDragging) {
        const overZoneKey = hitTestZone(ev.clientX, ev.clientY);

        const g = inspectorDragging.ghostEl;
        if (g && g.parentNode) g.parentNode.removeChild(g);

        removeBoardOverlay();
        syncDropTargetHighlights(null);

        if (overZoneKey) moveCard(inspectorDragging.cardId, inspectorDragging.fromZoneKey, overZoneKey);

        inspectorDragging = null;
        showDock(false);
        cleanupOverlay();
        render();
      }

      cancel();
    };

    const onCancel = (ev) => {
      ev.preventDefault();
      clearTimeout(holdTimer);

      if (reordering) endReorderModeCancel();

      if (inspectorDragging) {
        const g = inspectorDragging.ghostEl;
        if (g && g.parentNode) g.parentNode.removeChild(g);

        removeBoardOverlay();
        syncDropTargetHighlights(null);

        inspectorDragging = null;
        showDock(false);
        cleanupOverlay();
        render();
      }

      cancel();
    };

    cardEl.addEventListener("pointermove", onMove, { passive: false });
    cardEl.addEventListener("pointerup", onUp, { passive: false });
    cardEl.addEventListener("pointercancel", onCancel, { passive: false });
  }, { passive: false });
}


  

function renderInspector(zoneKey) {
  removeInspectorOverlay(); // prevents stacking
  const ownerKey = getZoneOwnerKey(zoneKey);
  const zoneCards = getZoneArray(zoneKey, { playerKey: ownerKey === "shared" ? undefined : ownerKey });

  const overlay = document.createElement("div");
  overlay.id = "inspectorOverlay";
  overlay.className = "inspectorOverlay";

  overlay.addEventListener("click", (e) => {
    if (inspectorDragging) return;
    if (e.target === overlay) {
      inspector = null;
      removeInspectorOverlay();
      render();
    }
  });

  const closeBtn = document.createElement("button");
  closeBtn.className = "inspectorCloseBtn";
  closeBtn.textContent = "✕";
  closeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    inspector = null;

    removeInspectorOverlay();
    removeBoardOverlay();
    syncDropTargetHighlights(null);

    inspectorDragging = null;
    showDock(false);

    render();
  });

  const track = document.createElement("div");
  track.className = "inspectorTrack";

  if (zoneCards.length === 0) {
    const empty = document.createElement("div");
    empty.className = "inspectorEmpty";
    empty.innerHTML = "<div>🗄️</div><p>No cards in this zone.</p>";
    track.appendChild(empty);
  } else {
    zoneCards.forEach((id) => {
      const data = window.CARD_REPO?.[String(id)] || {};
      const card = document.createElement("div");
      card.className = "inspectorCard";
      card.dataset.cardId = String(id);
      card.style.touchAction = "none";

      // Art
      const img = document.createElement("img");
      const src = getCardImgSrc(id, { playerKey: getActivePlayerKey() });
      if (src) {
        img.src = src;
        img.onerror = () => img.remove(); // silhouette fallback
        card.appendChild(img);
      }

      // Mana cost (top-center)
      const costStr = getCardCostString(id);
      const costEl = renderManaCostOverlay(costStr, { mode: "inspector" });
      if (costEl) card.appendChild(costEl);

      const name = document.createElement("div");
      name.className = "inspectorName";
      name.textContent = data.name || `Card ${id}`;
      card.appendChild(name);

      if (Number.isFinite(data.power) && Number.isFinite(data.toughness)) {
        const pt = document.createElement("div");
        pt.className = "inspectorPT";
        pt.textContent = `${data.power}|${data.toughness}`;
        card.appendChild(pt);
      }

      attachInspectorLongPress(card, id, zoneKey, ownerKey);

      // allow tap/tarp from inspector too (not in hand)
      if (zoneKey !== "hand") attachTapStates(card, id);

      const marks = getMarkMaps();
      if (marks.tapped?.[String(id)]) card.classList.add("tapped");
      if (marks.tarped?.[String(id)]) card.classList.add("tarped");

      track.appendChild(card);
    });
  }

  overlay.appendChild(closeBtn);
  overlay.appendChild(track);
  document.body.appendChild(overlay);
}
  
function renderDropArea(zoneKey, opts = {}) {
  const { overlay = false } = opts;

  ensureZoneArrays();

  const area = document.createElement("section");
  area.className = "dropArea";
  area.dataset.zoneKey = zoneKey;
  area.dataset.ownerKey = getZoneOwnerKey(zoneKey);
  area.classList.add(`zone-${zoneKey}`);

  const isOpp = (zoneKey === "opponentLands" || zoneKey === "opponentPermanents");
  if (isOpp) area.classList.add("isOpponentZone");

  // keep existing special-casing for battle hand owner tag
  if (zoneKey === "hand" && getMode() === "battle") {
    const owner = getActivePlayerKey();
    area.dataset.ownerKey = owner;
    area.classList.add(`owner-${owner}`);
  }

  const zoneArr = getZoneArray(zoneKey);
  const zMeta = ZONES.find(z => z.key === zoneKey) || { label: zoneKey, kind: "row" };

 // ===== PILES (stack / deck / graveyard) =====
if (zMeta.kind === "pile") {
  area.classList.add("isPile");

  const pile = document.createElement("div");
  pile.className = "pileSilhouette";

  const pileCard = document.createElement("div");
  pileCard.className = "miniCard pileCard";
  pileCard.dataset.cardId = "__PILE__";
  pileCard.dataset.fromZoneKey = zoneKey;

  // Count badge
  const count = document.createElement("div");
  count.className = "pileCount";
  count.textContent = String(zoneArr.length);
  pileCard.appendChild(count);

  // Title INSIDE silhouette
  const inLabel = document.createElement("div");
  inLabel.className = "pileInnerLabel";
  inLabel.textContent = (zoneKey === "stack") ? "THE STACK" : zMeta.label;
  pileCard.appendChild(inLabel);

  // Special: magical stack intensity (1..10)
  if (zoneKey === "stack") {
    const intensity = Math.max(0, Math.min(10, zoneArr.length)); // 0..10
    pileCard.classList.add("stackPileCard");
    pileCard.style.setProperty("--stackI", String(intensity));
    pileCard.style.setProperty("--stackOn", zoneArr.length > 0 ? "1" : "0");
  }

  pile.appendChild(pileCard);
  area.appendChild(pile);

  if (!overlay) {
    if (zoneKey === "deck") {
      attachDeckDrawDoubleTap(pileCard);
    } else {
      pileCard.addEventListener("click", (e) => {
        e.stopPropagation();
        if (dragging || inspectorDragging) return;
        inspector = { zoneKey };
        render();
      });
    }

    pileCard.addEventListener("pointerdown", onPilePointerDown, { passive: false });
  }

  return area;
}


  // ===== NON-PILE zones: click -> inspector (unless overlay) =====
  if (!overlay) {
    area.addEventListener("click", () => {
      inspector = { zoneKey };
      render();
    });
  }

  const row = document.createElement("div");
  row.className = "slotRow";

  const ids = zoneArr;

  // ===== HAND =====
  if (zoneKey === "hand") {
    for (let i = 0; i < ids.length; i++) {
      row.appendChild(makeMiniCardEl(ids[i], zoneKey, { overlay, flipped: false }));
    }
    layoutHandFan(row, ids);
    area.appendChild(row);
    return area;
  }

  // ===== battlefield rows =====
  const minSlots = 6;
  const slotCount = Math.max(minSlots, ids.length + 1);

  for (let i = 0; i < slotCount; i++) {
    const slot = document.createElement("div");
    slot.className = "slot";

    const id = ids[i];
    if (id !== undefined) {
const c = makeMiniCardEl(id, zoneKey, { overlay, flipped: false });
if (!overlay) {
  attachTapStates(c, id);
}

      slot.appendChild(c);
    }

    row.appendChild(slot);
  }

  area.appendChild(row);
  return area;
}



function renderZoneTile(zoneKey, label, clickable) {
  const tile = document.createElement("section");
  tile.className = "zoneTile";
  tile.dataset.zoneKey = zoneKey;

  const head = document.createElement("div");
  head.className = "zoneHead";

  const left = document.createElement("div");
  left.className = "zoneName";
  left.textContent = label;

  const right = document.createElement("div");
  right.className = "zoneMeta";
  right.textContent = `${getZoneArray(zoneKey).length} cards`;

  head.appendChild(left);
  head.appendChild(right);

  const preview = document.createElement("div");
  preview.className = "previewRow";

  const cards = getZoneArray(zoneKey);
  const max = 9;

  cards.slice(0, max).forEach((id) => {
    // Note: these will be draggable because overlay:false.
    // If you *don’t* want drag from previews, set overlay:true and style them smaller.
    const p = makeMiniCardEl(id, zoneKey, { overlay: true });
    preview.appendChild(p);
  });

  tile.appendChild(head);
  tile.appendChild(preview);

  if (clickable) {
    let lastTapAt = 0;
    let singleTimer = null;
    const dblMs = 320;

    tile.addEventListener("click", () => {
      if (dragging || inspectorDragging) return;

      const now = performance.now();

      // double tap
      if (now - lastTapAt <= dblMs) {
        if (singleTimer) clearTimeout(singleTimer);
        singleTimer = null;
        lastTapAt = 0;

        inspector = null; // close inspector if open
        removeInspectorOverlay();
        view = { type: "focus", zoneKey };
        render();
        return;
      }

      // single tap (defer slightly in case it becomes a double)
      lastTapAt = now;
      if (singleTimer) clearTimeout(singleTimer);

      singleTimer = setTimeout(() => {
        singleTimer = null;
        inspector = { zoneKey };
        render();
      }, dblMs);
    });
  }

  return tile;
}
  
function renderFocus(zoneKey) {
  const container = document.createElement("div");
  container.className = "focusView";

  const top = document.createElement("div");
  top.className = "focusTop";
  container.appendChild(top);

  const board = document.createElement("div");
  board.className = "board focusBoard";

  // TOP (mirrored opponent battlefield)
  ["opponentLands", "opponentPermanents"].forEach((k) => {
    const area = renderDropArea(k);
    if (k === zoneKey) area.classList.add("isFocusZone");
    board.appendChild(area);
  });

  // middle divider (purely structural; no text)
  const mid = document.createElement("div");
  mid.className = "midLine";
  board.appendChild(mid);

  // BOTTOM (your normal zones)
  ["permanents", "lands", "hand"].forEach((k) => {
    const area = renderDropArea(k);
    if (k === zoneKey) area.classList.add("isFocusZone");
    board.appendChild(area);
  });

  container.appendChild(board);
  return container;
}


  function onCardPointerDown(e) {
  
    const cardEl = e.currentTarget;
    const cardId = Number(cardEl.dataset.cardId);
    const fromZoneKey = cardEl.dataset.fromZoneKey;

    // small press-hold before lifting
    const pointerId = e.pointerId;
    try { cardEl.setPointerCapture(pointerId); } catch {}

    const start = { x: e.clientX, y: e.clientY, t: performance.now() };
    let lifted = false;
    let holdTimer = null;

    const cancelAll = () => {
      clearTimeout(holdTimer);
      try { cardEl.releasePointerCapture(pointerId); } catch {}
      cardEl.removeEventListener("pointermove", onMove);
      cardEl.removeEventListener("pointerup", onUp);
      cardEl.removeEventListener("pointercancel", onCancel);
    };

    const lift = () => {
      if (lifted) return;
      lifted = true;

      const ghost = document.createElement("div");
      ghost.className = "dragGhost";
      ghost.textContent = cardId;
      ghost.style.pointerEvents = "none";
      dragLayer.appendChild(ghost);
      positionGhost(ghost, e.clientX, e.clientY);

      dragging = { cardId, fromZoneKey, ghostEl: ghost, pointerId };
      debugLog({ event: "dragStart", cardId, fromZone: fromZoneKey, sourcePlayer: getActivePlayerKey() });
      syncDropTargetHighlights(null);

      // little vibration if supported
      if (navigator.vibrate) navigator.vibrate(10);
    };

    holdTimer = setTimeout(lift, 320);

    const onMove = (ev) => {
      const dx = ev.clientX - start.x;
      const dy = ev.clientY - start.y;

// ✅ Do NOT auto-lift into drag just because of tiny movement (mobile jitter).
// But also do NOT cancel hold unless the user is clearly scrolling.
if (!lifted) {
  const movedFar = (Math.abs(dx) > 22 || Math.abs(dy) > 22);
  if (movedFar) {
    clearTimeout(holdTimer); // they’re likely scrolling, not trying to drag a card
  }
}



      if (dragging?.ghostEl) {
        ev.preventDefault();
        positionGhost(dragging.ghostEl, ev.clientX, ev.clientY);
        const overZoneKey = hitTestZone(ev.clientX, ev.clientY);
        syncDropTargetHighlights(overZoneKey);
      }
    };

    const onUp = (ev) => {
      clearTimeout(holdTimer);

      if (!lifted || !dragging) {
        // Keep native click synthesis for tap/double-tap interactions
        // when no drag action was started.
        cancelAll();
        return;
      }

      ev.preventDefault();

      const dropZoneKey = hitTestZone(ev.clientX, ev.clientY);
      debugLog({ event: "dropCommit", cardId, fromZone: fromZoneKey, toZone: dropZoneKey || null, sourcePlayer: getActivePlayerKey() });
      finalizeDrop(dropZoneKey);

      cancelAll();
    };

    const onCancel = (ev) => {
      ev.preventDefault();
      clearTimeout(holdTimer);
      debugLog({ event: "cancel", cardId, fromZone: fromZoneKey, sourcePlayer: getActivePlayerKey() });
      if (dragging) finalizeDrop(null);
      cancelAll();
    };

    cardEl.addEventListener("pointermove", onMove, { passive: false });
    cardEl.addEventListener("pointerup", onUp, { passive: false });
    cardEl.addEventListener("pointercancel", onCancel, { passive: false });
  }

  function positionGhost(el, x, y) {
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
  }

function hitTestZone(x, y) {
  const els = document.elementsFromPoint(x, y);

  for (const el of els) {
    if (!el) continue;
    if (el.id === "dragLayer" || el.classList?.contains("dragGhost")) continue;

    // direct dropArea
    if (el.classList?.contains("dropArea")) {
      const zoneKey = getDropAreaZoneKey(el);
      if (zoneKey) return zoneKey;
    }

    // nested inside dropArea (common with fixed bars and inner wrappers)
    const parent = el.closest?.(".dropArea");
    if (parent) {
      const zoneKey = getDropAreaZoneKey(parent);
      if (zoneKey) return zoneKey;
    }
  }

  return null;
}

function getDropAreaZoneKey(areaEl) {
  if (!areaEl?.dataset) return null;
  if (areaEl.dataset.zoneKey) return areaEl.dataset.zoneKey;

  const zone = areaEl.dataset.zone;
  if (!zone) return null;

  if (zone === "opponentLands" || zone === "opponentPermanents") return zone;

  if (zone === "lands" || zone === "permanents") {
    const owner = areaEl.dataset.owner;
    if (getMode() === "battle" && owner && owner !== getActivePlayerKey()) {
      return zone === "lands" ? "opponentLands" : "opponentPermanents";
    }
  }

  return zone;
}
  
 function syncDropTargetHighlights(activeZoneKey) {
  document.querySelectorAll(".dropArea").forEach(area => {
    const z = getDropAreaZoneKey(area);
    area.classList.toggle("active", !!activeZoneKey && z === activeZoneKey);
  });
}


function attachTapStates(el, cardId) {
  let tapCount = 0;
  let timer = null;
  let pointerStart = null;

  const windowMs = 420; // time window to detect 2 vs 3 taps
  const tapMovePx = 10;

  const registerTap = () => {
    if (dragging || inspectorDragging) return;

    tapCount++;

    if (timer) clearTimeout(timer);

    timer = setTimeout(() => {
      const key = String(cardId);

      if (dispatch) {
  const key = String(cardId);

  if (tapCount >= 3) {
    emitAction(
      { type: "TOGGLE_TAP", cardId, kind: "tarped" },
      () => {
        const marks = getMarkMaps();
        const next = !marks.tarped[key];
        marks.tarped[key] = next;
        marks.tapped[key] = false;
      }
    );
  } else if (tapCount === 2) {
    emitAction(
      { type: "TOGGLE_TAP", cardId, kind: "tapped" },
      () => {
        const marks = getMarkMaps();
        const next = !marks.tapped[key];
        marks.tapped[key] = next;
        marks.tarped[key] = false;
      }
    );
  }

  tapCount = 0;
  timer = null;
  return;
}


      // Local legacy behavior
      const marks = getMarkMaps();

      if (tapCount >= 3) {
        const next = !marks.tarped[key];
        marks.tarped[key] = next;
        marks.tapped[key] = false;

        el.classList.toggle("tarped", next);
        el.classList.remove("tapped");
      } else if (tapCount === 2) {
        const next = !marks.tapped[key];
        marks.tapped[key] = next;
        marks.tarped[key] = false;

        el.classList.toggle("tapped", next);
        el.classList.remove("tarped");
      }

      tapCount = 0;
      timer = null;
    }, windowMs);
  };

  el.addEventListener("pointerdown", (e) => {
    pointerStart = { x: e.clientX, y: e.clientY };
  });

  el.addEventListener("pointerup", (e) => {
    if (!pointerStart) return;

    const dx = e.clientX - pointerStart.x;
    const dy = e.clientY - pointerStart.y;
    pointerStart = null;

    // ignore if they actually moved (drag intent)
    if (Math.hypot(dx, dy) > tapMovePx) return;

    registerTap();
  });

  // ✅ IMPORTANT: no click fallback here.
  // It causes double-counting on many browsers because click is synthesized after pointerup.
}






  
function finalizeDrop(toZoneKey) {
  const d = dragging;
  if (!d) return;

  // remove ghost
  if (d.ghostEl && d.ghostEl.parentNode) d.ghostEl.parentNode.removeChild(d.ghostEl);

  const from = d.fromZoneKey;
  const cardId = d.cardId;

  // snap-back if invalid drop or same zone
  if (!toZoneKey || toZoneKey === from) {
    debugLog({ event: "cancel", cardId, fromZone: from, toZone: toZoneKey || null, sourcePlayer: getActivePlayerKey() });
    dragging = null;
    syncDropTargetHighlights(null);
    return;
  }

  dragging = null;
  syncDropTargetHighlights(null);

  // ✅ IMPORTANT: route through moveCard so deck logic works
  moveCard(cardId, from, toZoneKey);

  // render (moveCard may open chooser which also calls render)
  render();
}

function attachDeckDrawDoubleTap(deckAreaEl) {
  let lastTapAt = 0;
  const dblMs = 320;

  deckAreaEl.addEventListener("click", (e) => {
    // We want deck area click to either inspect (single)
    // or draw (double). Prevent bubbling to focus handlers.
    e.stopPropagation();

    if (dragging || inspectorDragging) return;

    const now = performance.now();
    const isDouble = (now - lastTapAt) <= dblMs;

    lastTapAt = now;

    if (isDouble) {
      lastTapAt = 0;
      drawOneFromDeckWithAnimation();
      return;
    }

    // single tap => inspector
    setTimeout(() => {
      // if a second tap happened, lastTapAt got reset to 0
      if (lastTapAt === 0) return;
      inspector = { zoneKey: "deck" };
      render();
    }, dblMs + 10);
  });
}

function drawOneFromDeckWithAnimation() {
  ensureZoneArrays();

  const deck = getZoneArray("deck");
  if (!deck || deck.length === 0) return;

  // --- snapshot old hand ids + their DOM rects (for shift animation) ---
  const oldHandIds = [...getZoneArray("hand")];
  const oldRects = new Map();

  const ownerSel = getMode() === "battle" ? `[data-owner-key="${getActivePlayerKey()}"]` : "";

  oldHandIds.forEach((id) => {
    const el = document.querySelector(`.zone-hand${ownerSel} .miniCard[data-card-id="${id}"]`);
    if (el) oldRects.set(id, el.getBoundingClientRect());
  });

  // Deck pile rect for the fly-in
  const pileEl = document.querySelector(".zone-deck .pileCard");
  const fromRect = pileEl?.getBoundingClientRect?.();

  // --- update state: draw TOP card and insert LEFTMOST in hand ---
  const cardId = deck[0];

 if (dispatch) {
  const owner = resolveOwnerZone("deck").owner;
  emitAction(
    { type: "DRAW_CARD", owner },
    () => {
      const d = getZoneArray("deck", { playerKey: owner === "p1" || owner === "p2" ? owner : undefined });
      const h = getZoneArray("hand", { playerKey: owner === "p1" || owner === "p2" ? owner : undefined });
      if (!d.length) return;
      const drawn = d.shift();
      h.unshift(drawn);
    }
  );
} else {
  deck.shift();
  getZoneArray("hand").unshift(cardId);
}


  // Render new state so new hand layout exists in DOM
  render();


  // Hide real hand cards during animation to avoid “double”
  const handZone = document.querySelector(`.zone-hand${ownerSel}`);
  const realHandCards = handZone ? Array.from(handZone.querySelectorAll(".miniCard")) : [];
  realHandCards.forEach(el => (el.style.visibility = "hidden"));

  // --- build + animate shift ghosts for old cards (they move right) ---
  const ghosts = [];

  oldHandIds.forEach((id) => {
    const start = oldRects.get(id);
    const endEl = document.querySelector(`.zone-hand${ownerSel} .miniCard[data-card-id="${id}"]`);
    const end = endEl?.getBoundingClientRect?.();

    if (!start || !end) return;

    const g = document.createElement("div");
    g.className = "handShiftGhost";

    const src = getCardImgSrc(id, { playerKey: getActivePlayerKey() });
    if (src) g.style.backgroundImage = `url("${src}")`;

    g.style.left = `${start.left}px`;
    g.style.top = `${start.top}px`;
    g.style.width = `${start.width}px`;
    g.style.height = `${start.height}px`;

    document.body.appendChild(g);

    // Force layout
    g.getBoundingClientRect();

    const dx = end.left - start.left;
    const dy = end.top - start.top;

    // Fun little wobble/tilt based on distance
    const tilt = Math.max(-7, Math.min(7, dx * 0.02));

    g.style.transform = `translate(${dx}px, ${dy}px) rotate(${tilt}deg)`;
    ghosts.push(g);
  });

  // --- fly the NEW drawn card from deck -> its new leftmost spot ---
  requestAnimationFrame(() => {
    const toEl = document.querySelector(`.zone-hand${ownerSel} .miniCard[data-card-id="${cardId}"]`);
    if (!toEl) {
      // cleanup + show cards anyway
      ghosts.forEach(g => g.remove());
      realHandCards.forEach(el => (el.style.visibility = ""));
      return;
    }

    const toRect = toEl.getBoundingClientRect();

    if (fromRect) {
      animateCardFlight(cardId, fromRect, toEl, () => {});
    }

    // After everything finishes, reveal real hand and remove ghosts
    const TOTAL_MS = 620; // should match CSS durations below (shift + fly)
    setTimeout(() => {
      ghosts.forEach(g => g.remove());
      realHandCards.forEach(el => (el.style.visibility = ""));

      // tiny glow pulse so it's satisfying
      try {
        toEl.animate(
          [
            { filter: "drop-shadow(0 0 0 rgba(130,180,255,0.0))" },
            { filter: "drop-shadow(0 0 18px rgba(130,180,255,0.65))" },
            { filter: "drop-shadow(0 0 0 rgba(130,180,255,0.0))" },
          ],
          { duration: 520, easing: "cubic-bezier(.2,.9,.2,1)" }
        );
      } catch {}
    }, TOTAL_MS);
  });
}

function animateCardFlight(cardId, fromRect, toEl, done) {
  const toRect = toEl.getBoundingClientRect();

  const ghost = document.createElement("div");
  ghost.className = "flyCard";

  // Try to use image if available
  const src = getCardImgSrc(cardId, { playerKey: getActivePlayerKey() });
  if (src) ghost.style.backgroundImage = `url("${src}")`;

  // Start at deck pile center
  const startX = fromRect.left + fromRect.width / 2;
  const startY = fromRect.top + fromRect.height / 2;

  // End at target card center
  const endX = toRect.left + toRect.width / 2;
  const endY = toRect.top + toRect.height / 2;

  ghost.style.left = `${startX}px`;
  ghost.style.top = `${startY}px`;

  document.body.appendChild(ghost);

  // Force layout
  ghost.getBoundingClientRect();

  const dx = endX - startX;
  const dy = endY - startY;

  // Fly + scale + a bit of extra lift for readability
  ghost.style.transform = `translate(${dx}px, ${dy - 18}px) scale(1.08) rotate(6deg)`;

  const cleanup = () => {
    ghost.removeEventListener("transitionend", cleanup);
    if (ghost.parentNode) ghost.parentNode.removeChild(ghost);
    if (typeof done === "function") done();
  };

  ghost.addEventListener("transitionend", cleanup);
}

function openDeckPlacementChooser(cardId, fromZoneKey) {
  ensureZoneArrays();

   // Remove from origin immediately ONLY in legacy local mode.
  // In dispatch mode, we keep state unchanged until commit() emits DECK_PLACE.
  if (!dispatch) {
    const fromArr = getZoneArray(fromZoneKey);
    const idx = fromArr.indexOf(cardId);
    if (idx >= 0) fromArr.splice(idx, 1);
  }


  // Build overlay
  const ov = document.createElement("div");
  ov.id = "deckChoiceOverlay";
  ov.className = "deckChoiceOverlay";

  const card = document.createElement("div");
  card.className = "deckChoiceCard";
  card.dataset.cardId = String(cardId);

  const imgSrc = getCardImgSrc(cardId, { playerKey: getActivePlayerKey() });
  if (imgSrc) card.style.backgroundImage = `url("${imgSrc}")`;

  const hint = document.createElement("div");
  hint.className = "deckChoiceHint";
  hint.textContent = "Swipe → TOP • Swipe ← BOTTOM";

  const btnRow = document.createElement("div");
  btnRow.className = "deckChoiceButtons";

  const btnBottom = document.createElement("button");
  btnBottom.className = "deckChoiceBtn bottom";
  btnBottom.textContent = "Bottom";

  const btnTop = document.createElement("button");
  btnTop.className = "deckChoiceBtn top";
  btnTop.textContent = "Top";

  btnRow.appendChild(btnBottom);
  btnRow.appendChild(btnTop);

  ov.appendChild(card);
  ov.appendChild(hint);
  ov.appendChild(btnRow);
  document.body.appendChild(ov);

   const commit = (where) => {
    if (dispatch) {
      const fromR = resolveOwnerZone(fromZoneKey);
      const deckR = resolveOwnerZone("deck"); // owner of the deck we are placing into

      emitAction({
        type: "DECK_PLACE",
        cardId,
        from: { owner: fromR.owner, zone: fromR.zone },
        owner: deckR.owner,
        where: where === "top" ? "top" : "bottom",
      });
    } else {
      const deck = getZoneArray("deck");
      if (where === "top") deck.unshift(cardId);
      else deck.push(cardId);
    }

    ov.remove();
    render();
  };

  const cancel = () => {
    if (!dispatch) {
      // If they back out, put it back where it came from (end)
      getZoneArray(fromZoneKey).push(cardId);
    }
    ov.remove();
    render();
  };


  btnTop.addEventListener("click", (e) => { e.stopPropagation(); commit("top"); });
  btnBottom.addEventListener("click", (e) => { e.stopPropagation(); commit("bottom"); });

  // Click outside cancels
  ov.addEventListener("click", (e) => {
    if (e.target === ov) cancel();
  });

  // Swipe logic
  let startX = 0, startY = 0, active = false;

  card.addEventListener("pointerdown", (e) => {
    e.preventDefault();
    active = true;
    startX = e.clientX;
    startY = e.clientY;
    try { card.setPointerCapture(e.pointerId); } catch {}
    card.style.transition = "transform 0ms";
  }, { passive: false });

  card.addEventListener("pointermove", (e) => {
    if (!active) return;
    e.preventDefault();

    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    // Tinder-ish: mostly horizontal
    const rot = Math.max(-12, Math.min(12, dx * 0.06));
    card.style.transform = `translate(${dx}px, ${dy * 0.15}px) rotate(${rot}deg)`;
  }, { passive: false });

  card.addEventListener("pointerup", (e) => {
    if (!active) return;
    active = false;
    e.preventDefault();

    const dx = e.clientX - startX;

    // Threshold: swipe right => top, left => bottom
    if (dx > 90) {
      card.style.transition = "transform 140ms cubic-bezier(.2,.9,.2,1)";
      card.style.transform = "translate(220px, 0) rotate(12deg)";
      setTimeout(() => commit("top"), 120);
      return;
    }
    if (dx < -90) {
      card.style.transition = "transform 140ms cubic-bezier(.2,.9,.2,1)";
      card.style.transform = "translate(-220px, 0) rotate(-12deg)";
      setTimeout(() => commit("bottom"), 120);
      return;
    }

    // Snap back if not far enough
    card.style.transition = "transform 160ms cubic-bezier(.2,.9,.2,1)";
    card.style.transform = "translate(0,0) rotate(0deg)";
  }, { passive: false });

  card.addEventListener("pointercancel", () => {
    active = false;
    card.style.transition = "transform 160ms cubic-bezier(.2,.9,.2,1)";
    card.style.transform = "translate(0,0) rotate(0deg)";
  });
}

function renderTopPilesBar() {
  // create or reuse a stable container
  let host = document.getElementById("topPiles");
  if (!host) {
    host = document.createElement("div");
    host.id = "topPiles";
    document.body.appendChild(host);
  }

  // only show in focus mode
  if (view?.type !== "focus") {
    host.innerHTML = "";
    host.style.display = "none";

    // keep it out of the topbar in overview
    if (host.parentNode && host.parentNode !== document.body) {
      document.body.appendChild(host);
    }
    return;
  }

  // ensure it sits inside the topbar (where subtitle used to be)
  const topbar = document.querySelector(".topbar");
  if (topbar && host.parentNode !== topbar) topbar.appendChild(host);

  host.style.display = "flex";
  host.innerHTML = "";

  const stackArea = renderDropArea("stack");
  stackArea.classList.add("pileCompactTop");

  const deckArea = renderDropArea("deck");
  deckArea.classList.add("pileCompactTop");

  const gyArea = renderDropArea("graveyard");
  gyArea.classList.add("pileCompactTop");

  host.appendChild(stackArea);
  host.appendChild(deckArea);
  host.appendChild(gyArea);

  if (getMode() === "battle") {
    const swapBtn = document.createElement("button");
    swapBtn.className = "topSwapBtn";
    const active = getPlayer(getActivePlayerKey());
    swapBtn.textContent = `View ${active.name === "Player 1" ? "P2" : "P1"}`;
    swapBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      state.activePlayerKey = getActivePlayerKey() === "p1" ? "p2" : "p1";
      inspector = null;
      render();
    });
    host.appendChild(swapBtn);
  }
}


function onPilePointerDown(e) {
  // ✅ Do NOT preventDefault; it can stop click synthesis on mobile
  e.stopPropagation();
}




// Strong mobile back: pointerup works much more reliably than click
const shouldBindLegacyBackButton = opts?.bindBackButton === true || opts?.hosted !== true;
if (shouldBindLegacyBackButton) {
  (function bindBackButton() {
    const btn = document.querySelector(".topBackBtn");
    if (!btn) return;

    btn.type = "button";
    btn.style.touchAction = "manipulation";

    // prevent double-binding if render runs multiple times
    if (btn.__cbLegacyBackHandler) {
      btn.removeEventListener("pointerup", btn.__cbLegacyBackHandler);
    }

    const onBack = (e) => {
      e.preventDefault();
      e.stopPropagation();
      goBackToOverview();
    };

    btn.__cbLegacyBackHandler = onBack;
    btn.addEventListener("pointerup", onBack, { passive: false });
  })();
}








  

// ✅ MUST call render once to mount UI
render();


    // ============================
    // END of legacy body
    // ============================

    // Mount returns an unmount cleanup
      return {
      invalidate() {
        // Host can call this after authoritative room_state updates
        try { updateSubtitle(); } catch {}
        try { render(); } catch {}
      },
      unmount() {
        try { if (intervalId) clearInterval(intervalId); } catch {}
        try {
          const btn = document.querySelector(".topBackBtn");
          if (btn?.__cbLegacyBackHandler) {
            btn.removeEventListener("pointerup", btn.__cbLegacyBackHandler);
            delete btn.__cbLegacyBackHandler;
          }
        } catch {}
        try {
          const io = document.getElementById("inspectorOverlay");
          if (io) io.remove();
          const bo = document.getElementById("boardOverlay");
          if (bo) bo.remove();
          const dc = document.getElementById("deckChoiceOverlay");
          if (dc) dc.remove();
        } catch {}
        try { root.replaceChildren(); } catch {}
      }
    };
  }

  window.LegacySandbox = { mount };
})();




  


// What changed / how to test:
// - Added saved-deck integration across deckbuilder and 2P battle with per-seat selection + robust deck application.
// - Added battle deck chooser panel and safe applyDeckToBattleState cloning/validation.
// - Test: save deck in deckbuilder, enter battle lobby, choose deck for P1/P2, join/create room, verify decks are shuffled + draw works.
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
    const BATTLE_DECK_KEY_P1 = "cb_battle_deck_p1";
    const BATTLE_DECK_KEY_P2 = "cb_battle_deck_p2";
    const ALL_ZONES = ["permanents", "lands", "hand", "stack", "deck", "graveyard", "opponentPermanents", "opponentLands"];
    const BATTLEFIELD_ZONES = ["lands", "permanents", "opponentPermanents", "opponentLands"];
    const SHARED_ZONES = ["stack"];
    const PRIVATE_ZONES = ["hand", "deck", "graveyard"];
    const PILE_ZONES = ["stack", "deck", "graveyard"];
    const demo = window.DEMO_STATE || { zones: { hand: [], lands: [], permanents: [] }, tapped: {}, tarped: {} };
    const deckbuilderApi = window.CardboardDeckbuilder || null;
    const DECKBUILDER_DEFAULTS = deckbuilderApi?.DEFAULTS || {
      deckSize: 40,
      targetValueSum: 0,
      targetDeckScore: 0,
      includeLands: true,
      seed: 1337
    };

    function isHumanMenuInteractionActive() {
      const el = document.activeElement;
      return !!(el && el.tagName === "SELECT" && el.dataset?.stickyMenu === "1");
    }

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
    const DEBUG_BATTLE = false;
    const MOVE_DEBUG = false;
    const DEBUG_DND = !!window.CARDBOARD_DEBUG_DND;
    const moveDebug = (stage, payload = {}) => {
      if (!MOVE_DEBUG) return;
      console.info("[move]", {
        stage,
        roomId: battleRoomId || null,
        playerId: session.playerId || null,
        playerRole: session.role || null,
        ...payload
      });
    };
    const exitDebug = (reason, payload = {}) => {
      console.info("[ui-exit]", {
        reason,
        uiScreen,
        appMode,
        roomId: battleRoomId || null,
        playerId: session.playerId || null,
        playerRole: session.role || null,
        ...payload
      });
    };

    let session = { playerId: null, playerName: null, role: null };
    let playerRegistry = loadPlayerRegistry();
    let saveTimer = null;

    let sandboxState = createSandboxState();
    let deckbuilderState = deckbuilderApi?.normalizeState ? deckbuilderApi.normalizeState(null) : { settings: { ...DECKBUILDER_DEFAULTS }, lastDeck: null };
    let savedDecks = [];
    let lastSelectedDeckId = "";
    let battleDeckSelections = { p1: "", p2: "" };

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

          if (MOVE_DEBUG) {
            console.info("[move]", { stage: "render", roomId: battleRoomId || null, serverStateVersion: battleState?.version ?? 0 });
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

      onBattleLeaveRoom: () => {
        exitDebug("battle_leave_room_callback");
        deckPlacementChoice = null;
      },
      onRoomsListChanged: (rooms) => {
        openRooms = Array.isArray(rooms) ? rooms : [];
        battleLobbyRoomsRequested = true;
        if (isHumanMenuInteractionActive()) {
          setTimeout(() => { if (!isHumanMenuInteractionActive()) renderApp(); }, 180);
          return;
        }
        renderApp();
      },
      uid,
      moveDebug,
      moveDebugEnabled: () => MOVE_DEBUG
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

// 2P authoritative state invariants:
// 1) A card exists in exactly one zone in authoritative state.
// 2) MOVE_CARD commits converge to identical state across clients after server sync.
// 3) Canceled drags never mutate authoritative state.
// 4) In 2P mode, server resolves move legality and ordering; client only sends intents.
// 5) DOM is a projection of battleState/sandboxState; no persistent DOM-only card position state.
//
// QC checklist (run after each movement fix):
// A) Sandbox: hand->battlefield, battlefield->graveyard/exile/hand, reorder, tap/rotate.
// B) 2P: P1 hand->battlefield mirrors on P2; P2 hand->battlefield mirrors on P1;
//    battlefield->other zones mirrors; opponent-zone drops (if allowed) mirror; 10 rapid drags;
//    simultaneous different-card moves converge.
// C) Regression: load library/pasted/saved decks in 2P; image fallback/resolution works; legacy flows render.
//
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

    function getCardDef(cardId) {
      const id = String(cardId);
      const raw = window.CARD_REPO?.[id] || {};
      if (typeof window.normalizeCardDef === "function") return window.normalizeCardDef(id, raw);
      return raw;
    }

    function deepClone(value) {
      if (typeof structuredClone === "function") return structuredClone(value);
      return JSON.parse(JSON.stringify(value));
    }

    function shuffleCopy(cards, seed = "") {
      const arr = deepClone(Array.isArray(cards) ? cards.map(String) : []);
      let h = 2166136261;
      const str = `${seed}|${arr.length}|${Date.now()}`;
      for (let i = 0; i < str.length; i += 1) h = Math.imul(h ^ str.charCodeAt(i), 16777619);
      const rand = () => {
        h += 0x6d2b79f5;
        let t = h;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
      };
      for (let i = arr.length - 1; i > 0; i -= 1) {
        const j = Math.floor(rand() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }

    function applyDeckToBattleState(playerKey, deckCards) {
      if (!battleState || !battleState.players?.[playerKey]) return;
      const shuffled = shuffleCopy(deckCards, `${playerKey}|${battleRoomId}`);
      const hand = shuffled.splice(0, 3);
      battleState.players[playerKey].zones = {
        hand,
        deck: shuffled,
        graveyard: [],
        lands: [],
        permanents: []
      };
    }

    function getDeckById(id) {
      if (!id) return null;
      const allDecks = typeof window.getAllAvailableDecks === "function"
        ? window.getAllAvailableDecks()
        : (window.CardboardDeckStorage?.getSavedDecks?.() || savedDecks || []);
      return allDecks.find((d) => d.id === id || d.deckId === id) || null;
    }

    function assignDeckForBattle(playerKey, deckObj) {
      const pk = playerKey === "p2" ? "p2" : "p1";
      const cards = typeof window.expandDeckCardIds === "function"
        ? window.expandDeckCardIds(deckObj)
        : (Array.isArray(deckObj?.cards) ? deckObj.cards.map(String) : []);
      const deckId = String(deckObj?.id || "");
      if (!cards.length) return false;
      if (pk === "p1") localStorage.setItem(BATTLE_DECK_KEY_P1, JSON.stringify({ id: deckId, cards }));
      else localStorage.setItem(BATTLE_DECK_KEY_P2, JSON.stringify({ id: deckId, cards }));
      battleDeckSelections[pk] = deckId;
      if (battleState?.players?.[pk]) {
        applyDeckToBattleState(pk, cards);
        battleClient.sendIntent("SET_DECK", { owner: pk, cards });
      }
      persistPlayerSaveDebounced();
      return true;
    }

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
          deckbuilderState,
          savedDecks: window.CardboardDeckStorage?.getSavedDecks?.() || savedDecks,
          lastSelectedDeckId,
          battleDeckSelections,
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
      deckbuilderState = deckbuilderApi?.normalizeState
        ? deckbuilderApi.normalizeState(save.deckbuilderState)
        : (save.deckbuilderState
          ? { settings: { ...DECKBUILDER_DEFAULTS, ...(save.deckbuilderState.settings || {}) }, lastDeck: save.deckbuilderState.lastDeck || null }
          : { settings: { ...DECKBUILDER_DEFAULTS }, lastDeck: null });
      savedDecks = (window.CardboardDeckStorage?.getSavedDecks?.() || (Array.isArray(save.savedDecks) ? save.savedDecks : []));
      lastSelectedDeckId = save.lastSelectedDeckId || "";
      const localP1 = JSON.parse(localStorage.getItem(BATTLE_DECK_KEY_P1) || "null");
      const localP2 = JSON.parse(localStorage.getItem(BATTLE_DECK_KEY_P2) || "null");
      battleDeckSelections = {
        p1: String(save?.battleDeckSelections?.p1 || localP1?.id || ""),
        p2: String(save?.battleDeckSelections?.p2 || localP2?.id || "")
      };
      appMode = null;
      exitDebug("set_active_player", { nextScreen: "mainMenu" });
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

      exitDebug("back_from_battle_mode", { nextScreen: "mainMenu" });
      battleClient.leaveRoom();
      battleLobbyRoomsRequested = false;
    }

    exitDebug("back_to_main_menu", { nextScreen: "mainMenu" });
    uiScreen = "mainMenu";
    appMode = null;
  } else if (uiScreen === "mainMenu") {
    exitDebug("back_to_player_menu", { nextScreen: "playerMenu" });
    uiScreen = "playerMenu";
  }

  renderApp();
}


    function cardName(cardId) {
      const data = getCardDef(cardId);
      return data?.name || `Card ${cardId}`;
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
      const data = getCardDef(cardId);
      return (data.costs ?? data.cost ?? "").toString().trim();
    }

    // How to test (Deckbuilder v1):
    // 1) Open Deckbuilder Mode from Main Menu.
    // 2) Adjust deck controls (size/value/score) and press "Build Deck".
    // 3) Verify list updates by cost and summary metrics (X/Z/N/Y/Base/p/p*/consistency/DeckScore).
    // 4) Reload page and confirm settings + last deck persist for current player.
    function renderDeckbuilder(rootNode, state) {
      if (!deckbuilderApi?.renderDeckbuilder) {
        const wrap = document.createElement("div");
        wrap.className = "menuCard";
        wrap.innerHTML = `<h2>Deck Builder unavailable</h2><div class="zoneMeta">Missing deckbuilder module.</div>`;
        rootNode.replaceChildren(wrap);
        return;
      }

      deckbuilderApi.renderDeckbuilder(rootNode, state, {
        allCards: window.ALL_CARDS,
        savedDecks: window.CardboardDeckStorage?.getSavedDecks?.() || savedDecks,
        lastSelectedDeckId,
        onStateChange: (nextState) => {
          deckbuilderState = deckbuilderApi?.normalizeState ? deckbuilderApi.normalizeState(nextState) : nextState;
        },
        onSavedDecksChange: (nextSavedDecks, nextLastSelectedDeckId) => {
          savedDecks = Array.isArray(nextSavedDecks) ? nextSavedDecks : [];
          lastSelectedDeckId = String(nextLastSelectedDeckId || "");
        },
        persist: persistPlayerSaveDebounced,
        render: renderApp,
        appMode,
        playerId: session.playerId,
        onAssignToBattle: (playerKey, deckObj) => {
          assignDeckForBattle(playerKey, deckObj);
          renderApp();
        }
      });
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
      moveDebug("commitAttempt", {
        cardId,
        fromZoneKey: from.zone,
        toZoneKey: to.zone,
        fromOwner,
        toOwner
      });
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
      if (appMode === "battle" && optimistic) {
        moveDebug("emitMove", {
          cardId,
          fromZoneKey: from.zone,
          toZoneKey: to.zone,
          fromOwner,
          toOwner
        });
        battleClient.sendIntent("MOVE_CARD", { cardId, from: { owner: fromOwner, zone: from.zone }, to: { owner: toOwner, zone: to.zone } });
      }
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

      const data = getCardDef(cardId);
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
          moveDebug("dragStart", { cardId, fromZoneKey: zoneKey, toZoneKey: null, fromOwner: ownerRole });
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
              moveDebug("dropTarget", {
                cardId: dragging.cardId,
                fromZoneKey: dragging.from,
                toZoneKey: drop?.zone || null,
                fromOwner: dragging.owner,
                toOwner: drop?.owner || null
              });
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
        const data = getCardDef(id);
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
  if (legacySandboxHandle) return;
  if (!window.LegacySandbox?.mount) {
    console.error("BoardUI mount is missing");
    return;
  }
  legacySandboxHandle = window.LegacySandbox.mount({
    root,
    subtitle,
    dragLayer: document.getElementById("dragLayer"),
    initialState: sandboxState,
    sandboxPlayerId: session.playerId || null,
    hosted: true,
    bindBackButton: false,
    getMode: () => "solo",
    getActivePlayerKey: () => "p1",
    dispatch: (action) => {
      if (!action || !action.type) return;
      try { applyActionToState(sandboxState, action); } catch (e) { console.warn(e); }
      persistPlayerSaveDebounced();
      legacySandboxHandle?.invalidate?.();
    },
    onPersist: () => { persistPlayerSaveDebounced(); },
    debugDnD: DEBUG_DND
  });
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

  if (!window.LegacySandbox?.mount) {
    console.error("BoardUI mount is missing for battle");
    return;
  }

  const dragLayer = document.getElementById("dragLayer");
  if (!dragLayer) throw new Error("Missing #dragLayer for battle mount");

  const roleOther = (r) => (r === "p1" ? "p2" : "p1");
  const getArr = (zoneKey, opts2 = {}) => {
    const viewed = battleViewRole || session.role || "p1";
    const owner = opts2.playerKey || viewed;
    if (zoneKey === "stack") return battleState.sharedZones?.stack || [];
    if (zoneKey === "opponentLands") return battleState.players?.[roleOther(viewed)]?.zones?.lands || [];
    if (zoneKey === "opponentPermanents") return battleState.players?.[roleOther(viewed)]?.zones?.permanents || [];
    if (zoneKey === "lands" || zoneKey === "permanents") return battleState.players?.[viewed]?.zones?.[zoneKey] || [];
    return battleState.players?.[owner]?.zones?.[zoneKey] || [];
  };

  const dispatch = (action) => {
    if (!action || !action.type) return;
    if (DEBUG_DND) {
      console.info("[battle:dnd]", {
        event: "sent action",
        type: action.type,
        cardId: action.cardId ?? null,
        fromZone: action.from?.zone ?? null,
        toZone: action.to?.zone ?? null,
        sourcePlayer: session.role || null,
        targetPlayer: action.to?.owner || action.owner || null,
        baseVersion: battleState?.version ?? 0
      });
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
    hosted: true,
    bindBackButton: false,
    getMode: () => "battle",
    getActivePlayerKey: () => (battleViewRole || session.role || "p1"),
    setActivePlayerKey: (pk) => {
      battleViewRole = pk;
      try { legacyBattleHandle?.invalidate?.(); } catch (err) { console.error("[battle] invalidate after view switch failed", err); }
    },
    getZoneArray: (zoneKey, opts2) => getArr(zoneKey, opts2),
    setZoneArray: () => {},
    getMarks: () => ({ tapped: battleState?.tapped || {}, tarped: battleState?.tarped || {} }),
    dispatch,
    authoritativeDispatch: true,
    debugDnD: DEBUG_DND,
    persistIntervalMs: 0
  });

  try { legacyBattleHandle.invalidate?.(); } catch (err) { console.error("[battle] initial invalidate failed", err); }
}


    function getSelectedDeckPayloadByRole() {
      const out = {};
      ["p1", "p2"].forEach((pk) => {
        const selected = battleDeckSelections[pk];
        if (!selected) return;
        const deckObj = getDeckById(selected);
        const cards = typeof window.expandDeckCardIds === "function"
          ? window.expandDeckCardIds(deckObj)
          : (Array.isArray(deckObj?.cards) ? deckObj.cards.map(String) : []);
        const declaredSize = Number(deckObj?.deckSize || cards.length);
        if (!cards.length || declaredSize !== cards.length) return;
        out[pk] = cards;
      });
      return out;
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
          battleLobbyRoomsRequested = false;
          renderApp();
          try {
            battleLobbyRoomsRequested = true;
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
            const res = await battleClient.createRoom(requestedRoomCode, getSelectedDeckPayloadByRole());
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
            const chosen = getSelectedDeckPayloadByRole();
            const onlyPreferred = preferredRole === "p1" || preferredRole === "p2" ? { [preferredRole]: chosen[preferredRole] } : chosen;
            const res = await battleClient.joinRoom(code, preferredRole, onlyPreferred);
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

  function renderBattleDeckChooser() {
    const panel = document.createElement("div");
    panel.className = "menuCard";
    const title = document.createElement("h3");
    title.textContent = "Choose Decks";
    panel.appendChild(title);

    const decks = typeof window.getAllAvailableDecks === "function"
      ? window.getAllAvailableDecks()
      : (window.CardboardDeckStorage?.getSavedDecks?.() || savedDecks || []);
    ["p1", "p2"].forEach((pk) => {
      const row = document.createElement("div");
      row.className = "zoneMeta";
      const label = document.createElement("div");
      label.textContent = `Select deck for ${pk.toUpperCase()}`;
      const select = document.createElement("select");
      select.className = "menuInput";
      select.dataset.stickyMenu = "1";
      const none = document.createElement("option");
      none.value = "";
      none.textContent = "Default random";
      select.appendChild(none);
      decks.forEach((deck) => {
        const opt = document.createElement("option");
        opt.value = deck.id || deck.deckId;
        const deckSize = typeof window.expandDeckCardIds === "function"
          ? window.expandDeckCardIds(deck).length
          : (deck.deckSize || deck?.cards?.length || deck?.deck?.size || 0);
        opt.textContent = `${deck.name} • ${deckSize}`;
        if (battleDeckSelections[pk] === opt.value) opt.selected = true;
        select.appendChild(opt);
      });
      select.onchange = () => {
        battleDeckSelections[pk] = select.value;
        persistPlayerSaveDebounced();
      };
      row.append(label, select);

      const chosen = getDeckById(battleDeckSelections[pk]);
      if (chosen) {
        const expanded = typeof window.expandDeckCardIds === "function"
          ? window.expandDeckCardIds(chosen)
          : (Array.isArray(chosen?.cards) ? chosen.cards.map(String) : []);
        const previewId = expanded.find((id) => window.CARD_KIND?.(id) !== "land") || expanded[0] || "";
        const previewSrc = previewId ? getCardImgSrc(previewId, { playerKey: pk }) : "";
        const preview = document.createElement("div");
        preview.className = "dbInline";
        if (previewSrc) {
          const art = document.createElement("img");
          art.className = "dbDeckThumb";
          art.src = previewSrc;
          art.alt = "";
          art.loading = "lazy";
          preview.appendChild(art);
        }
        const byLand = chosen?.stats?.byLandType || {};
        Object.keys(byLand).forEach((id) => {
          const n = Number(byLand[id] || 0);
          if (!n) return;
          const pill = document.createElement("span");
          pill.className = "dbChip";
          pill.textContent = `${cardName(id)} x${n}`;
          preview.appendChild(pill);
        });
        row.appendChild(preview);
      }

      panel.appendChild(row);
    });

    return panel;
  }

  function renderModeScreen() {
  if (appMode === "battle") {
    if (!battleState && !battleLobbyRoomsRequested) {
      battleLobbyRoomsRequested = true;
      battleClient.refreshRoomsList?.();
    }
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
    renderDeckbuilder(root, deckbuilderState);
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
      wrap.appendChild(renderBattleDeckChooser());
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

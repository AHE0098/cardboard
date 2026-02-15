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
      onPersist: opts.onPersist || (() => {}),
    };

    // ============================
    // DISPATCH SUPPORT (Option A)
    // ============================
    const dispatch = typeof opts.dispatch === "function" ? opts.dispatch : null;

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
        dispatch(action);
        return true;
      }
      if (typeof fallbackFn === "function") fallbackFn();
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

  if (state.tapped?.[String(cardId)]) c.classList.add("tapped");
  if (state.tarped?.[String(cardId)]) c.classList.add("tarped");

  if (!overlay) {
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

  // Dispatch path: MOVE_CARD with explicit owners/zones
  if (dispatch) {
    const from = resolveOwnerZone(fromZoneKey);
    const to = resolveOwnerZone(toZoneKey);

    // Special: stack is shared; schema wants owner+zone in to/from objects
    emitAction({
      type: "MOVE_CARD",
      cardId,
      from: { owner: from.owner, zone: from.zone },
      to: { owner: to.owner, zone: to.zone },
    });

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

    holdTimer = setTimeout(lift, 2200);

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

      if (state.tapped?.[String(id)]) card.classList.add("tapped");
      if (state.tarped?.[String(id)]) card.classList.add("tarped");

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
  ["opponentPermanents", "opponentLands"].forEach((k) => {
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
      syncDropTargetHighlights(null);

      // little vibration if supported
      if (navigator.vibrate) navigator.vibrate(10);
    };

    holdTimer = setTimeout(lift, 140);

    const onMove = (ev) => {
      const dx = ev.clientX - start.x;
      const dy = ev.clientY - start.y;

      // if user moves finger enough, lift immediately
      if (!lifted && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
        clearTimeout(holdTimer);
        lift();
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
      finalizeDrop(dropZoneKey);

      cancelAll();
    };

    const onCancel = (ev) => {
      ev.preventDefault();
      clearTimeout(holdTimer);
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
    if (el.classList?.contains("dropArea") && el.dataset?.zoneKey) {
      return el.dataset.zoneKey;
    }

    // nested inside dropArea (common with fixed bars and inner wrappers)
    const parent = el.closest?.(".dropArea");
    if (parent?.dataset?.zoneKey) return parent.dataset.zoneKey;
  }

  return null;
}
  
 function syncDropTargetHighlights(activeZoneKey) {
  document.querySelectorAll(".dropArea").forEach(area => {
    const z = area.dataset.zoneKey;
    area.classList.toggle("active", !!activeZoneKey && z === activeZoneKey);
  });
}


function attachTapStates(el, cardId) {
  let tapCount = 0;
  let timer = null;

  const windowMs = 420; // time window to detect 2 vs 3 taps

  el.addEventListener("click", () => {
    if (dragging || inspectorDragging) return;

    tapCount++;

    if (timer) clearTimeout(timer);

    timer = setTimeout(() => {
      const key = String(cardId);

      // Dispatch path (authoritative / shared schema)
      if (dispatch) {
        if (tapCount >= 3) {
          emitAction({ type: "TOGGLE_TAP", cardId, kind: "tarped" });
          // UI optimism: reflect immediately, then render() will reconcile anyway
          el.classList.toggle("tarped");
          el.classList.remove("tapped");
        } else if (tapCount === 2) {
          emitAction({ type: "TOGGLE_TAP", cardId, kind: "tapped" });
          el.classList.toggle("tapped");
          el.classList.remove("tarped");
        }

        tapCount = 0;
        timer = null;
        return;
      }

      // ===== legacy local behavior =====
      state.tapped ||= {};
      state.tarped ||= {};

      if (tapCount >= 3) {
        const next = !state.tarped[key];
        state.tarped[key] = next;
        state.tapped[key] = false;

        el.classList.toggle("tarped", next);
        el.classList.remove("tapped");
      } else if (tapCount === 2) {
        const next = !state.tapped[key];
        state.tapped[key] = next;
        state.tarped[key] = false;

        el.classList.toggle("tapped", next);
        el.classList.remove("tarped");
      }

      tapCount = 0;
      timer = null;
    }, windowMs);
  });
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
    const owner = resolveOwnerZone("deck").owner; // viewing player in battle, "solo" in solo
    emitAction({ type: "DRAW_CARD", owner });
  } else {
    deck.shift();
    getZoneArray("hand").unshift(cardId); // ✅ leftmost, pushes others right
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
  e.preventDefault();

  // If they press-hold a pile, we DON'T start dragging the pile.
  // We just stop it from interfering with board gestures.
  // (Later we could implement “drag pile” to mill etc.)
  e.stopPropagation();
}



// Strong mobile back: pointerup works much more reliably than click
(function bindBackButton() {
  const btn = document.querySelector(".topBackBtn");
  if (!btn) return;

  btn.type = "button";
  btn.style.touchAction = "manipulation";

  // prevent double-binding if render runs multiple times
  if (btn.__cbBoundBack) return;
  btn.__cbBoundBack = true;

  const onBack = (e) => {
    e.preventDefault();
    e.stopPropagation();
    goBackToOverview();
  };

  btn.addEventListener("pointerup", onBack, { passive: false });
})();








  

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




  

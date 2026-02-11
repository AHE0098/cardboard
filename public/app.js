(() => {
  const root = document.getElementById("root");
  const subtitle = document.getElementById("subtitle");
  const dragLayer = document.getElementById("dragLayer");

const state = structuredClone(window.DEMO_STATE || {
  playerName: "Player 1",
  zones: { hand: [1,2,3], lands: [], permanents: [] },
  tapped: {},
  tarped: {}
});



  subtitle.textContent = state.playerName;

  let view = { type: "overview" }; // or {type:"focus", zoneKey:"lands"}
  let dragging = null; // {cardId, fromZoneKey, ghostEl, pointerId}
  let inspector = null;
  let inspectorDragging = null;

 const ZONES = [
  { key: "permanents", label: "Permanents" },
  { key: "lands", label: "Lands" },
  { key: "hand", label: "Hand" }
];

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

  const board = document.createElement("div");
  board.className = "board";

  ZONES.forEach(z => board.appendChild(renderDropArea(z.key)));

  root.appendChild(board);

  if (inspector) {
    renderInspector(inspector.zoneKey);
  } else {
    removeInspectorOverlay();         
    removeBoardOverlay();   
    syncDropTargetHighlights(null);
  }
}


function showDock(active) {
  const overlay = document.getElementById("inspectorOverlay");
  if (overlay) {
    overlay.classList.toggle("dragging", !!active);
    overlay.style.overflowX = active ? "hidden" : "auto";
  }
}



function moveCard(cardId, fromZoneKey, toZoneKey) {
  if (!toZoneKey || toZoneKey === fromZoneKey) return;

  const fromArr = state.zones[fromZoneKey];
  const toArr = state.zones[toZoneKey];
  const idx = fromArr.indexOf(cardId);
  if (idx >= 0) {
    fromArr.splice(idx, 1);
    toArr.push(cardId);
  }
}

function attachInspectorLongPress(cardEl, cardId, fromZoneKey) {
  let holdTimer = null;
  let lifted = false;

  cardEl.addEventListener("pointerdown", (e) => {
    e.preventDefault();

    const pointerId = e.pointerId;
    cardEl.setPointerCapture(pointerId);

    const start = { x: e.clientX, y: e.clientY };
    lifted = false;

    const cancel = () => {
      clearTimeout(holdTimer);
      try { cardEl.releasePointerCapture(pointerId); } catch {}
      cardEl.removeEventListener("pointermove", onMove);
      cardEl.removeEventListener("pointerup", onUp);
      cardEl.removeEventListener("pointercancel", onCancel);
    };

    const lift = () => {
      lifted = true;
      
      const ghost = document.createElement("div");
      ghost.className = "dragGhost";
      ghost.textContent = cardId;
      dragLayer.appendChild(ghost);
      positionGhost(ghost, e.clientX, e.clientY);

      inspectorDragging = { cardId, fromZoneKey, ghostEl: ghost, pointerId };
showDock(true);           // you can remove dock entirely later
renderBoardOverlay();     // <-- NEW
syncDropTargetHighlights(null);

      if (navigator.vibrate) navigator.vibrate(10);
    };

    // user asked 2–3 seconds: pick 2200ms
    holdTimer = setTimeout(lift, 2200);

    const onMove = (ev) => {
      ev.preventDefault();

      const dx = ev.clientX - start.x;
      const dy = ev.clientY - start.y;

      // if they move a lot before lift, cancel the long-press
      if (!lifted && (Math.abs(dx) > 10 || Math.abs(dy) > 10)) {
        clearTimeout(holdTimer);
      }

      if (inspectorDragging?.ghostEl) {
        positionGhost(inspectorDragging.ghostEl, ev.clientX, ev.clientY);
const overZoneKey = hitTestZone(ev.clientX, ev.clientY);
syncDropTargetHighlights(overZoneKey);
      }
    };

    const onUp = (ev) => {
      ev.preventDefault();
      clearTimeout(holdTimer);

      
      if (inspectorDragging) {
       const overZoneKey = hitTestZone(ev.clientX, ev.clientY);

        // cleanup ghost
        const g = inspectorDragging.ghostEl;
        if (g && g.parentNode) g.parentNode.removeChild(g);


  removeBoardOverlay();                 // <-- HER
  syncDropTargetHighlights(null);        // <-- HER
        
        // move if dropped on a dock zone
       if (overZoneKey) moveCard(inspectorDragging.cardId, inspectorDragging.fromZoneKey, overZoneKey);


        inspectorDragging = null;
        showDock(false);

        // keep inspector open, but re-render everything
        render();
      }

      cancel();
    };

    const onCancel = (ev) => {
      ev.preventDefault();
      clearTimeout(holdTimer);

      if (inspectorDragging) {
        const g = inspectorDragging.ghostEl;
        if (g && g.parentNode) g.parentNode.removeChild(g);

  removeBoardOverlay();                 // <-- HER
  syncDropTargetHighlights(null);        // <-- HER
        
        inspectorDragging = null;
        showDock(false);
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
  removeInspectorOverlay(); // <-- prevents stacking multiple overlays
  const zoneCards = state.zones[zoneKey];

  // Create overlay
  const overlay = document.createElement("div");
  overlay.id = "inspectorOverlay";     // <-- give it a stable id
  overlay.className = "inspectorOverlay";

 overlay.addEventListener("click", (e) => {
  if (inspectorDragging) return;     // <-- vigtig
  if (e.target === overlay) {
    inspector = null;
    removeInspectorOverlay();
    render();
  }
});

  // Create close button
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

  // Create inspector content track
  const track = document.createElement("div");
  track.className = "inspectorTrack";

  if (zoneCards.length === 0) {
    const empty = document.createElement("div");
    empty.className = "inspectorEmpty";
    empty.innerHTML = "<div>🗄️</div><p>No cards in this zone.</p>";
    track.appendChild(empty);
  } else {
    zoneCards.forEach((id) => {
      const data = window.CARD_REPO?.[id] || {};
      const card = document.createElement("div");
      card.className = "inspectorCard";

      const img = document.createElement("img");
      img.src = data.image || "https://via.placeholder.com/200x280?text=Card";
      card.appendChild(img);

      const name = document.createElement("div");
      name.className = "inspectorName";
      name.textContent = data.name || `Card ${id}`;
      card.appendChild(name);

      if (data.power !== undefined) {
        const stats = document.createElement("div");
        stats.className = "inspectorStats";
        stats.textContent = `${data.power}/${data.toughness}`;
        card.appendChild(stats);
      }

      const idTag = document.createElement("div");
      idTag.className = "inspectorId";
      idTag.textContent = `#${id}`;
      card.appendChild(idTag);

attachInspectorLongPress(card, id, zoneKey);

/* allow tap/tarp from inspector too (not in hand) */
if (zoneKey !== "hand") {
  attachTapStates(card, id);
}

// ✅ add these:
if (state.tapped?.[String(id)]) card.classList.add("tapped");
if (state.tarped?.[String(id)]) card.classList.add("tarped");

track.appendChild(card);
    });
  }

  // Build hierarchy: closeBtn and track INSIDE overlay
  overlay.appendChild(closeBtn);
  overlay.appendChild(track);
  document.body.appendChild(overlay);
}
  
function renderDropArea(zoneKey, opts = {}) {
  const { overlay = false } = opts;

  const area = document.createElement("section");
  area.className = "dropArea";
  area.dataset.zoneKey = zoneKey;
  area.classList.add(`zone-${zoneKey}`);

  // Kun klik-to-inspect på "rigtige" board (ikke overlay)
  if (!overlay) {
    area.addEventListener("click", () => {
      inspector = { zoneKey };
      render();
    });
  }

  const row = document.createElement("div");
  row.className = "slotRow";

  const ids = state.zones[zoneKey];

  // ===== HAND: render cards directly + fan layout =====
  if (zoneKey === "hand") {
    for (let i = 0; i < ids.length; i++) {
      const id = ids[i];

      const c = document.createElement("div");
      c.className = "miniCard";
      c.textContent = id;
      c.dataset.cardId = String(id);
      c.dataset.fromZoneKey = zoneKey;

      if (!overlay) {
        c.addEventListener("pointerdown", onCardPointerDown, { passive: false });
        c.addEventListener("click", (e) => e.stopPropagation());
      }

      // Vis tapped-tilstand både på board og overlay (ren visual)
      if (state.tapped?.[String(id)]) c.classList.add("tapped");
      if (state.tarped?.[String(id)]) c.classList.add("tarped");

      row.appendChild(c);
    }

    // ✅ ADD THIS HERE (after cards exist)
    layoutHandFan(row, ids);

    area.appendChild(row);
    return area;
  }

  // ===== NON-HAND: keep your slot logic =====
  const minSlots = 6;
  const slotCount = Math.max(minSlots, ids.length + 1);

  for (let i = 0; i < slotCount; i++) {
    const slot = document.createElement("div");
    slot.className = "slot";

    const id = ids[i];
    if (id !== undefined) {
      const c = document.createElement("div");
      c.className = "miniCard";
      c.textContent = id;
      c.dataset.cardId = String(id);
      c.dataset.fromZoneKey = zoneKey;

      // Drag kun på "rigtige" board (ikke overlay)
      if (!overlay) {
        c.addEventListener("pointerdown", onCardPointerDown, { passive: false });
        c.addEventListener("click", (e) => e.stopPropagation());
      }

      // Tapped kun udenfor hand og kun på "rigtige" board
      if (!overlay) {
        attachTapStates(c, id);
      }

      // Vis tapped-tilstand både på board og overlay (ren visual)
    if (state.tapped?.[String(id)]) c.classList.add("tapped");
    if (state.tarped?.[String(id)]) c.classList.add("tarped");

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
    right.textContent = `${state.zones[zoneKey].length} cards`;

    head.appendChild(left);
    head.appendChild(right);

    const preview = document.createElement("div");
    preview.className = "previewRow";

    const cards = state.zones[zoneKey];
    const max = 9;
    cards.slice(0, max).forEach(id => {
      const p = document.createElement("div");
p.className = "miniCard";
p.textContent = id;
p.dataset.cardId = String(id);
p.dataset.fromZoneKey = zoneKey;
if (state.tapped?.[String(id)]) p.classList.add("tapped");
if (state.tarped?.[String(id)]) p.classList.add("tarped");
p.addEventListener("pointerdown", onCardPointerDown, { passive: false });
p.addEventListener("click", (e) => e.stopPropagation());
preview.appendChild(p);

    });

    tile.appendChild(head);
    tile.appendChild(preview);

  if (clickable) {
  let lastTapAt = 0;
  const dblMs = 320;

  tile.addEventListener("click", () => {
    if (dragging) return;

    const now = performance.now();
    if (now - lastTapAt <= dblMs) {
      // double-tap confirmed
      view = { type: "focus", zoneKey };
      render();
      lastTapAt = 0;
    } else {
      lastTapAt = now;
    }
  });
}



    return tile;
  }

  function renderFocus(zoneKey) {
    const container = document.createElement("div");

    const top = document.createElement("div");
    top.className = "focusTop";

    const back = document.createElement("button");
    back.className = "backBtn";
    back.textContent = "Back";
    back.addEventListener("click", () => {
      view = { type: "overview" };
      render();
    });

    const title = document.createElement("div");
    title.style.display = "flex";
    title.style.flexDirection = "column";
    title.style.gap = "2px";

    const t1 = document.createElement("div");
    t1.style.fontWeight = "900";
    t1.style.fontSize = "18px";
    t1.textContent = ZONES.find(z => z.key === zoneKey)?.label || zoneKey;

    const t2 = document.createElement("div");
    t2.className = "zoneDropHint";
    t2.textContent = "Press-hold a card, drag it onto the other zone.";

    title.appendChild(t1);
    title.appendChild(t2);

    top.appendChild(back);
    top.appendChild(title);

    container.appendChild(top);

    // show both zones as drop targets even in focus mode
    const targets = document.createElement("div");
    targets.style.display = "grid";
    targets.style.gridTemplateColumns = "1fr 1fr 1fr";
    targets.style.gap = "10px";
    targets.style.marginTop = "12px";

    ZONES.forEach(z => {
      const tile = renderZoneTile(z.key, z.label, false);
      tile.style.cursor = "default";
      targets.appendChild(tile);
    });
    container.appendChild(targets);

    const grid = document.createElement("div");
    grid.className = "grid";
    state.zones[zoneKey].forEach(cardId => {
      const el = document.createElement("div");
      el.className = "card";
      el.textContent = cardId;
      el.dataset.cardId = String(cardId);
      el.dataset.fromZoneKey = zoneKey;

      // pointer-driven drag
      el.addEventListener("pointerdown", onCardPointerDown, { passive: false });

      grid.appendChild(el);
    });

    container.appendChild(grid);
    return container;
  }

  function onCardPointerDown(e) {
    e.preventDefault();

    const cardEl = e.currentTarget;
    const cardId = Number(cardEl.dataset.cardId);
    const fromZoneKey = cardEl.dataset.fromZoneKey;

    // small press-hold before lifting
    const pointerId = e.pointerId;
    cardEl.setPointerCapture(pointerId);

    const start = { x: e.clientX, y: e.clientY, t: performance.now() };
    let lifted = false;
    let holdTimer = null;

    const cancelAll = () => {
      clearTimeout(holdTimer);
      cardEl.releasePointerCapture(pointerId);
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
      dragLayer.appendChild(ghost);
      positionGhost(ghost, e.clientX, e.clientY);

      dragging = { cardId, fromZoneKey, ghostEl: ghost, pointerId };
      syncDropTargetHighlights(null);

      // little vibration if supported
      if (navigator.vibrate) navigator.vibrate(10);
    };

    holdTimer = setTimeout(lift, 140);

    const onMove = (ev) => {
      ev.preventDefault();
      const dx = ev.clientX - start.x;
      const dy = ev.clientY - start.y;

      // if user moves finger enough, lift immediately
      if (!lifted && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
        clearTimeout(holdTimer);
        lift();
      }

      if (dragging?.ghostEl) {
        positionGhost(dragging.ghostEl, ev.clientX, ev.clientY);
        const overZoneKey = hitTestZone(ev.clientX, ev.clientY);
        syncDropTargetHighlights(overZoneKey);
      }
    };

    const onUp = (ev) => {
      ev.preventDefault();
      clearTimeout(holdTimer);

      if (!lifted || !dragging) {
        cancelAll();
        return;
      }

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
    const zoneEl = els.find(n => n?.dataset?.zoneKey);
    return zoneEl ? zoneEl.dataset.zoneKey : null;
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

    // restart the decision timer on every tap
    if (timer) clearTimeout(timer);

    timer = setTimeout(() => {
      const key = String(cardId);
      state.tapped ||= {};
      state.tarped ||= {};

      // Resolve tapCount into action
      if (tapCount >= 3) {
        // TRIPLE TAP: toggle tarped, clear tapped
        const next = !state.tarped[key];
        state.tarped[key] = next;
        state.tapped[key] = false;

        el.classList.toggle("tarped", next);
        el.classList.remove("tapped");
      } else if (tapCount === 2) {
        // DOUBLE TAP: toggle tapped, clear tarped
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

    // move card between arrays (first occurrence)
    const fromArr = state.zones[from];
    const toArr = state.zones[toZoneKey];
    const idx = fromArr.indexOf(cardId);
    if (idx >= 0) {
      fromArr.splice(idx, 1);
      toArr.push(cardId);
    }

    dragging = null;
    syncDropTargetHighlights(null);

    // re-render keeps it simple for v0
    render();
  }

  render();
})();

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

  let view = { type: "focus", zoneKey: "hand" }; // or {type:"focus", zoneKey:"lands"}
  let dragging = null; // {cardId, fromZoneKey, ghostEl, pointerId}
  let inspector = null;
  let inspectorDragging = null;

 const ZONES = [
  { key: "permanents", label: "Permanents" },
  { key: "lands", label: "Lands" },
  { key: "hand", label: "Hand" }
];

    // --- Topbar Back button (between title and subtitle) ---
  const topbar = document.querySelector(".topbar");
  const titleEl = document.querySelector(".title");

  const topBackBtn = document.createElement("button");
  topBackBtn.className = "topBackBtn";
  topBackBtn.textContent = "Back";
  topBackBtn.addEventListener("click", () => {
    inspector = null;
    removeInspectorOverlay();
    removeBoardOverlay();
    syncDropTargetHighlights(null);
    inspectorDragging = null;
    showDock(false);

    view = { type: "overview" };
    render();
  });

  if (topbar && titleEl) {
    // Insert between title and subtitle
    topbar.insertBefore(topBackBtn, subtitle);
  }

  
function getCardImgSrc(cardId) {
  return `/cards/image${cardId}.png`; // matches /public/cards/imageXYZ.png
}

function makeMiniCardEl(cardId, fromZoneKey, { overlay = false } = {}) {
  const c = document.createElement("div");
  c.className = "miniCard";
  c.dataset.cardId = String(cardId);
  c.dataset.fromZoneKey = fromZoneKey;

  const pic = document.createElement("div");
  pic.className = "miniPic";

  const img = document.createElement("img");
  img.className = "miniImg";
  img.alt = "";
  img.draggable = false;
  img.onload = () => img.classList.add("isLoaded");
  img.onerror = () => img.remove(); // if missing, you just see silhouette
  img.src = getCardImgSrc(cardId);

  pic.appendChild(img);
  c.appendChild(pic);

   // PT badge (bottom-center) if available
  const data = window.CARD_REPO?.[cardId];
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
  
  if (view?.type === "focus" && view.zoneKey) {
    root.appendChild(renderFocus(view.zoneKey));
  } else {
    // default
    root.appendChild(renderOverview());
  }

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

  ZONES.forEach(z => {
    tiles.appendChild(renderZoneTile(z.key, z.label, true));
  });

  wrap.appendChild(tiles);

  // (Optional) tiny hint row
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
    if (trackEl) {
      const ids = Array.from(trackEl.querySelectorAll(".inspectorCard"))
        .map(el => Number(el.dataset.cardId))
        .filter(n => Number.isFinite(n));
      state.zones[fromZoneKey] = ids;
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
    e.preventDefault();

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
      ev.preventDefault();
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
      card.dataset.cardId = String(id);
      
      const img = document.createElement("img");
     img.src = getCardImgSrc(id);
     img.onerror = () => { img.src = "https://via.placeholder.com/200x280?text=Card"; };
      card.appendChild(img);

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
    row.appendChild(makeMiniCardEl(id, zoneKey, { overlay }));
  }

  layoutHandFan(row, ids);

  area.appendChild(row);
  return area;
}

// ===== NON-HAND =====
const minSlots = 6;
const slotCount = Math.max(minSlots, ids.length + 1);

for (let i = 0; i < slotCount; i++) {
  const slot = document.createElement("div");
  slot.className = "slot";

  const id = ids[i];
  if (id !== undefined) {
    const c = makeMiniCardEl(id, zoneKey, { overlay });

    // tapped/tarp toggles only on real board
    if (!overlay) attachTapStates(c, id);

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


  const title = document.createElement("div");
  title.style.display = "flex";
  title.style.flexDirection = "column";
  title.style.gap = "2px";

  top.appendChild(title);
  container.appendChild(top);

  // Board in focus: still show all zones as drop targets,
  // but add a class to the focused one for styling.
  const board = document.createElement("div");
  board.className = "board focusBoard";

  ZONES.forEach(z => {
    const area = renderDropArea(z.key);
    if (z.key === zoneKey) area.classList.add("isFocusZone");
    board.appendChild(area);
  });

  container.appendChild(board);
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

  // Prefer real board drop areas only
  const area = els.find(n => n?.classList?.contains("dropArea") && n?.dataset?.zoneKey);
  return area ? area.dataset.zoneKey : null;
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

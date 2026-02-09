(() => {
  const root = document.getElementById("root");
  const subtitle = document.getElementById("subtitle");
  const dragLayer = document.getElementById("dragLayer");

  const state = structuredClone(window.DEMO_STATE || {
  playerName: "Player 1",
  zones: { hand: [1,2,3], lands: [], permanents: [] }
});


  subtitle.textContent = state.playerName;

  let view = { type: "overview" }; // or {type:"focus", zoneKey:"lands"}
  let dragging = null; // {cardId, fromZoneKey, ghostEl, pointerId}

 const ZONES = [
  { key: "hand", label: "Hand" },
  { key: "lands", label: "Lands" },
  { key: "permanents", label: "Permanents" }
];


  function render() {
    root.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "view";

    if (view.type === "overview") {
      ZONES.forEach(z => wrap.appendChild(renderZoneTile(z.key, z.label, true)));
    } else {
      wrap.appendChild(renderFocus(view.zoneKey));
    }

    root.appendChild(wrap);
    syncDropTargetHighlights(null);
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
    document.querySelectorAll(".zoneTile").forEach(tile => {
      const z = tile.dataset.zoneKey;
      tile.classList.toggle("dropTargetActive", !!activeZoneKey && z === activeZoneKey);
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

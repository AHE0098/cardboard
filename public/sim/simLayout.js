(function initSimLayout(global) {
  const SimUI = (global.SimUI = global.SimUI || {});
  const SCROLL_ROOT_ID = "sim-scroll-root";

  function createSimulatorShell() {
    const wrap = document.createElement("div");
    wrap.className = "view simulatorShell";
    wrap.style.minHeight = "0";
    wrap.style.flex = "1 1 auto";

    const panel = document.createElement("div");
    panel.className = "menuCard simWrap simScrollRoot";
    panel.id = SCROLL_ROOT_ID;
    panel.style.minHeight = "0";
    panel.style.flex = "1 1 auto";
    panel.style.overflowY = "auto";
    panel.style.overflowX = "hidden";
    panel.style.webkitOverflowScrolling = "touch";
    panel.innerHTML = "<h2>Simulator</h2>";
    wrap.appendChild(panel);
    return { wrap, panel };
  }



  function installScrollDebug(modeName, scrollRootEl) {
    if (!global.DEBUG_SCROLL || !scrollRootEl) return () => {};
    const tagEl = (el) => {
      if (!el || !el.tagName) return String(el);
      const id = el.id ? `#${el.id}` : "";
      const cls = el.classList?.length ? `.${Array.from(el.classList).slice(0, 2).join(".")}` : "";
      return `${el.tagName.toLowerCase()}${id}${cls}`;
    };
    const samplePath = (e) => {
      const p = e.composedPath ? e.composedPath() : [];
      return p.slice(0, 4).map(tagEl).join(" > ");
    };
    const rect = scrollRootEl.getBoundingClientRect();
    const cs = global.getComputedStyle(scrollRootEl);
    console.info(`[scroll-debug:${modeName}] mount`, {
      rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
      clientHeight: scrollRootEl.clientHeight,
      scrollHeight: scrollRootEl.scrollHeight,
      overflowY: cs.overflowY,
      pointerEvents: cs.pointerEvents,
      position: cs.position,
      zIndex: cs.zIndex
    });

    const onWheel = (e) => console.info(`[scroll-debug:${modeName}] wheel`, { deltaY: e.deltaY, defaultPrevented: e.defaultPrevented, path: samplePath(e) });
    const onTouch = (e) => console.info(`[scroll-debug:${modeName}] touchmove`, { defaultPrevented: e.defaultPrevented, path: samplePath(e) });
    const onScroll = () => console.info(`[scroll-debug:${modeName}] scroll`, { scrollTop: scrollRootEl.scrollTop });
    const onGlobalWheel = (e) => { if (e.defaultPrevented) console.warn(`[scroll-debug:${modeName}] global wheel prevented`, { path: samplePath(e) }); };
    const onGlobalTouch = (e) => { if (e.defaultPrevented) console.warn(`[scroll-debug:${modeName}] global touchmove prevented`, { path: samplePath(e) }); };

    scrollRootEl.addEventListener('wheel', onWheel, { capture: true, passive: true });
    scrollRootEl.addEventListener('touchmove', onTouch, { capture: true, passive: true });
    scrollRootEl.addEventListener('scroll', onScroll, { passive: true });
    global.addEventListener('wheel', onGlobalWheel, { capture: true, passive: true });
    global.addEventListener('touchmove', onGlobalTouch, { capture: true, passive: true });

    return () => {
      scrollRootEl.removeEventListener('wheel', onWheel, { capture: true });
      scrollRootEl.removeEventListener('touchmove', onTouch, { capture: true });
      scrollRootEl.removeEventListener('scroll', onScroll);
      global.removeEventListener('wheel', onGlobalWheel, { capture: true });
      global.removeEventListener('touchmove', onGlobalTouch, { capture: true });
    };
  }

  function assertScrollRoot() {
    const found = document.getElementById(SCROLL_ROOT_ID);
    if (!found) console.warn("[sim] missing scroll root", SCROLL_ROOT_ID);
    if (!found) return;
    requestAnimationFrame(() => {
      const cs = global.getComputedStyle(found);
      const canOverflow = found.scrollHeight > found.clientHeight;
      if (!canOverflow || cs.overflowY === "visible") return;
      const prev = found.scrollTop;
      found.scrollTop = prev + 1;
      const moved = found.scrollTop !== prev;
      found.scrollTop = prev;
      if (!moved) {
        console.warn("[sim] overflow content but non-scrollable", {
          id: SCROLL_ROOT_ID,
          overflowY: cs.overflowY,
          clientHeight: found.clientHeight,
          scrollHeight: found.scrollHeight
        });
      }
    });
  }

  SimUI.SCROLL_ROOT_ID = SCROLL_ROOT_ID;
  SimUI.createSimulatorShell = createSimulatorShell;
  SimUI.assertScrollRoot = assertScrollRoot;
  SimUI.installScrollDebug = installScrollDebug;
})(window);

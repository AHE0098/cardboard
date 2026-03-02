(function initSimLayout(global) {
  const SimUI = (global.SimUI = global.SimUI || {});
  const SCROLL_ROOT_ID = "sim-scroll-root";

  function createSimulatorShell() {
    const wrap = document.createElement("div");
    wrap.className = "view simulatorShell";
    const panel = document.createElement("div");
    panel.className = "menuCard simWrap simScrollRoot";
    panel.id = SCROLL_ROOT_ID;
    panel.innerHTML = "<h2>Simulator</h2>";
    wrap.appendChild(panel);
    return { wrap, panel };
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
})(window);

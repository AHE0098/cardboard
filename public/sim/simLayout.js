(function initSimLayout(global) {
  const SimUI = (global.SimUI = global.SimUI || {});
  const SCROLL_ROOT_ID = "sim-scroll-root";

  function createSimulatorShell() {
    const wrap = document.createElement("div");
    wrap.className = "view";
    const panel = document.createElement("div");
    panel.className = "menuCard simWrap";
    panel.id = SCROLL_ROOT_ID;
    panel.innerHTML = "<h2>Simulator</h2>";
    wrap.appendChild(panel);
    return { wrap, panel };
  }

  function assertScrollRoot() {
    const found = document.getElementById(SCROLL_ROOT_ID);
    if (!found) console.warn("[sim] missing scroll root", SCROLL_ROOT_ID);
  }

  SimUI.SCROLL_ROOT_ID = SCROLL_ROOT_ID;
  SimUI.createSimulatorShell = createSimulatorShell;
  SimUI.assertScrollRoot = assertScrollRoot;
})(window);

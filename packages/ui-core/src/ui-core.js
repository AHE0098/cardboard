(function () {
  function updateViewportVars() {
    var vh = window.visualViewport ? window.visualViewport.height : window.innerHeight;
    document.documentElement.style.setProperty('--app-vh', vh + 'px');
  }

  function createIntentHub() {
    var listeners = { activate: [], back: [], dragStart: [], dragEnd: [] };
    return {
      on: function (type, fn) {
        if (!listeners[type]) listeners[type] = [];
        listeners[type].push(fn);
        return function () { listeners[type] = (listeners[type] || []).filter(function (f) { return f !== fn; }); };
      },
      emit: function (type, payload) {
        (listeners[type] || []).forEach(function (fn) { fn(payload); });
      },
      bindBack: function () {
        window.addEventListener('keydown', function (e) {
          if (e.key === 'Escape') {
            e.preventDefault();
            (listeners.back || []).forEach(function (fn) { fn({ source: 'escape' }); });
          }
        });
      }
    };
  }

  function attachPointerDrag(el, handlers) {
    if (!el) return function () {};
    var activeId = null;
    function onDown(e) {
      activeId = e.pointerId;
      if (el.setPointerCapture) el.setPointerCapture(activeId);
      handlers && handlers.onStart && handlers.onStart(e);
    }
    function onMove(e) {
      if (activeId !== e.pointerId) return;
      handlers && handlers.onMove && handlers.onMove(e);
    }
    function finish(e, canceled) {
      if (activeId !== e.pointerId) return;
      handlers && handlers.onEnd && handlers.onEnd(e, canceled);
      if (el.releasePointerCapture) {
        try { el.releasePointerCapture(activeId); } catch (_) {}
      }
      activeId = null;
    }
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', function (e) { finish(e, false); });
    el.addEventListener('pointercancel', function (e) { finish(e, true); });
    return function () {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
    };
  }

  function ensureToastHost() {
    var host = document.getElementById('uiToastHost');
    if (host) return host;
    host = document.createElement('div');
    host.id = 'uiToastHost';
    host.className = 'ui-toast-host';
    document.body.appendChild(host);
    return host;
  }

  function toast(message, ms) {
    var host = ensureToastHost();
    var el = document.createElement('div');
    el.className = 'ui-toast';
    el.textContent = String(message || '');
    host.appendChild(el);
    setTimeout(function () { el.remove(); }, ms || 1800);
  }

  function mountSmokeHarness(root) {
    if (!root) return;
    var panel = document.createElement('div');
    panel.className = 'ui-stack';
    panel.innerHTML = '<div class="ui-panel menuCard"><h2>UI Smoke Harness</h2><p class="zoneMeta">Responsive shell, list scroll, modal, and button target checks.</p></div>';

    var btnGrid = document.createElement('div');
    btnGrid.className = 'ui-grid';
    for (var i = 1; i <= 8; i++) {
      var b = document.createElement('button');
      b.className = 'ui-btn menuBtn';
      b.textContent = 'Target ' + i;
      b.onclick = function () { toast('Button tap ok'); };
      btnGrid.appendChild(b);
    }

    var listWrap = document.createElement('div');
    listWrap.className = 'ui-panel menuCard';
    listWrap.innerHTML = '<h3>Scrollable List</h3>';
    var list = document.createElement('div');
    list.className = 'ui-scrollable-list';
    list.style.maxHeight = '220px';
    for (var j = 1; j <= 40; j++) {
      var row = document.createElement('div');
      row.className = 'menuBtn';
      row.textContent = 'Row ' + j;
      list.appendChild(row);
    }
    listWrap.appendChild(list);

    panel.appendChild(btnGrid);
    panel.appendChild(listWrap);
    root.replaceChildren(panel);
  }

  updateViewportVars();
  window.addEventListener('resize', updateViewportVars, { passive: true });
  if (window.visualViewport) window.visualViewport.addEventListener('resize', updateViewportVars, { passive: true });

  window.UICore = {
    createIntentHub: createIntentHub,
    attachPointerDrag: attachPointerDrag,
    toast: toast,
    mountSmokeHarness: mountSmokeHarness,
    updateViewportVars: updateViewportVars
  };
})();

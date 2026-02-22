(() => {
  if (window.__CARDBOARD_LEGACY_SANDBOX_WARNED__) return;
  window.__CARDBOARD_LEGACY_SANDBOX_WARNED__ = true;

  console.warn("[cardboard] legacySandbox.js is retired; use app2.js as the single UI entrypoint.");

  window.LegacySandbox ||= {};
  window.LegacySandbox.mount = function retiredMount() {
    return {
      invalidate() {},
      unmount() {}
    };
  };
})();

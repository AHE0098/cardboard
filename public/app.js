(() => {
  if (window.__CARDBOARD_APP2_LOADING__) return;
  window.__CARDBOARD_APP2_LOADING__ = true;

  const warn = () => {
    if (window.__CARDBOARD_APP_DEPRECATED_WARNED__) return;
    window.__CARDBOARD_APP_DEPRECATED_WARNED__ = true;
    console.warn("[cardboard] app.js is deprecated; loading app2.js");
  };

  const alreadyLoaded = () => {
    return !!document.querySelector('script[src$="/app2.js"], script[src="./app2.js"], script[src="app2.js"]');
  };

  if (alreadyLoaded()) {
    warn();
    return;
  }

  warn();
  const s = document.createElement("script");
  s.src = "./app2.js";
  s.defer = true;
  document.head.appendChild(s);
})();

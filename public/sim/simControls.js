(function initSimControls(global) {
  const SimUI = (global.SimUI = global.SimUI || {});

  function updateSearch(state, value, renderApp) {
    state.reportSearch = value;
    renderApp();
  }

  function updateToggle(state, key, value, renderApp) {
    state[key] = value;
    renderApp();
  }

  SimUI.simControls = { updateSearch, updateToggle };
})(window);

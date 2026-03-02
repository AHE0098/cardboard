# Simulator Snippets

Responsibilities:
- `simController.js`: simulator mount/render orchestration and fetch wiring.
- `simAdapter.js`: deck-to-sim mapping, API normalization, parity hash.
- `simReportRenderer.js`: report text and event labels.
- `simWinrateGraph.js`: winrate series and SVG renderer.
- `simControls.js`: toggle/search UI state handlers.
- `simLayout.js`: simulator shell and scroll-root ownership (`sim-scroll-root`).

Boundaries:
- `public/app2.js` only calls `window.SimUI.mountSimulator(...)`.
- Snippets expose methods through `window.SimUI` and do not require build tooling.
- Keep simulation rules/engine behavior in server sim code; snippets are presentation + adapter only.

# ui-core platform

Vanilla JS + CSS UI platform used by `public/index.html` and `public/sandbox.html`.

## Includes
- App shell primitives (`ui-shell`, `ui-header`, `ui-main`, `ui-footer`) with single scroll container.
- Design tokens for spacing, typography, z-layers, breakpoints, and tap target sizes.
- Layout primitives (`ui-stack`, `ui-row`, `ui-grid`, `ui-panel`, `ui-scrollable-list`).
- Components (`ui-btn`, `ui-icon-btn`, `ui-tabs`, `ui-dialog`, `ui-toast`).
- Input intent hub (`activate`, `back`, `dragStart`, `dragEnd`) and pointer capture helpers.
- Viewport/safe-area utilities (`--app-vh`, safe-area insets, resize observer helper).

Implementation source is mirrored to `public/ui-core.js` and `public/ui-core.css` for no-build browser loading.

# Action schema (bootstrap)

Current server intents (authoritative):

- `DRAW_CARD`: `{ owner? }`
- `TOGGLE_TAP`: `{ cardId, kind?: 'tarped' }`
- `MOVE_CARD`: `{ cardId, from: { owner?, zone }, to: { owner?, zone } }`
- `DECK_PLACE`: `{ cardId, from: { owner?, zone }, where: 'top'|'bottom', owner? }`
- `SET_DECK`: `{ owner?, cards: string[] }`

Notes:
- `owner` defaults to caller role.
- Illegal zone access fails with `{ ok:false, error }`.

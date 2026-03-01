# === EDIT HERE ===

This repo now uses **one primary source-of-truth file** for card/deck tuning:

- `shared/definitions.json` ✅ **EDIT THIS FILE MOST OFTEN**

## Fast path (day-to-day)

1. Open `shared/definitions.json`.
2. Edit values under the sections called out in `_EDIT_HERE_notes`:
   - `keywords`
   - `cardAttributes`
   - `deckRules`
3. Save and run:
   - Web app (unchanged flow)
   - R harness (`Rscript r/scripts/specificR_run.R --config r/config/example_config.yml`)

## What each file does

- `definitions.json`: app-first shared config consumed by both JS and R.
- `schema/card.schema.json`: minimal required card shape (`cardId`, `name`) with extension support.
- `schema/deck.schema.json`: minimal required deck shape (`deckId`, `name`, `cards`) with extension support.
- `example_decks.json`: tiny sample decks for validation/smoke workflows.

## Quick edit examples

### Add a keyword
Add to `definitions.json.keywords`:

```json
{
  "key": "flying",
  "label": "Flying",
  "valueDelta": 1.0,
  "tags": ["evasion"],
  "meta": {}
}
```

### Add a new card attribute (iteratable)
Add to `definitions.json.cardAttributes`:

```json
"rarityTier": {
  "type": "string",
  "required": false,
  "desc": "Optional rarity bucket",
  "meta": {}
}
```

### Adjust deck size defaults
Edit `definitions.json.deckRules.deckSizeDefault`.

## Important compatibility rules

- Shared JSON uses **lowerCamelCase** keys (JS-first naming).
- Unknown/extra fields are intentionally allowed and should be preserved by both JS and R pipelines.
- Do not duplicate constants in app and R; both should read from `shared/`.

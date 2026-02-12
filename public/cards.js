window.CARD_REPO = {
  "37": { name: "Grizzly Bears", color: "green", power: 2, toughness: 2 },
  "40": { name: "Shock", color: "red", image: "https://via.placeholder.com/200x280?text=Shock" },
  "41": { name: "Island", color: "blue" },
  "42": { name: "Goblin Raider", color: "red", power: 2, toughness: 2 },
  "43": { name: "Plains", color: "white" },
  "44": { name: "Grizzly Bears", color: "green", power: 2, toughness: 2 },
  "45": { name: "Shock", color: "red", image: "https://via.placeholder.com/200x280?text=Shock" },
  "55": { name: "Island", color: "blue" },
  "56": { name: "Goblin Raider", color: "red", power: 2, toughness: 2 },
  "57": { name: "Plains", color: "white" },
  // ...add more
};


// --- v1: local images in /public/cards/image<ID>.png ---
(() => {
  const localIds = [37, 40, 41, 42, 43, 44, 45, 55, 56, 57];

  for (const id of localIds) {
    const key = String(id);
    if (!window.CARD_REPO[key]) {
      // Optional: create a stub card if it doesn't exist yet
      window.CARD_REPO[key] = { name: `Card ${key}`, color: "colorless" };
    }
    window.CARD_REPO[key].image = `/cards/image${key}.png`;
  }
})();

// =========================
// Image hierarchy / resolver (safe fallbacks)
// Paste at end of cards.js
// =========================

window.IMAGE_RULES = window.IMAGE_RULES || {
  global: {
    // optional: land images by color (safe if empty)
    landByColor: {},
    // optional: generic fallback by kind (safe if empty)
    kindFallback: {},
    // optional: final URL fallback; set to null to use silhouette
    fallback: null,
    // optional: if true, try /cards/image<ID>.png as a low-tier fallback
    tryConventionalLocalIdImage: false,
  },
  players: {},
};

// Kind detector (safe defaults)
window.CARD_KIND = window.CARD_KIND || function CARD_KIND(cardId) {
  const data = window.CARD_REPO?.[String(cardId)] || {};
  const name = (data.name || "").toLowerCase().trim();

  const isCreature = Number.isFinite(data.power) && Number.isFinite(data.toughness);
  if (isCreature) return "creature";

  const basicLands = new Set(["mountain", "island", "forest", "plains", "swamp"]);
  if (basicLands.has(name)) return "land";

  return "spell";
};

window.resolveCardImage = function resolveCardImage(cardId, opts = {}) {
  const id = String(cardId);
  const playerKey = opts.playerKey || "p1";

  const data = window.CARD_REPO?.[id] || {};
  const kind = window.CARD_KIND(cardId);
  const color = (data.color || "colorless").toLowerCase();

  const rules = window.IMAGE_RULES || {};
  const global = rules.global || {};
  const players = rules.players || {};
  const pr = players[playerKey] || {};
  const templates = pr.templates || {};
  const overrides = pr.overridesByCardId || {};

  // A) Global per-card image in CARD_REPO
  if (typeof data.image === "string" && data.image.trim()) return data.image.trim();

  // B) Per-player override for this cardId
  const ov = overrides[id];
  if (typeof ov === "string" && ov.trim()) return ov.trim();

  // C) Per-player template by kind (e.g. creature)
  const t = templates[kind];
  if (typeof t === "string" && t.trim()) return t.trim();

  // D) Global land-by-color (cross-player)
  if (kind === "land") {
    const landByColor = global.landByColor || {};
    const landImg = landByColor[color] || landByColor.colorless;
    if (typeof landImg === "string" && landImg.trim()) return landImg.trim();
  }

  // E) Global kind fallback (optional)
  const kfb = (global.kindFallback || {})[kind] || (global.kindFallback || {}).unknown;
  if (typeof kfb === "string" && kfb.trim()) return kfb.trim();

  // F) Conventional local fallback (optional)
  if (global.tryConventionalLocalIdImage) {
    return `/cards/image${id}.png`;
  }

  // G) Final URL fallback (optional) — if null/empty, return null => silhouette
  const fb = global.fallback;
  if (typeof fb === "string" && fb.trim()) return fb.trim();

  return null; // ✅ "naked silhouette" final fallback
};

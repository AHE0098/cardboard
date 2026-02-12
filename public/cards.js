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
// Image hierarchy / resolver
// Paste at end of cards.js
// =========================

// 1) Configure global + per-player image rules here.
// Put your real files in /public/cards/ (or /public/cards/players/...).
window.IMAGE_RULES = {
  // Global per-color land art (same for all players)
  global: {
    landByColor: {
      red:   "/cards/lands/land-red.png",
      blue:  "/cards/lands/land-blue.png",
      green: "/cards/lands/land-green.png",
      white: "/cards/lands/land-white.png",
      black: "/cards/lands/land-black.png",
      colorless: "/cards/lands/land-colorless.png",
    },

    // Generic fallback by kind (optional)
    kindFallback: {
      creature: "/cards/generic/creature.png",
      spell:    "/cards/generic/spell.png",
      land:     "/cards/generic/land.png",
      unknown:  "/cards/generic/unknown.png",
    },

    // Ultimate fallback if nothing else matches
    fallback: "/cards/generic/unknown.png",
  },

  // Per-player templates + per-card overrides
  players: {
    // keys can be "p1"/"p2" etc. You decide the scheme.
    p1: {
      templates: {
        creature: "/cards/players/p1/creature.png",
        spell:    "/cards/players/p1/spell.png", // optional
      },
      overridesByCardId: {
        // "42": "/cards/players/p1/special-goblin.png"
      },
    },
    p2: {
      templates: {
        creature: "/cards/players/p2/creature.png",
      },
      overridesByCardId: {},
    },
  },
};

// 2) Decide "kind" of card.
// - If it has numeric power+toughness => creature
// - If its name is a basic land => land
// - Else => spell (good enough for v0)
window.CARD_KIND = function CARD_KIND(cardId) {
  const data = window.CARD_REPO?.[String(cardId)] || {};
  const name = (data.name || "").toLowerCase().trim();

  const isCreature = Number.isFinite(data.power) && Number.isFinite(data.toughness);
  if (isCreature) return "creature";

  const basicLands = new Set(["mountain", "island", "forest", "plains", "swamp"]);
  if (basicLands.has(name)) return "land";

  return "spell";
};

// 3) Resolve the best image for a given card + player.
// Priority:
// A) CARD_REPO[id].image (global per-card)
// B) player override for this cardId
// C) player template by kind (e.g. creature)
// D) global land-by-color for lands
// E) global kindFallback
// F) global fallback
window.resolveCardImage = function resolveCardImage(cardId, opts = {}) {
  const id = String(cardId);
  const playerKey = opts.playerKey || "p1";

  const data = window.CARD_REPO?.[id] || {};
  const kind = window.CARD_KIND(cardId);
  const color = (data.color || "colorless").toLowerCase();

  // A) card-specific image in CARD_REPO
  if (data.image) return data.image;

  // B) per-player override by cardId
  const pr = window.IMAGE_RULES?.players?.[playerKey];
  const override = pr?.overridesByCardId?.[id];
  if (override) return override;

  // C) per-player template by kind
  const templ = pr?.templates?.[kind];
  if (templ) return templ;

  // D) global land-by-color (cross-player)
  if (kind === "land") {
    const landImg = window.IMAGE_RULES?.global?.landByColor?.[color]
      || window.IMAGE_RULES?.global?.landByColor?.colorless;
    if (landImg) return landImg;
  }

  // E) global kind fallback
  const kfb = window.IMAGE_RULES?.global?.kindFallback?.[kind]
    || window.IMAGE_RULES?.global?.kindFallback?.unknown;
  if (kfb) return kfb;

  // F) final fallback
  return window.IMAGE_RULES?.global?.fallback || "";
};

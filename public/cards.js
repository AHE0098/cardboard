window.CARD_REPO = {
  ...(window.CARD_REPO || {}),
// =====================
// GENERIC LANDS CHUNK
// =====================
  "101": { name: "Plains",  color: "white", cost: "" },
  "102": { name: "Island",  color: "blue",  cost: "" },
  "103": { name: "Swamp",   color: "black", cost: "" },
  "104": { name: "Mountain",color: "red",   cost: "" },
  "105": { name: "Forest",  color: "green", cost: "" },
  "106": { name: "Wastes",  color: "colorless", cost: "" },

// =====================
// 100 CREATURE CARDS CHUNK
// ids 200–299
// =====================
  "200": { name: "Sunfield Sentry",      color: "white",     cost: "W",    power: 1, toughness: 1 },
  "201": { name: "Dawnchapel Acolyte",   color: "white",     cost: "1W",   power: 2, toughness: 1 },
  "202": { name: "Vigilant Gryphon",     color: "white",     cost: "2W",   power: 2, toughness: 3 },
  "203": { name: "Sanctum Warder",       color: "white",     cost: "3W",   power: 3, toughness: 3 },
  "204": { name: "Luminous Paladin",     color: "white",     cost: "4W",   power: 4, toughness: 4 },
  "205": { name: "Cathedral Templar",    color: "white",     cost: "1WW",  power: 3, toughness: 2 },
  "206": { name: "Skyline Patrol",       color: "white",     cost: "2WW",  power: 3, toughness: 4 },
  "207": { name: "Haloed Lion",          color: "white",     cost: "2W",   power: 3, toughness: 2 },
  "208": { name: "Silverblade Pilgrim",  color: "white",     cost: "W",    power: 1, toughness: 2 },
  "209": { name: "Bannerhold Knight",    color: "white",     cost: "3W",   power: 2, toughness: 5 },

  "210": { name: "Mistshore Sprite",     color: "blue",      cost: "U",    power: 1, toughness: 1 },
  "211": { name: "Tidepool Adept",       color: "blue",      cost: "1U",   power: 1, toughness: 3 },
  "212": { name: "Glimmerfin Seer",      color: "blue",      cost: "2U",   power: 2, toughness: 2 },
  "213": { name: "Cloudbank Djinn",      color: "blue",      cost: "3U",   power: 3, toughness: 2 },
  "214": { name: "Aetherwind Drake",     color: "blue",      cost: "4U",   power: 4, toughness: 3 },
  "215": { name: "Arcane Archivist",     color: "blue",      cost: "1UU",  power: 2, toughness: 3 },
  "216": { name: "Riftglass Illusionist",color: "blue",      cost: "2UU",  power: 3, toughness: 3 },
  "217": { name: "Currentweaver",        color: "blue",      cost: "2U",   power: 1, toughness: 4 },
  "218": { name: "Sapphire Skimmer",     color: "blue",      cost: "U",    power: 0, toughness: 3 },
  "219": { name: "Stormcall Sphinx",     color: "blue",      cost: "5U",   power: 5, toughness: 5 },

  "220": { name: "Graveyard Rat",        color: "black",     cost: "B",    power: 1, toughness: 1 },
  "221": { name: "Duskrite Initiate",    color: "black",     cost: "1B",   power: 2, toughness: 1 },
  "222": { name: "Crypt Alley Stalker",  color: "black",     cost: "2B",   power: 2, toughness: 2 },
  "223": { name: "Mirebound Reaver",     color: "black",     cost: "3B",   power: 3, toughness: 3 },
  "224": { name: "Nightmarket Brute",    color: "black",     cost: "4B",   power: 4, toughness: 3 },
  "225": { name: "Bonecoil Cultist",     color: "black",     cost: "1BB",  power: 3, toughness: 2 },
  "226": { name: "Carrion Banneret",     color: "black",     cost: "2BB",  power: 4, toughness: 3 },
  "227": { name: "Sootveil Assassin",    color: "black",     cost: "2B",   power: 3, toughness: 1 },
  "228": { name: "Gutter Ghoul",         color: "black",     cost: "B",    power: 2, toughness: 1 },
  "229": { name: "Abyssal Enforcer",     color: "black",     cost: "5B",   power: 6, toughness: 5 },

  "230": { name: "Ashlane Imp",          color: "red",       cost: "R",    power: 2, toughness: 1 },
  "231": { name: "Torchstreet Runner",   color: "red",       cost: "1R",   power: 2, toughness: 2 },
  "232": { name: "Cinderpeak Lizard",    color: "red",       cost: "2R",   power: 3, toughness: 2 },
  "233": { name: "Furnace Alley Brawler",color: "red",       cost: "3R",   power: 4, toughness: 2 },
  "234": { name: "Blazehorn Minotaur",   color: "red",       cost: "4R",   power: 5, toughness: 3 },
  "235": { name: "Skullcrack Berserker", color: "red",       cost: "1RR",  power: 4, toughness: 2 },
  "236": { name: "Magmaw Warbeast",      color: "red",       cost: "2RR",  power: 5, toughness: 3 },
  "237": { name: "Rubblebelt Goblin",    color: "red",       cost: "1R",   power: 3, toughness: 1 },
  "238": { name: "Sparksmith Pup",       color: "red",       cost: "R",    power: 1, toughness: 2 },
  "239": { name: "Volcano Titan",        color: "red",       cost: "5R",   power: 6, toughness: 4 },

  "240": { name: "Bramble Scout",        color: "green",     cost: "G",    power: 1, toughness: 1 },
  "241": { name: "Mosswood Forager",     color: "green",     cost: "1G",   power: 2, toughness: 2 },
  "242": { name: "Thicket Stag",         color: "green",     cost: "2G",   power: 3, toughness: 3 },
  "243": { name: "Wildgrove Guardian",   color: "green",     cost: "3G",   power: 4, toughness: 4 },
  "244": { name: "Ancient Canopy Hydra", color: "green",     cost: "5G",   power: 6, toughness: 6 },
  "245": { name: "Rootcall Druid",       color: "green",     cost: "1GG",  power: 3, toughness: 3 },
  "246": { name: "Boulderback Rhino",    color: "green",     cost: "2GG",  power: 5, toughness: 4 },
  "247": { name: "Vinelash Predator",    color: "green",     cost: "2G",   power: 4, toughness: 2 },
  "248": { name: "Sapling Protector",    color: "green",     cost: "G",    power: 0, toughness: 3 },
  "249": { name: "Grovecolossus",        color: "green",     cost: "6G",   power: 8, toughness: 7 },

  "250": { name: "Ironclad Automaton",   color: "colorless", cost: "2",    power: 2, toughness: 3 },
  "251": { name: "Clockwork Hound",      color: "colorless", cost: "3",    power: 3, toughness: 2 },
  "252": { name: "Scrapplate Golem",     color: "colorless", cost: "4",    power: 4, toughness: 4 },
  "253": { name: "Vault Sentinel",       color: "colorless", cost: "5",    power: 5, toughness: 5 },
  "254": { name: "Copperwing Drone",     color: "colorless", cost: "2",    power: 1, toughness: 4 },
  "255": { name: "Stoneframe Construct", color: "colorless", cost: "3",    power: 2, toughness: 5 },
  "256": { name: "Brassbone Colossus",   color: "colorless", cost: "7",    power: 7, toughness: 7 },
  "257": { name: "Rustbelt Marauder",    color: "colorless", cost: "4",    power: 5, toughness: 3 },
  "258": { name: "Warden of Gears",      color: "colorless", cost: "6",    power: 6, toughness: 6 },
  "259": { name: "Glassjaw Idol",        color: "colorless", cost: "1",    power: 1, toughness: 1 },

  "260": { name: "Sunriver Duelist",     color: "white",     cost: "2W",   power: 2, toughness: 2 },
  "261": { name: "Oathbound Captain",    color: "white",     cost: "3W",   power: 4, toughness: 2 },
  "262": { name: "Gleamshield Veteran",  color: "white",     cost: "1W",   power: 1, toughness: 3 },
  "263": { name: "Marblewing Falcon",    color: "white",     cost: "2W",   power: 3, toughness: 1 },
  "264": { name: "Blessed Charger",      color: "white",     cost: "4W",   power: 5, toughness: 4 },

  "265": { name: "Harbor Trickster",     color: "blue",      cost: "2U",   power: 2, toughness: 3 },
  "266": { name: "Mirrorpool Mimic",     color: "blue",      cost: "3U",   power: 3, toughness: 3 },
  "267": { name: "Frostwake Serpent",    color: "blue",      cost: "4U",   power: 5, toughness: 2 },
  "268": { name: "Thoughtnet Adept",     color: "blue",      cost: "1U",   power: 1, toughness: 2 },
  "269": { name: "Skyvault Leviathan",   color: "blue",      cost: "6U",   power: 7, toughness: 7 },

  "270": { name: "Grim Alley Cutthroat", color: "black",     cost: "2B",   power: 3, toughness: 2 },
  "271": { name: "Coffinroad Wretch",    color: "black",     cost: "3B",   power: 4, toughness: 1 },
  "272": { name: "Bloodsworn Hexer",     color: "black",     cost: "1BB",  power: 3, toughness: 3 },
  "273": { name: "Rotfen Stalker",       color: "black",     cost: "B",    power: 1, toughness: 2 },
  "274": { name: "Dreadmarsh Behemoth",  color: "black",     cost: "6B",   power: 7, toughness: 6 },

  "275": { name: "Emberline Duelist",    color: "red",       cost: "2R",   power: 3, toughness: 3 },
  "276": { name: "Blistercoil Rager",    color: "red",       cost: "1R",   power: 3, toughness: 2 },
  "277": { name: "Scorch Ridge Ravager", color: "red",       cost: "3R",   power: 5, toughness: 2 },
  "278": { name: "Kragmaw Charger",      color: "red",       cost: "4R",   power: 5, toughness: 5 },
  "279": { name: "Firebrand Whelp",      color: "red",       cost: "R",    power: 1, toughness: 1 },

  "280": { name: "Leafline Ranger",      color: "green",     cost: "2G",   power: 3, toughness: 2 },
  "281": { name: "Barkhide Bruiser",     color: "green",     cost: "3G",   power: 4, toughness: 3 },
  "282": { name: "Thornwood Striker",    color: "green",     cost: "1G",   power: 2, toughness: 1 },
  "283": { name: "Gladehorn Elk",        color: "green",     cost: "2G",   power: 2, toughness: 4 },
  "284": { name: "Primeval Stomper",     color: "green",     cost: "5G",   power: 6, toughness: 5 },

  "285": { name: "Twinbanner Skirmisher",color: "white",     cost: "1W",   power: 2, toughness: 2 },
  "286": { name: "Aetherlane Courier",   color: "blue",      cost: "2U",   power: 2, toughness: 2 },
  "287": { name: "Sablecrypt Runner",    color: "black",     cost: "1B",   power: 2, toughness: 2 },
  "288": { name: "Cinderstreet Raider",  color: "red",       cost: "1R",   power: 2, toughness: 2 },
  "289": { name: "Greenbelt Mauler",     color: "green",     cost: "1G",   power: 3, toughness: 2 },

  "290": { name: "Ivory Spires Guard",   color: "white",     cost: "2W",   power: 1, toughness: 5 },
  "291": { name: "Seawind Familiar",     color: "blue",      cost: "1U",   power: 2, toughness: 1 },
  "292": { name: "Graveshade Brute",     color: "black",     cost: "2B",   power: 4, toughness: 2 },
  "293": { name: "Razecrag Howler",      color: "red",       cost: "3R",   power: 4, toughness: 4 },
  "294": { name: "Canopy Watcher",       color: "green",     cost: "2G",   power: 2, toughness: 5 },

  "295": { name: "Whitehall Crusader",   color: "white",     cost: "4W",   power: 4, toughness: 5 },
  "296": { name: "Deepglass Oracle",     color: "blue",      cost: "4U",   power: 3, toughness: 5 },
  "297": { name: "Obsidian Pit Lord",    color: "black",     cost: "5B",   power: 6, toughness: 6 },
  "298": { name: "Flamecrown Champion",  color: "red",       cost: "4R",   power: 6, toughness: 3 },
  "299": { name: "Elderwood Ancient",    color: "green",     cost: "6G",   power: 7, toughness: 8 },
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

  const basicLands = new Set(["mountain", "island", "forest", "plains", "swamp", "wastes"]);
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

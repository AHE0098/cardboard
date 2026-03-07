/*
How to use:
1) Run your R export.
2) Copy the generated deck pack output.
3) Paste it into the `window.CARDBOARD_PASTED_DECKS` array below.
4) Refresh the browser.

PASTE R OUTPUT HERE:
- Add/replace objects inside `window.CARDBOARD_PASTED_DECKS`.
- Each deck supports:
  - cards: either expanded IDs (e.g. ["101","101","MANUAL_1_1"]) OR qty rows (e.g. [{ cardId:"101", qty:2 }]).
  - sideboard: same format as cards.
  - embeddedCards: optional map of cardId -> card definition for self-contained decks.
*/

window.CARDBOARD_PASTED_DECKS = window.CARDBOARD_PASTED_DECKS || [
  {
  id: "r_storm_1337",
  name: "A",
  author: "R export",
  createdAt: "2026-02-22",
  notes: "seed 1337",
  format: "cardboard",
  cards: [
    { cardId: "102_1", qty: 1 },
    { cardId: "102_2", qty: 1 },
    { cardId: "102_3", qty: 1 },
    { cardId: "102_4", qty: 1 },
    { cardId: "102_5", qty: 1 },
    { cardId: "102_6", qty: 1 },
    { cardId: "102_7", qty: 1 },
    { cardId: "102_8", qty: 1 },
    { cardId: "102_9", qty: 1 },
    { cardId: "104_1", qty: 1 },
    { cardId: "104_2", qty: 1 },
    { cardId: "104_3", qty: 1 },
    { cardId: "104_4", qty: 1 },
    { cardId: "104_5", qty: 1 },
    { cardId: "104_6", qty: 1 },
    { cardId: "104_7", qty: 1 },
    { cardId: "104_8", qty: 1 },
    { cardId: "2004_2", qty: 1 },
    { cardId: "2012_1", qty: 1 },
    { cardId: "2018_4", qty: 1 },
    { cardId: "2022_1", qty: 1 },
    { cardId: "2024_2", qty: 1 },
    { cardId: "2026_3", qty: 1 },
    { cardId: "2034_2", qty: 3 },
    { cardId: "2039_4", qty: 1 },
    { cardId: "2046_3", qty: 1 },
    { cardId: "2047_4", qty: 1 },
    { cardId: "2053_6", qty: 1 },
    { cardId: "2055_2", qty: 1 },
    { cardId: "2056_3", qty: 1 },
    { cardId: "2066_3", qty: 2 },
    { cardId: "2067_3", qty: 1 },
    { cardId: "2069_4", qty: 1 },
    { cardId: "2087_8", qty: 1 },
    { cardId: "2089_5", qty: 1 } //,
 //   { cardId: "MANUAL_1_1", qty: 1 },
 //   { cardId: "MANUAL_1_2", qty: 1 },
 //   { cardId: "MANUAL_1_3", qty: 1 },
 //   { cardId: "MANUAL_2_1", qty: 1 },
 //   { cardId: "MANUAL_2_2", qty: 1 },
 //   { cardId: "MANUAL_2_3", qty: 1 }
  ],
  embeddedCards: {
    "102_1": { name: "Island", color: "U", cost: "", power: null, toughness: null, value: null, type: "basic_land" },
    "102_2": { name: "Island", color: "U", cost: "", power: null, toughness: null, value: null, type: "basic_land" },
    "102_3": { name: "Island", color: "U", cost: "", power: null, toughness: null, value: null, type: "basic_land" },
    "102_4": { name: "Island", color: "U", cost: "", power: null, toughness: null, value: null, type: "basic_land" },
    "102_5": { name: "Island", color: "U", cost: "", power: null, toughness: null, value: null, type: "basic_land" },
    "102_6": { name: "Island", color: "U", cost: "", power: null, toughness: null, value: null, type: "basic_land" },
    "102_7": { name: "Island", color: "U", cost: "", power: null, toughness: null, value: null, type: "basic_land" },
    "102_8": { name: "Island", color: "U", cost: "", power: null, toughness: null, value: null, type: "basic_land" },
    "102_9": { name: "Island", color: "U", cost: "", power: null, toughness: null, value: null, type: "basic_land" },
    "104_1": { name: "Mountain", color: "R", cost: "", power: null, toughness: null, value: null, type: "basic_land" },
    "104_2": { name: "Mountain", color: "R", cost: "", power: null, toughness: null, value: null, type: "basic_land" },
    "104_3": { name: "Mountain", color: "R", cost: "", power: null, toughness: null, value: null, type: "basic_land" },
    "104_4": { name: "Mountain", color: "R", cost: "", power: null, toughness: null, value: null, type: "basic_land" },
    "104_5": { name: "Mountain", color: "R", cost: "", power: null, toughness: null, value: null, type: "basic_land" },
    "104_6": { name: "Mountain", color: "R", cost: "", power: null, toughness: null, value: null, type: "basic_land" },
    "104_7": { name: "Mountain", color: "R", cost: "", power: null, toughness: null, value: null, type: "basic_land" },
    "104_8": { name: "Mountain", color: "R", cost: "", power: null, toughness: null, value: null, type: "basic_land" } //,
//    "MANUAL_1_1": { name: "Storm", color: "", cost: "2", power: null, toughness: null, value: null, type: "instant" },
 //   "MANUAL_1_2": { name: "Storm", color: "", cost: "2", power: null, toughness: null, value: null, type: "instant" },
  //  "MANUAL_1_3": { name: "Storm", color: "", cost: "2", power: null, toughness: null, value: null, type: "instant" },
   // "MANUAL_2_1": { name: "Storm", color: "", cost: "1", power: null, toughness: null, value: null, type: "instant" },
   // "MANUAL_2_2": { name: "Storm", color: "", cost: "1", power: null, toughness: null, value: null, type: "instant" },
   // "MANUAL_2_3": { name: "Storm", color: "", cost: "1", power: null, toughness: null, value: null, type: "instant" }
  }
  },

  {
  id: "friend_D-B818CB",
  name: "Friends Deck 3",
  author: "Imported",
  createdAt: "2026-03-04T13:00:23.714Z",
  notes: "Imported from engine v4.0. Advanced rules stripped; text preserved where possible.",
  format: "cardboard",
  cards: [
    { cardId: "card_000", qty: 1 },
    { cardId: "card_001", qty: 1 },
    { cardId: "card_002", qty: 1 },
    { cardId: "card_003", qty: 1 },
    { cardId: "card_004", qty: 1 },
    { cardId: "card_005", qty: 1 },
    { cardId: "card_006", qty: 1 },
    { cardId: "card_007", qty: 1 },
    { cardId: "card_008", qty: 1 },
    { cardId: "card_009", qty: 1 },
    { cardId: "card_010", qty: 1 },
    { cardId: "card_011", qty: 1 },
    { cardId: "card_012", qty: 1 },
    { cardId: "card_013", qty: 1 },
    { cardId: "card_014", qty: 1 },
    { cardId: "card_015", qty: 1 },
    { cardId: "card_016", qty: 1 },
    { cardId: "card_017", qty: 1 },
    { cardId: "card_018", qty: 1 },
    { cardId: "card_019", qty: 1 },
    { cardId: "card_020", qty: 1 },
    { cardId: "card_021", qty: 1 },
    { cardId: "card_022", qty: 1 },
    { cardId: "card_023", qty: 1 },
    { cardId: "card_024", qty: 1 },
    { cardId: "card_025", qty: 1 },
    { cardId: "card_026", qty: 1 },
    { cardId: "card_027", qty: 1 },
    { cardId: "card_028", qty: 1 },
    { cardId: "card_029", qty: 1 },
    { cardId: "card_030", qty: 1 },
    { cardId: "card_031", qty: 1 },
    { cardId: "card_032", qty: 1 },
    { cardId: "card_033", qty: 1 },
    { cardId: "card_034", qty: 1 },
    { cardId: "card_035", qty: 1 },
    { cardId: "card_036", qty: 1 },
    { cardId: "card_037", qty: 1 },
    { cardId: "card_038", qty: 1 },
    { cardId: "card_039", qty: 1 },
    { cardId: "card_040", qty: 1 },
    { cardId: "card_041", qty: 1 },
    { cardId: "card_042", qty: 1 },
    { cardId: "card_043", qty: 1 },
    { cardId: "card_044", qty: 1 },
    { cardId: "card_045", qty: 1 },
    { cardId: "card_046", qty: 1 },
    { cardId: "card_047", qty: 1 },
    { cardId: "card_048", qty: 1 },
    { cardId: "card_049", qty: 1 },
    { cardId: "card_050", qty: 1 },
    { cardId: "card_051", qty: 1 },
    { cardId: "card_052", qty: 1 },
    { cardId: "card_053", qty: 1 },
    { cardId: "card_054", qty: 1 },
    { cardId: "card_055", qty: 1 },
    { cardId: "card_056", qty: 1 },
    { cardId: "card_057", qty: 1 },
    { cardId: "card_058", qty: 1 },
    { cardId: "card_059", qty: 1 }
  ],
  embeddedCards: {
    "card_000": {
      name: "Wasted Phoenix",
      color: "Sun",
      cost: "4",
      power: 3,
      toughness: 2,
      value: null,
      type: "creature",
      originalType: "Animal",
      traits: ["super_drinking"],
      text: "Deals both normal damage AND Drunk tokens."
    },
    "card_001": {
      name: "Solar Phoenix",
      color: "Sun",
      cost: "3",
      power: 3,
      toughness: 3,
      value: null,
      type: "creature",
      originalType: "Animal",
      traits: [],
      text: ""
    },
    "card_002": {
      name: "Sun Tree",
      color: "Sun",
      cost: "",
      power: null,
      toughness: null,
      value: null,
      type: "basic_land",
      originalType: "Tree",
      traits: [],
      text: "Generate 1 Sun resource for the current phase."
    },
    "card_003": {
      name: "Sun Tree",
      color: "Sun",
      cost: "",
      power: null,
      toughness: null,
      value: null,
      type: "basic_land",
      originalType: "Tree",
      traits: [],
      text: "Generate 1 Sun resource for the current phase."
    },
    "card_004": {
      name: "Apathy",
      color: "Sun",
      cost: "2",
      power: null,
      toughness: 5,
      value: null,
      type: "spell",
      originalType: "Vibe",
      traits: [],
      text: "Attach to an Animal YOU control. Cannot attack or block. Heal 2 Life to your player at the start of your turn."
    },
    "card_005": {
      name: "Toxic Griffin",
      color: "Sun",
      cost: "3",
      power: 3,
      toughness: 1,
      value: null,
      type: "creature",
      originalType: "Animal",
      traits: ["venomous"],
      text: "If this animal deals damage to another animal, that animal is killed regardless of its Life."
    },
    "card_006": {
      name: "Radiant Phoenix",
      color: "Sun",
      cost: "4",
      power: 1,
      toughness: 1,
      value: null,
      type: "creature",
      originalType: "Animal",
      traits: ["adaptive"],
      text: "At the start of your turn, place a +1/+1 counter on this animal permanently."
    },
    "card_007": {
      name: "Sun Tree",
      color: "Sun",
      cost: "",
      power: null,
      toughness: null,
      value: null,
      type: "basic_land",
      originalType: "Tree",
      traits: [],
      text: "Generate 1 Sun resource for the current phase."
    },
    "card_008": {
      name: "Golden Pegasus",
      color: "Sun",
      cost: "5",
      power: 7,
      toughness: 1,
      value: null,
      type: "creature",
      originalType: "Animal",
      traits: ["rabid"],
      text: "This animal MUST attack each turn if able."
    },
    "card_009": {
      name: "Carrion Sphinx",
      color: "Sun",
      cost: "5",
      power: 3,
      toughness: 2,
      value: null,
      type: "creature",
      originalType: "Animal",
      traits: ["scavenger"],
      text: "Whenever another animal dies, choose one: Heal 1 Life to your player OR put a +1/+1 counter on this animal."
    },
    "card_010": {
      name: "Sun Tree",
      color: "Sun",
      cost: "",
      power: null,
      toughness: null,
      value: null,
      type: "basic_land",
      originalType: "Tree",
      traits: [],
      text: "Generate 1 Sun resource for the current phase."
    },
    "card_011": {
      name: "Sun Tree",
      color: "Sun",
      cost: "",
      power: null,
      toughness: null,
      value: null,
      type: "basic_land",
      originalType: "Tree",
      traits: [],
      text: "Generate 1 Sun resource for the current phase."
    },
    "card_012": {
      name: "Sun Tree",
      color: "Sun",
      cost: "",
      power: null,
      toughness: null,
      value: null,
      type: "basic_land",
      originalType: "Tree",
      traits: [],
      text: "Generate 1 Sun resource for the current phase."
    },
    "card_013": {
      name: "Zoomies",
      color: "Sun",
      cost: "2",
      power: null,
      toughness: 3,
      value: null,
      type: "spell",
      originalType: "Vibe",
      traits: [],
      text: "Attach to an Animal. Gains Rabid and Ambush. Opponent chooses attack target."
    },
    "card_014": {
      name: "Contra Wind",
      color: "Sun",
      cost: "2",
      power: null,
      toughness: null,
      value: null,
      type: "instant",
      originalType: "Force",
      traits: [],
      text: "Prevent 1 attacking animal."
    },
    "card_015": {
      name: "Sun Tree",
      color: "Sun",
      cost: "",
      power: null,
      toughness: null,
      value: null,
      type: "basic_land",
      originalType: "Tree",
      traits: [],
      text: "Generate 1 Sun resource for the current phase."
    },
    "card_016": {
      name: "Blazing Sphinx",
      color: "Sun",
      cost: "1",
      power: 1,
      toughness: 1,
      value: null,
      type: "creature",
      originalType: "Animal",
      traits: [],
      text: ""
    },
    "card_017": {
      name: "Armored Griffin",
      color: "Sun",
      cost: "3",
      power: 1,
      toughness: 1,
      value: null,
      type: "creature",
      originalType: "Animal",
      traits: ["carapace"],
      text: "This animal enters with a Carapace counter. The first time this animal would take damage or be killed, ignore it and remove the Carapace counter instead."
    },
    "card_018": {
      name: "Sun Tree",
      color: "Sun",
      cost: "",
      power: null,
      toughness: null,
      value: null,
      type: "basic_land",
      originalType: "Tree",
      traits: [],
      text: "Generate 1 Sun resource for the current phase."
    },
    "card_019": {
      name: "Golden Sphinx",
      color: "Sun",
      cost: "3",
      power: 2,
      toughness: 2,
      value: null,
      type: "creature",
      originalType: "Animal",
      traits: ["stampede"],
      text: "Damage spillover: If this deals lethal damage to an animal, excess damage hits the player."
    },
    "card_020": {
      name: "Holy Oracle",
      color: "Sun",
      cost: "2",
      power: 3,
      toughness: 1,
      value: null,
      type: "creature",
      originalType: "Animal",
      traits: [],
      text: ""
    },
    "card_021": {
      name: "Gathering Sphinx",
      color: "Sun",
      cost: "3",
      power: 2,
      toughness: 1,
      value: null,
      type: "creature",
      originalType: "Animal",
      traits: ["foraging"],
      text: "When this animal is played, draw a card."
    },
    "card_022": {
      name: "Soaring Sphinx",
      color: "Sun",
      cost: "3",
      power: 2,
      toughness: 1,
      value: null,
      type: "creature",
      originalType: "Animal",
      traits: ["flying"],
      text: "Evasion: When attacking a ground animal, they cannot strike back. Direct attacks to the player can only be intercepted by other Flying animals."
    },
    "card_023": {
      name: "Stumbling Stallion",
      color: "Sun",
      cost: "4",
      power: 3,
      toughness: 4,
      value: null,
      type: "creature",
      originalType: "Animal",
      traits: ["drinking"],
      text: "Drunk Tokens penalty replacing normal damage."
    },
    "card_024": {
      name: "Roaring Oracle",
      color: "Sun",
      cost: "2",
      power: 3,
      toughness: 1,
      value: null,
      type: "creature",
      originalType: "Animal",
      traits: ["loud"],
      text: "Defender may play a free animal on attack."
    },
    "card_025": {
      name: "Omnipotence",
      color: "Sun",
      cost: "3",
      power: null,
      toughness: 3,
      value: null,
      type: "spell",
      originalType: "Vibe",
      traits: [],
      text: "Attach to an Animal. Gains Stampede and +3 Strength. Damage dealt TO this animal is doubled."
    },
    "card_026": {
      name: "Sun Tree",
      color: "Sun",
      cost: "",
      power: null,
      toughness: null,
      value: null,
      type: "basic_land",
      originalType: "Tree",
      traits: [],
      text: "Generate 1 Sun resource for the current phase."
    },
    "card_027": {
      name: "Blazing Sphinx",
      color: "Sun",
      cost: "1",
      power: 1,
      toughness: 1,
      value: null,
      type: "creature",
      originalType: "Animal",
      traits: [],
      text: ""
    },
    "card_028": {
      name: "Golden Phoenix",
      color: "Sun",
      cost: "5",
      power: 2,
      toughness: 3,
      value: null,
      type: "creature",
      originalType: "Animal",
      traits: ["toxic_masculinity"],
      text: "Deals normal damage, Drunk tokens, AND allows a physical slap."
    },
    "card_029": {
      name: "Immortal Sphinx",
      color: "Sun",
      cost: "4",
      power: 2,
      toughness: 2,
      value: null,
      type: "creature",
      originalType: "Animal",
      traits: ["reincarnation"],
      text: "When this animal dies, you may take another dead animal from your Compost and put it into your hand."
    },
    "card_030": {
      name: "Sun Tree",
      color: "Sun",
      cost: "",
      power: null,
      toughness: null,
      value: null,
      type: "basic_land",
      originalType: "Tree",
      traits: [],
      text: "Generate 1 Sun resource for the current phase."
    },
    "card_031": {
      name: "Instinct",
      color: "Sun",
      cost: "4",
      power: null,
      toughness: 6,
      value: null,
      type: "spell",
      originalType: "Vibe",
      traits: [],
      text: "Attach to an Animal. Gains +2 Life. Damage to your player or other animals is redirected here."
    },
    "card_032": {
      name: "Luminous Phoenix",
      color: "Sun",
      cost: "3",
      power: 2,
      toughness: 2,
      value: null,
      type: "creature",
      originalType: "Animal",
      traits: ["healing"],
      text: "Heals controller equal to the amount of damage or tokens dealt to a player."
    },
    "card_033": {
      name: "Solar Pegasus",
      color: "Sun",
      cost: "2",
      power: 1,
      toughness: 3,
      value: null,
      type: "creature",
      originalType: "Animal",
      traits: [],
      text: ""
    },
    "card_034": {
      name: "Divine Oracle",
      color: "Sun",
      cost: "2",
      power: 1,
      toughness: 2,
      value: null,
      type: "creature",
      originalType: "Animal",
      traits: ["healing"],
      text: "Heals controller equal to the amount of damage or tokens dealt to a player."
    },
    "card_035": {
      name: "Human Forces",
      color: "Sun",
      cost: "3",
      power: null,
      toughness: null,
      value: null,
      type: "instant",
      originalType: "Force",
      traits: [],
      text: "Counter a Contra Wind."
    },
    "card_036": {
      name: "Sun Tree",
      color: "Sun",
      cost: "",
      power: null,
      toughness: null,
      value: null,
      type: "basic_land",
      originalType: "Tree",
      traits: [],
      text: "Generate 1 Sun resource for the current phase."
    },
    "card_037": {
      name: "Solar Pegasus",
      color: "Sun",
      cost: "2",
      power: 1,
      toughness: 3,
      value: null,
      type: "creature",
      originalType: "Animal",
      traits: [],
      text: ""
    },
    "card_038": {
      name: "Solar Phoenix",
      color: "Sun",
      cost: "3",
      power: 3,
      toughness: 3,
      value: null,
      type: "creature",
      originalType: "Animal",
      traits: [],
      text: ""
    },
    "card_039": {
      name: "Sun Tree",
      color: "Sun",
      cost: "",
      power: null,
      toughness: null,
      value: null,
      type: "basic_land",
      originalType: "Tree",
      traits: [],
      text: "Generate 1 Sun resource for the current phase."
    },
    "card_040": {
      name: "Alien Forces",
      color: "Sun",
      cost: "4",
      power: null,
      toughness: null,
      value: null,
      type: "instant",
      originalType: "Force",
      traits: [],
      text: "Counter a Human Force."
    },
    "card_041": {
      name: "Sun Tree",
      color: "Sun",
      cost: "",
      power: null,
      toughness: null,
      value: null,
      type: "basic_land",
      originalType: "Tree",
      traits: [],
      text: "Generate 1 Sun resource for the current phase."
    },
    "card_042": {
      name: "Radiant Stallion",
      color: "Sun",
      cost: "2",
      power: 1,
      toughness: 1,
      value: null,
      type: "creature",
      originalType: "Animal",
      traits: ["ambush"],
      text: "When in combat, this animal deals its damage BEFORE the opponent's animal."
    },
    "card_043": {
      name: "Alien Forces",
      color: "Sun",
      cost: "4",
      power: null,
      toughness: null,
      value: null,
      type: "instant",
      originalType: "Force",
      traits: [],
      text: "Counter a Human Force."
    },
    "card_044": {
      name: "Solar Griffin",
      color: "Sun",
      cost: "3",
      power: 2,
      toughness: 1,
      value: null,
      type: "creature",
      originalType: "Animal",
      traits: ["camouflage"],
      text: "This animal cannot be directly targeted by opponent's Forces or Vibes."
    },
    "card_045": {
      name: "Luminous Stallion",
      color: "Sun",
      cost: "2",
      power: 2,
      toughness: 2,
      value: null,
      type: "creature",
      originalType: "Animal",
      traits: [],
      text: ""
    },
    "card_046": {
      name: "Sun Tree",
      color: "Sun",
      cost: "",
      power: null,
      toughness: null,
      value: null,
      type: "basic_land",
      originalType: "Tree",
      traits: [],
      text: "Generate 1 Sun resource for the current phase."
    },
    "card_047": {
      name: "Sun Tree",
      color: "Sun",
      cost: "",
      power: null,
      toughness: null,
      value: null,
      type: "basic_land",
      originalType: "Tree",
      traits: [],
      text: "Generate 1 Sun resource for the current phase."
    },
    "card_048": {
      name: "Radiant Griffin",
      color: "Sun",
      cost: "2",
      power: 2,
      toughness: 1,
      value: null,
      type: "creature",
      originalType: "Animal",
      traits: [],
      text: ""
    },
    "card_049": {
      name: "Brew-Crazed Stallion",
      color: "Sun",
      cost: "2",
      power: 3,
      toughness: 1,
      value: null,
      type: "creature",
      originalType: "Animal",
      traits: ["drinking"],
      text: "Drunk Tokens penalty replacing normal damage."
    },
    "card_050": {
      name: "Sun Tree",
      color: "Sun",
      cost: "",
      power: null,
      toughness: null,
      value: null,
      type: "basic_land",
      originalType: "Tree",
      traits: [],
      text: "Generate 1 Sun resource for the current phase."
    },
    "card_051": {
      name: "Sun Tree",
      color: "Sun",
      cost: "",
      power: null,
      toughness: null,
      value: null,
      type: "basic_land",
      originalType: "Tree",
      traits: [],
      text: "Generate 1 Sun resource for the current phase."
    },
    "card_052": {
      name: "Contra Wind",
      color: "Sun",
      cost: "2",
      power: null,
      toughness: null,
      value: null,
      type: "instant",
      originalType: "Force",
      traits: [],
      text: "Prevent 1 attacking animal."
    },
    "card_053": {
      name: "Lethal Sphinx",
      color: "Sun",
      cost: "1",
      power: 1,
      toughness: 1,
      value: null,
      type: "creature",
      originalType: "Animal",
      traits: ["collateral", "venomous"],
      text: "To declare this animal as an attacker, you must kill another animal you control. If this animal deals damage to another animal, that animal is killed regardless of its Life."
    },
    "card_054": {
      name: "Sun Tree",
      color: "Sun",
      cost: "",
      power: null,
      toughness: null,
      value: null,
      type: "basic_land",
      originalType: "Tree",
      traits: [],
      text: "Generate 1 Sun resource for the current phase."
    },
    "card_055": {
      name: "Sun Tree",
      color: "Sun",
      cost: "",
      power: null,
      toughness: null,
      value: null,
      type: "basic_land",
      originalType: "Tree",
      traits: [],
      text: "Generate 1 Sun resource for the current phase."
    },
    "card_056": {
      name: "Sun Tree",
      color: "Sun",
      cost: "",
      power: null,
      toughness: null,
      value: null,
      type: "basic_land",
      originalType: "Tree",
      traits: [],
      text: "Generate 1 Sun resource for the current phase."
    },
    "card_057": {
      name: "Sun Tree",
      color: "Sun",
      cost: "",
      power: null,
      toughness: null,
      value: null,
      type: "basic_land",
      originalType: "Tree",
      traits: [],
      text: "Generate 1 Sun resource for the current phase."
    },
    "card_058": {
      name: "Soaring Sphinx",
      color: "Sun",
      cost: "3",
      power: 2,
      toughness: 1,
      value: null,
      type: "creature",
      originalType: "Animal",
      traits: ["flying"],
      text: "Evasion: When attacking a ground animal, they cannot strike back. Direct attacks to the player can only be intercepted by other Flying animals."
    },
    "card_059": {
      name: "Luminous Stallion",
      color: "Sun",
      cost: "2",
      power: 2,
      toughness: 2,
      value: null,
      type: "creature",
      originalType: "Animal",
      traits: [],
      text: ""
    }
  }
},

  {
  id: "r_mid_9001",
  name: "B",
  author: "R export",
  createdAt: "2026-02-22",
  notes: "seed 9001",
  format: "cardboard",
  cards: [
    { cardId: "102_1", qty: 1 },
    { cardId: "102_2", qty: 1 },
    { cardId: "102_3", qty: 1 },
    { cardId: "102_4", qty: 1 },
    { cardId: "102_5", qty: 1 },
    { cardId: "102_6", qty: 1 },
    { cardId: "102_7", qty: 1 },
    { cardId: "102_8", qty: 1 },
    { cardId: "102_9", qty: 1 },
    { cardId: "104_1", qty: 1 },
    { cardId: "104_2", qty: 1 },
    { cardId: "104_3", qty: 1 },
    { cardId: "104_4", qty: 1 },
    { cardId: "104_5", qty: 1 },
    { cardId: "104_6", qty: 1 },
    { cardId: "104_7", qty: 1 },
    { cardId: "104_8", qty: 1 },
    { cardId: "2003_2", qty: 1 },
    { cardId: "2004_2", qty: 1 },
    { cardId: "2005_2", qty: 1 },
    { cardId: "2007_3", qty: 1 },
    { cardId: "2011_1", qty: 1 },
    { cardId: "2014_2", qty: 1 },
    { cardId: "2016_3", qty: 1 },
    { cardId: "2021_5", qty: 1 },
    { cardId: "2023_1", qty: 1 },
    { cardId: "2026_3", qty: 3 },
    { cardId: "2030_4", qty: 1 },
    { cardId: "2033_2", qty: 1 },
    { cardId: "2036_2", qty: 1 },
    { cardId: "2038_4", qty: 1 },
    { cardId: "2046_4", qty: 1 },
    { cardId: "2066_3", qty: 1 },
    { cardId: "2097_8", qty: 1 },
    { cardId: "2099_4", qty: 1 },
    { cardId: "2119_10", qty: 1 },
    { cardId: "MANUAL_1_1", qty: 1 },
    { cardId: "MANUAL_1_2", qty: 1 },
    { cardId: "MANUAL_1_3", qty: 1 },
    { cardId: "MANUAL_2_1", qty: 1 },
    { cardId: "MANUAL_2_2", qty: 1 },
    { cardId: "MANUAL_2_3", qty: 1 }
  ],
  embeddedCards: {
    "102_1": { name: "Island", color: "U", cost: "", power: null, toughness: null, value: null, type: "basic_land" },
    "102_2": { name: "Island", color: "U", cost: "", power: null, toughness: null, value: null, type: "basic_land" },
    "102_3": { name: "Island", color: "U", cost: "", power: null, toughness: null, value: null, type: "basic_land" },
    "102_4": { name: "Island", color: "U", cost: "", power: null, toughness: null, value: null, type: "basic_land" },
    "102_5": { name: "Island", color: "U", cost: "", power: null, toughness: null, value: null, type: "basic_land" },
    "102_6": { name: "Island", color: "U", cost: "", power: null, toughness: null, value: null, type: "basic_land" },
    "102_7": { name: "Island", color: "U", cost: "", power: null, toughness: null, value: null, type: "basic_land" },
    "102_8": { name: "Island", color: "U", cost: "", power: null, toughness: null, value: null, type: "basic_land" },
    "102_9": { name: "Island", color: "U", cost: "", power: null, toughness: null, value: null, type: "basic_land" },
    "104_1": { name: "Mountain", color: "R", cost: "", power: null, toughness: null, value: null, type: "basic_land" },
    "104_2": { name: "Mountain", color: "R", cost: "", power: null, toughness: null, value: null, type: "basic_land" },
    "104_3": { name: "Mountain", color: "R", cost: "", power: null, toughness: null, value: null, type: "basic_land" },
    "104_4": { name: "Mountain", color: "R", cost: "", power: null, toughness: null, value: null, type: "basic_land" },
    "104_5": { name: "Mountain", color: "R", cost: "", power: null, toughness: null, value: null, type: "basic_land" },
    "104_6": { name: "Mountain", color: "R", cost: "", power: null, toughness: null, value: null, type: "basic_land" },
    "104_7": { name: "Mountain", color: "R", cost: "", power: null, toughness: null, value: null, type: "basic_land" },
    "104_8": { name: "Mountain", color: "R", cost: "", power: null, toughness: null, value: null, type: "basic_land" },
    "MANUAL_1_1": { name: "Storm", color: "", cost: "2", power: null, toughness: null, value: null, type: "instant" },
    "MANUAL_1_2": { name: "Storm", color: "", cost: "2", power: null, toughness: null, value: null, type: "instant" },
    "MANUAL_1_3": { name: "Storm", color: "", cost: "2", power: null, toughness: null, value: null, type: "instant" },
    "MANUAL_2_1": { name: "Storm", color: "", cost: "1", power: null, toughness: null, value: null, type: "instant" },
    "MANUAL_2_2": { name: "Storm", color: "", cost: "1", power: null, toughness: null, value: null, type: "instant" },
    "MANUAL_2_3": { name: "Storm", color: "", cost: "1", power: null, toughness: null, value: null, type: "instant" }
  }
  }
];

(() => {
  const BASIC_LAND_NAMES = new Set(["plains", "island", "swamp", "mountain", "forest", "wastes"]);

  function isFiniteOrNull(value) {
    return Number.isFinite(Number(value)) ? Number(value) : null;
  }

  function defaultTypeForKind(kind) {
    if (kind === "land") return "land";
    if (kind === "creature") return "creature";
    return "spell";
  }

  function inferKind(cardId, src = {}) {
    const explicit = typeof src.kind === "string" ? src.kind.trim().toLowerCase() : "";
    if (explicit) return explicit;

    const incomingType = typeof src.type === "string" ? src.type.trim().toLowerCase() : "";
    if (incomingType === "basic_land" || incomingType === "land") return "land";
    if (incomingType === "creature") return "creature";
    if (["instant", "sorcery", "spell"].includes(incomingType)) return "spell";

    const power = isFiniteOrNull(src.power);
    const toughness = isFiniteOrNull(src.toughness);
    if (power !== null && toughness !== null) return "creature";

    const name = String(src.name || "").trim().toLowerCase();
    const isBasic = src.isBasic === true || BASIC_LAND_NAMES.has(name);
    if (isBasic) return "land";

    const id = String(cardId || "");
    if (["101", "102", "103", "104", "105", "106"].includes(id)) return "land";

    return "spell";
  }

  window.normalizeCardDef = window.normalizeCardDef || function normalizeCardDef(cardId, cardObj = {}) {
    const id = String(cardId || "").trim();
    const src = (cardObj && typeof cardObj === "object") ? cardObj : {};
    const kind = inferKind(id, src);
    const incomingType = typeof src.type === "string" ? src.type.trim().toLowerCase() : "";

    const normalized = {
      ...src,
      name: String(src.name || "").trim() || `Card ${id || "?"}`,
      text: src.text == null ? "" : String(src.text),
      color: src.color == null ? "" : String(src.color),
      cost: src.cost == null ? "" : String(src.cost),
      kind,
      type: incomingType || defaultTypeForKind(kind),
      power: isFiniteOrNull(src.power),
      toughness: isFiniteOrNull(src.toughness),
      value: isFiniteOrNull(src.value),
      isBasic: src.isBasic === true || kind === "land" && BASIC_LAND_NAMES.has(String(src.name || "").trim().toLowerCase()),
      colorIdentity: src.colorIdentity == null ? "" : String(src.colorIdentity)
    };

    return normalized;
  };

  function mergeCardWithFillMissing(existing, incoming) {
    const out = { ...(existing || {}) };
    Object.entries(incoming || {}).forEach(([key, value]) => {
      const current = out[key];
      const isBlankString = typeof current === "string" && current.trim() === "";
      const isMissing = current == null || isBlankString;
      if (isMissing) out[key] = value;
    });
    return out;
  }

  function normalizeDeckSection(section) {
    if (!Array.isArray(section)) return [];
    const tally = {};

    section.forEach((entry) => {
      if (entry == null) return;

      if (typeof entry === "string" || typeof entry === "number") {
        const cardId = String(entry).trim();
        if (!cardId) return;
        tally[cardId] = (tally[cardId] || 0) + 1;
        return;
      }

      const cardId = String(entry.cardId || entry.id || "").trim();
      const qty = Math.max(0, Math.round(Number(entry.qty || 0)));
      if (!cardId || !qty) return;
      tally[cardId] = (tally[cardId] || 0) + qty;
    });

    return Object.entries(tally).map(([cardId, qty]) => ({ cardId, qty }));
  }

  window.expandDeckCardIds = window.expandDeckCardIds || function expandDeckCardIds(deckLike) {
    const cards = normalizeDeckSection(deckLike?.cards || []);
    const out = [];
    cards.forEach(({ cardId, qty }) => {
      for (let i = 0; i < qty; i += 1) out.push(String(cardId));
    });
    return out;
  };

  function normalizeDeck(deckObj, source = "library") {
    const cards = normalizeDeckSection(deckObj?.cards || []);
    const sideboard = normalizeDeckSection(deckObj?.sideboard || []);
    return {
      ...deckObj,
      id: String(deckObj?.id || `deck_${Date.now()}`),
      name: String(deckObj?.name || "Untitled Deck"),
      author: String(deckObj?.author || ""),
      createdAt: deckObj?.createdAt || new Date().toISOString().slice(0, 10),
      notes: String(deckObj?.notes || ""),
      format: String(deckObj?.format || "cardboard"),
      cards,
      sideboard,
      source
    };
  }

  function ingestEmbeddedCards(deck) {
    const embedded = (deck && typeof deck.embeddedCards === "object" && deck.embeddedCards) ? deck.embeddedCards : {};
    window.CARD_REPO = window.CARD_REPO || {};

    Object.entries(embedded).forEach(([cardId, cardObj]) => {
      const id = String(cardId || "").trim();
      if (!id) return;
      const normalizedIncoming = window.normalizeCardDef(id, cardObj);
      const existing = window.CARD_REPO[id];
      if (!existing) {
        window.CARD_REPO[id] = normalizedIncoming;
        return;
      }
      const normalizedExisting = window.normalizeCardDef(id, existing);
      window.CARD_REPO[id] = mergeCardWithFillMissing(normalizedExisting, normalizedIncoming);
    });
  }

  function normalizeAllKnownCards() {
    window.CARD_REPO = window.CARD_REPO || {};
    Object.entries(window.CARD_REPO).forEach(([cardId, cardObj]) => {
      window.CARD_REPO[cardId] = window.normalizeCardDef(cardId, cardObj);
    });
  }

  function mergePastedDecksIntoLibrary() {
    const library = Array.isArray(window.CARDBOARD_DECK_LIBRARY) ? window.CARDBOARD_DECK_LIBRARY.slice() : [];
    const pastedRaw = Array.isArray(window.CARDBOARD_PASTED_DECKS) ? window.CARDBOARD_PASTED_DECKS : [];
    const pasted = pastedRaw.map((d) => normalizeDeck(d, "pasted"));

    pasted.forEach(ingestEmbeddedCards);

    const byId = new Map();
    library.forEach((deck) => {
      const normalized = normalizeDeck(deck, deck?.source || "library");
      byId.set(normalized.id, normalized);
    });
    pasted.forEach((deck) => byId.set(deck.id, deck));

    window.CARDBOARD_DECK_LIBRARY = Array.from(byId.values());
    window.CARDBOARD_PASTED_DECKS = pasted;
  }

  window.getAllAvailableDecks = window.getAllAvailableDecks || function getAllAvailableDecks() {
    const fromStorage = window.CardboardDeckStorage?.getSavedDecks?.() || [];
    const fromLibrary = Array.isArray(window.CARDBOARD_DECK_LIBRARY) ? window.CARDBOARD_DECK_LIBRARY : [];
    const merged = [];
    const seen = new Set();

    [...fromStorage, ...fromLibrary].forEach((deckObj) => {
      const id = String(deckObj?.id || deckObj?.deckId || "").trim();
      if (!id || seen.has(id)) return;
      seen.add(id);
      merged.push(normalizeDeck(deckObj, deckObj?.source || (fromStorage.includes(deckObj) ? "saved" : "library")));
    });

    return merged;
  };

  mergePastedDecksIntoLibrary();
  normalizeAllKnownCards();
})();

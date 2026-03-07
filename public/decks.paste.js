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
  id: "friend_D-C83CA3",
  name: "Friend (T)horny Deck",
  author: "Imported",
  createdAt: "2026-03-04T13:00:06.792Z",
  notes: "Imported from engine v4.0. Advanced rules stripped; text preserved where possible.",
  format: "cardboard",
  cards: Array.from({ length: 60 }, (_, i) => ({
    cardId: `friend_D-C83CA3__card_${String(i).padStart(3, "0")}`,
    qty: 1
  })),
  embeddedCards: Object.fromEntries(
    Object.entries({
      "card_000": { name: "Thorn Tree", color: "Thorn", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Thorn resource for the current phase." },
      "card_001": { name: "Thorn Tree", color: "Thorn", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Thorn resource for the current phase." },
      "card_002": { name: "Apathy", color: "Thorn", cost: "2", power: null, toughness: 5, value: null, type: "spell", originalType: "Vibe", traits: [], text: "Attach to an Animal YOU control. Cannot attack or block. Heal 2 Life to your player at the start of your turn." },
      "card_003": { name: "Thorn Tree", color: "Thorn", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Thorn resource for the current phase." },
      "card_004": { name: "Thorn Tree", color: "Thorn", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Thorn resource for the current phase." },
      "card_005": { name: "Winged Viper", color: "Thorn", cost: "7", power: 5, toughness: 3, value: null, type: "creature", originalType: "Animal", traits: ["flying"], text: "Evasion: When attacking a ground animal, they cannot strike back. Direct attacks to the player can only be intercepted by other Flying animals." },
      "card_006": { name: "Thorn Tree", color: "Thorn", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Thorn resource for the current phase." },
      "card_007": { name: "Feral Wolf", color: "Thorn", cost: "3", power: 2, toughness: 4, value: null, type: "creature", originalType: "Animal", traits: ["rabid"], text: "This animal MUST attack each turn if able." },
      "card_008": { name: "Barbed Spider", color: "Thorn", cost: "3", power: 4, toughness: 1, value: null, type: "creature", originalType: "Animal", traits: [], text: "" },
      "card_009": { name: "Thorn Tree", color: "Thorn", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Thorn resource for the current phase." },
      "card_010": { name: "Scavenging Bat", color: "Thorn", cost: "6", power: 2, toughness: 4, value: null, type: "creature", originalType: "Animal", traits: ["scavenger"], text: "Whenever another animal dies, choose one: Heal 1 Life to your player OR put a +1/+1 counter on this animal." },
      "card_011": { name: "Thorn Tree", color: "Thorn", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Thorn resource for the current phase." },
      "card_012": { name: "Savage Viper", color: "Thorn", cost: "1", power: 1, toughness: 1, value: null, type: "creature", originalType: "Animal", traits: [], text: "" },
      "card_013": { name: "Thorn Tree", color: "Thorn", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Thorn resource for the current phase." },
      "card_014": { name: "Savage Mantis", color: "Thorn", cost: "5", power: 3, toughness: 3, value: null, type: "creature", originalType: "Animal", traits: ["stampede", "drinking"], text: "Damage spillover: If this deals lethal damage to an animal, excess damage hits the player. Drunk Tokens penalty replacing normal damage." },
      "card_015": { name: "Thorn Tree", color: "Thorn", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Thorn resource for the current phase." },
      "card_016": { name: "Raging Fiend", color: "Thorn", cost: "6", power: 3, toughness: 3, value: null, type: "creature", originalType: "Animal", traits: ["toxic_masculinity"], text: "Deals normal damage, Drunk tokens, AND allows a physical slap." },
      "card_017": { name: "Thorn Tree", color: "Thorn", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Thorn resource for the current phase." },
      "card_018": { name: "Barbed Mantis", color: "Thorn", cost: "2", power: 3, toughness: 1, value: null, type: "creature", originalType: "Animal", traits: [], text: "" },
      "card_019": { name: "Deafening Hound", color: "Thorn", cost: "1", power: 1, toughness: 2, value: null, type: "creature", originalType: "Animal", traits: ["loud"], text: "Defender may play a free animal on attack." },
      "card_020": { name: "Barbed Hound", color: "Thorn", cost: "2", power: 2, toughness: 1, value: null, type: "creature", originalType: "Animal", traits: [], text: "" },
      "card_021": { name: "Thorn Tree", color: "Thorn", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Thorn resource for the current phase." },
      "card_022": { name: "Vicious Spider", color: "Thorn", cost: "4", power: 4, toughness: 3, value: null, type: "creature", originalType: "Animal", traits: [], text: "" },
      "card_023": { name: "Vicious Scorpion", color: "Thorn", cost: "3", power: 3, toughness: 3, value: null, type: "creature", originalType: "Animal", traits: [], text: "" },
      "card_024": { name: "Thorn Tree", color: "Thorn", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Thorn resource for the current phase." },
      "card_025": { name: "Contra Wind", color: "Thorn", cost: "2", power: null, toughness: null, value: null, type: "instant", originalType: "Force", traits: [], text: "Prevent 1 attacking animal." },
      "card_026": { name: "Blood Mantis", color: "Thorn", cost: "2", power: 1, toughness: 3, value: null, type: "creature", originalType: "Animal", traits: [], text: "" },
      "card_027": { name: "Stealthy Mantis", color: "Thorn", cost: "4", power: 2, toughness: 2, value: null, type: "creature", originalType: "Animal", traits: ["camouflage"], text: "This animal cannot be directly targeted by opponent's Forces or Vibes." },
      "card_028": { name: "Thorn Tree", color: "Thorn", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Thorn resource for the current phase." },
      "card_029": { name: "Human Forces", color: "Thorn", cost: "3", power: null, toughness: null, value: null, type: "instant", originalType: "Force", traits: [], text: "Counter a Contra Wind." },
      "card_030": { name: "Blood Mantis", color: "Thorn", cost: "2", power: 1, toughness: 3, value: null, type: "creature", originalType: "Animal", traits: [], text: "" },
      "card_031": { name: "Spite", color: "Thorn", cost: "3", power: null, toughness: 4, value: null, type: "spell", originalType: "Vibe", traits: [], text: "Attach to an Animal. Gains Collateral. When this Vibe is killed, opponent gets 2 Drunk tokens." },
      "card_032": { name: "Thorn Tree", color: "Thorn", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Thorn resource for the current phase." },
      "card_033": { name: "Alien Forces", color: "Thorn", cost: "4", power: null, toughness: null, value: null, type: "instant", originalType: "Force", traits: [], text: "Counter a Human Force." },
      "card_034": { name: "Contra Wind", color: "Thorn", cost: "2", power: null, toughness: null, value: null, type: "instant", originalType: "Force", traits: [], text: "Prevent 1 attacking animal." },
      "card_035": { name: "Thorn Tree", color: "Thorn", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Thorn resource for the current phase." },
      "card_036": { name: "Venomous Viper", color: "Thorn", cost: "2", power: 1, toughness: 2, value: null, type: "creature", originalType: "Animal", traits: ["collateral", "venomous"], text: "To declare this animal as an attacker, you must kill another animal you control. If this animal deals damage to another animal, that animal is killed regardless of its Life." },
      "card_037": { name: "Thorn Tree", color: "Thorn", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Thorn resource for the current phase." },
      "card_038": { name: "Thorn Tree", color: "Thorn", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Thorn resource for the current phase." },
      "card_039": { name: "Instinct", color: "Thorn", cost: "4", power: null, toughness: 6, value: null, type: "spell", originalType: "Vibe", traits: [], text: "Attach to an Animal. Gains +2 Life. Damage to your player or other animals is redirected here." },
      "card_040": { name: "Evolving Hound", color: "Thorn", cost: "4", power: 1, toughness: 1, value: null, type: "creature", originalType: "Animal", traits: ["adaptive"], text: "At the start of your turn, place a +1/+1 counter on this animal permanently." },
      "card_041": { name: "Feral Viper", color: "Thorn", cost: "3", power: 3, toughness: 3, value: null, type: "creature", originalType: "Animal", traits: ["drinking"], text: "Drunk Tokens penalty replacing normal damage." },
      "card_042": { name: "Thorn Tree", color: "Thorn", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Thorn resource for the current phase." },
      "card_043": { name: "Thorn Tree", color: "Thorn", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Thorn resource for the current phase." },
      "card_044": { name: "Toxic Mantis", color: "Thorn", cost: "4", power: 4, toughness: 1, value: null, type: "creature", originalType: "Animal", traits: ["venomous"], text: "If this animal deals damage to another animal, that animal is killed regardless of its Life." },
      "card_045": { name: "Spite", color: "Thorn", cost: "3", power: null, toughness: 4, value: null, type: "spell", originalType: "Vibe", traits: [], text: "Attach to an Animal. Gains Collateral. When this Vibe is killed, opponent gets 2 Drunk tokens." },
      "card_046": { name: "Sky Viper", color: "Thorn", cost: "3", power: 1, toughness: 2, value: null, type: "creature", originalType: "Animal", traits: ["flying"], text: "Evasion: When attacking a ground animal, they cannot strike back. Direct attacks to the player can only be intercepted by other Flying animals." },
      "card_047": { name: "Thorn Tree", color: "Thorn", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Thorn resource for the current phase." },
      "card_048": { name: "Shelled Mantis", color: "Thorn", cost: "4", power: 2, toughness: 2, value: null, type: "creature", originalType: "Animal", traits: ["carapace"], text: "This animal enters with a Carapace counter. The first time this animal would take damage or be killed, ignore it and remove the Carapace counter instead." },
      "card_049": { name: "Gathering Bat", color: "Thorn", cost: "3", power: 1, toughness: 2, value: null, type: "creature", originalType: "Animal", traits: ["foraging"], text: "When this animal is played, draw a card." },
      "card_050": { name: "Thorn Tree", color: "Thorn", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Thorn resource for the current phase." },
      "card_051": { name: "Human Forces", color: "Thorn", cost: "3", power: null, toughness: null, value: null, type: "instant", originalType: "Force", traits: [], text: "Counter a Contra Wind." },
      "card_052": { name: "Divine Bat", color: "Thorn", cost: "3", power: 2, toughness: 2, value: null, type: "creature", originalType: "Animal", traits: ["healing"], text: "Heals controller equal to the amount of damage or tokens dealt to a player." },
      "card_053": { name: "Thorn Tree", color: "Thorn", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Thorn resource for the current phase." },
      "card_054": { name: "Thorn Tree", color: "Thorn", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Thorn resource for the current phase." },
      "card_055": { name: "Immortal Hound", color: "Thorn", cost: "5", power: 3, toughness: 3, value: null, type: "creature", originalType: "Animal", traits: ["reincarnation"], text: "When this animal dies, you may take another dead animal from your Compost and put it into your hand." },
      "card_056": { name: "Thorn Tree", color: "Thorn", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Thorn resource for the current phase." },
      "card_057": { name: "Brew-Crazed Wolf", color: "Thorn", cost: "2", power: 3, toughness: 1, value: null, type: "creature", originalType: "Animal", traits: ["drinking"], text: "Drunk Tokens penalty replacing normal damage." },
      "card_058": { name: "Striking Scorpion", color: "Thorn", cost: "2", power: 1, toughness: 1, value: null, type: "creature", originalType: "Animal", traits: ["ambush"], text: "When in combat, this animal deals its damage BEFORE the opponent's animal." },
      "card_059": { name: "Wasted Mantis", color: "Thorn", cost: "7", power: 5, toughness: 3, value: null, type: "creature", originalType: "Animal", traits: ["super_drinking"], text: "Deals both normal damage AND Drunk tokens." }
    }).map(([k, v]) => [`friend_D-C83CA3__${k}`, v])
  )
},
{
  id: "friend_D-8516FE",
  name: "Friend Willow Coral Deck",
  author: "Imported",
  createdAt: "2026-03-04T13:00:58.390Z",
  notes: "Imported from engine v4.0. Advanced rules stripped; text preserved where possible.",
  format: "cardboard",
  cards: Array.from({ length: 60 }, (_, i) => ({
    cardId: `friend_D-8516FE__card_${String(i).padStart(3, "0")}`,
    qty: 1
  })),
  embeddedCards: Object.fromEntries(
    Object.entries({
      "card_000": { name: "Zoomies", color: "Willow", cost: "2", power: null, toughness: 3, value: null, type: "spell", originalType: "Vibe", traits: [], text: "Attach to an Animal. Gains Rabid and Ambush. Opponent chooses attack target." },
      "card_001": { name: "Human Forces", color: "Coral", cost: "3", power: null, toughness: null, value: null, type: "instant", originalType: "Force", traits: [], text: "Counter a Contra Wind." },
      "card_002": { name: "Willow Tree", color: "Willow", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Willow resource for the current phase." },
      "card_003": { name: "Crazed Drake", color: "Willow", cost: "2", power: 3, toughness: 3, value: null, type: "creature", originalType: "Animal", traits: ["rabid"], text: "This animal MUST attack each turn if able." },
      "card_004": { name: "Breezy Spirit", color: "Willow", cost: "3", power: 1, toughness: 2, value: null, type: "creature", originalType: "Animal", traits: ["reincarnation"], text: "When this animal dies, you may take another dead animal from your Compost and put it into your hand." },
      "card_005": { name: "Alien Forces", color: "Coral", cost: "4", power: null, toughness: null, value: null, type: "instant", originalType: "Force", traits: [], text: "Counter a Human Force." },
      "card_006": { name: "Tidal Turtle", color: "Coral", cost: "5", power: 7, toughness: 1, value: null, type: "creature", originalType: "Animal", traits: [], text: "" },
      "card_007": { name: "Anger", color: "Coral", cost: "3", power: null, toughness: 4, value: null, type: "spell", originalType: "Vibe", traits: [], text: "Attach to an Animal. Its Strength is doubled. Drawback: Discard a card at the end of your turn." },
      "card_008": { name: "Coral Tree", color: "Coral", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Coral resource for the current phase." },
      "card_009": { name: "Raging Turtle", color: "Coral", cost: "5", power: 2, toughness: 4, value: null, type: "creature", originalType: "Animal", traits: ["toxic_masculinity"], text: "Deals normal damage, Drunk tokens, AND allows a physical slap." },
      "card_010": { name: "Grave Leviathan", color: "Coral", cost: "3", power: 2, toughness: 1, value: null, type: "creature", originalType: "Animal", traits: ["scavenger"], text: "Whenever another animal dies, choose one: Heal 1 Life to your player OR put a +1/+1 counter on this animal." },
      "card_011": { name: "Shimmering Hawk", color: "Willow", cost: "2", power: 1, toughness: 3, value: null, type: "creature", originalType: "Animal", traits: [], text: "" },
      "card_012": { name: "Apathy", color: "Willow", cost: "2", power: null, toughness: 5, value: null, type: "spell", originalType: "Vibe", traits: [], text: "Attach to an Animal YOU control. Cannot attack or block. Heal 2 Life to your player at the start of your turn." },
      "card_013": { name: "Slurred Moth", color: "Willow", cost: "6", power: 4, toughness: 4, value: null, type: "creature", originalType: "Animal", traits: ["super_drinking"], text: "Deals both normal damage AND Drunk tokens." },
      "card_014": { name: "Mystic Spirit", color: "Willow", cost: "3", power: 1, toughness: 3, value: null, type: "creature", originalType: "Animal", traits: ["flying"], text: "Evasion: When attacking a ground animal, they cannot strike back. Direct attacks to the player can only be intercepted by other Flying animals." },
      "card_015": { name: "Anger", color: "Coral", cost: "3", power: null, toughness: 4, value: null, type: "spell", originalType: "Vibe", traits: [], text: "Attach to an Animal. Its Strength is doubled. Drawback: Discard a card at the end of your turn." },
      "card_016": { name: "Mystic Wisp", color: "Willow", cost: "2", power: 2, toughness: 3, value: null, type: "creature", originalType: "Animal", traits: [], text: "" },
      "card_017": { name: "Ethereal Falcon", color: "Willow", cost: "7", power: 1, toughness: 4, value: null, type: "creature", originalType: "Animal", traits: ["venomous", "camouflage"], text: "If this animal deals damage to another animal, that animal is killed regardless of its Life. This animal cannot be directly targeted by opponent's Forces or Vibes." },
      "card_018": { name: "Shimmering Moth", color: "Willow", cost: "2", power: 1, toughness: 1, value: null, type: "creature", originalType: "Animal", traits: ["camouflage"], text: "This animal cannot be directly targeted by opponent's Forces or Vibes." },
      "card_019": { name: "Coral Tree", color: "Coral", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Coral resource for the current phase." },
      "card_020": { name: "Willow Tree", color: "Willow", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Willow resource for the current phase." },
      "card_021": { name: "Shimmering Falcon", color: "Willow", cost: "2", power: 2, toughness: 1, value: null, type: "creature", originalType: "Animal", traits: ["ambush"], text: "When in combat, this animal deals its damage BEFORE the opponent's animal." },
      "card_022": { name: "Willow Tree", color: "Willow", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Willow resource for the current phase." },
      "card_023": { name: "Whispering Drake", color: "Willow", cost: "2", power: 2, toughness: 2, value: null, type: "creature", originalType: "Animal", traits: [], text: "" },
      "card_024": { name: "Willow Tree", color: "Willow", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Willow resource for the current phase." },
      "card_025": { name: "Rampaging Wisp", color: "Willow", cost: "4", power: 2, toughness: 4, value: null, type: "creature", originalType: "Animal", traits: ["stampede"], text: "Damage spillover: If this deals lethal damage to an animal, excess damage hits the player." },
      "card_026": { name: "Searching Shark", color: "Coral", cost: "4", power: 4, toughness: 1, value: null, type: "creature", originalType: "Animal", traits: ["foraging"], text: "When this animal is played, draw a card." },
      "card_027": { name: "Willow Tree", color: "Willow", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Willow resource for the current phase." },
      "card_028": { name: "Willow Tree", color: "Willow", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Willow resource for the current phase." },
      "card_029": { name: "Stumbling Leviathan", color: "Coral", cost: "1", power: 2, toughness: 1, value: null, type: "creature", originalType: "Animal", traits: ["drinking"], text: "Drunk Tokens penalty replacing normal damage." },
      "card_030": { name: "Breezy Wisp", color: "Willow", cost: "4", power: 3, toughness: 2, value: null, type: "creature", originalType: "Animal", traits: ["flying"], text: "Evasion: When attacking a ground animal, they cannot strike back. Direct attacks to the player can only be intercepted by other Flying animals." },
      "card_031": { name: "Coral Tree", color: "Coral", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Coral resource for the current phase." },
      "card_032": { name: "Willow Tree", color: "Willow", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Willow resource for the current phase." },
      "card_033": { name: "Mystic Wisp", color: "Willow", cost: "2", power: 2, toughness: 3, value: null, type: "creature", originalType: "Animal", traits: [], text: "" },
      "card_034": { name: "Willow Tree", color: "Willow", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Willow resource for the current phase." },
      "card_035": { name: "Coral Tree", color: "Coral", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Coral resource for the current phase." },
      "card_036": { name: "Coral Tree", color: "Coral", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Coral resource for the current phase." },
      "card_037": { name: "Willow Tree", color: "Willow", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Willow resource for the current phase." },
      "card_038": { name: "Demanding Moth", color: "Willow", cost: "2", power: 4, toughness: 1, value: null, type: "creature", originalType: "Animal", traits: ["collateral"], text: "To declare this animal as an attacker, you must kill another animal you control. If you control no other animals, it cannot attack." },
      "card_039": { name: "Deafening Owl", color: "Willow", cost: "3", power: 3, toughness: 2, value: null, type: "creature", originalType: "Animal", traits: ["healing", "loud"], text: "Heals controller equal to the amount of damage or tokens dealt to a player. Defender may play a free animal on attack." },
      "card_040": { name: "Stumbling Leviathan", color: "Coral", cost: "1", power: 2, toughness: 1, value: null, type: "creature", originalType: "Animal", traits: ["drinking"], text: "Drunk Tokens penalty replacing normal damage." },
      "card_041": { name: "Willow Tree", color: "Willow", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Willow resource for the current phase." },
      "card_042": { name: "Coral Tree", color: "Coral", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Coral resource for the current phase." },
      "card_043": { name: "Coral Tree", color: "Coral", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Coral resource for the current phase." },
      "card_044": { name: "Willow Tree", color: "Willow", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Willow resource for the current phase." },
      "card_045": { name: "Coral Tree", color: "Coral", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Coral resource for the current phase." },
      "card_046": { name: "Contra Wind", color: "Willow", cost: "2", power: null, toughness: null, value: null, type: "instant", originalType: "Force", traits: [], text: "Prevent 1 attacking animal." },
      "card_047": { name: "Coral Tree", color: "Coral", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Coral resource for the current phase." },
      "card_048": { name: "Alien Forces", color: "Coral", cost: "4", power: null, toughness: null, value: null, type: "instant", originalType: "Force", traits: [], text: "Counter a Human Force." },
      "card_049": { name: "Willow Tree", color: "Willow", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Willow resource for the current phase." },
      "card_050": { name: "Willow Tree", color: "Willow", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Willow resource for the current phase." },
      "card_051": { name: "Shimmering Spirit", color: "Willow", cost: "6", power: 2, toughness: 5, value: null, type: "creature", originalType: "Animal", traits: ["carapace"], text: "This animal enters with a Carapace counter. The first time this animal would take damage or be killed, ignore it and remove the Carapace counter instead." },
      "card_052": { name: "Evolving Crab", color: "Coral", cost: "7", power: 6, toughness: 1, value: null, type: "creature", originalType: "Animal", traits: ["adaptive"], text: "At the start of your turn, place a +1/+1 counter on this animal permanently." },
      "card_053": { name: "Coral Tree", color: "Coral", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Coral resource for the current phase." },
      "card_054": { name: "Coral Tree", color: "Coral", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Coral resource for the current phase." },
      "card_055": { name: "Screaming Moth", color: "Willow", cost: "6", power: 5, toughness: 4, value: null, type: "creature", originalType: "Animal", traits: ["loud"], text: "Defender may play a free animal on attack." },
      "card_056": { name: "Sacred Turtle", color: "Coral", cost: "3", power: 1, toughness: 4, value: null, type: "creature", originalType: "Animal", traits: ["healing"], text: "Heals controller equal to the amount of damage or tokens dealt to a player." },
      "card_057": { name: "Willow Tree", color: "Willow", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Willow resource for the current phase." },
      "card_058": { name: "Human Forces", color: "Willow", cost: "3", power: null, toughness: null, value: null, type: "instant", originalType: "Force", traits: [], text: "Counter a Contra Wind." },
      "card_059": { name: "Deep Shark", color: "Coral", cost: "3", power: 3, toughness: 1, value: null, type: "creature", originalType: "Animal", traits: ["camouflage"], text: "This animal cannot be directly targeted by opponent's Forces or Vibes." }
    }).map(([k, v]) => [`friend_D-8516FE__${k}`, v])
  )
},
{
  id: "friend_D-2A9AC2",
  name: "Friend Willow Deck",
  author: "Imported",
  createdAt: "2026-03-04T12:59:44.808Z",
  notes: "Imported from engine v4.0. Advanced rules stripped; text preserved where possible.",
  format: "cardboard",
  cards: Array.from({ length: 60 }, (_, i) => ({
    cardId: `friend_D-2A9AC2__card_${String(i).padStart(3, "0")}`,
    qty: 1
  })),
  embeddedCards: Object.fromEntries(
    Object.entries({
      "card_000": { name: "Willow Tree", color: "Willow", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Willow resource for the current phase." },
      "card_001": { name: "Willow Tree", color: "Willow", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Willow resource for the current phase." },
      "card_002": { name: "Whispering Falcon", color: "Willow", cost: "5", power: 1, toughness: 6, value: null, type: "creature", originalType: "Animal", traits: [], text: "" },
      "card_003": { name: "Swift Wisp", color: "Willow", cost: "5", power: 5, toughness: 3, value: null, type: "creature", originalType: "Animal", traits: [], text: "" },
      "card_004": { name: "Soaring Drake", color: "Willow", cost: "3", power: 1, toughness: 2, value: null, type: "creature", originalType: "Animal", traits: ["flying"], text: "Evasion: When attacking a ground animal, they cannot strike back. Direct attacks to the player can only be intercepted by other Flying animals." },
      "card_005": { name: "Invisible Spirit", color: "Willow", cost: "3", power: 2, toughness: 1, value: null, type: "creature", originalType: "Animal", traits: ["camouflage"], text: "This animal cannot be directly targeted by opponent's Forces or Vibes." },
      "card_006": { name: "Apathy", color: "Willow", cost: "2", power: null, toughness: 5, value: null, type: "spell", originalType: "Vibe", traits: [], text: "Attach to an Animal YOU control. Cannot attack or block. Heal 2 Life to your player at the start of your turn." },
      "card_007": { name: "Willow Tree", color: "Willow", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Willow resource for the current phase." },
      "card_008": { name: "Striking Spirit", color: "Willow", cost: "4", power: 3, toughness: 2, value: null, type: "creature", originalType: "Animal", traits: ["ambush"], text: "When in combat, this animal deals its damage BEFORE the opponent's animal." },
      "card_009": { name: "Human Forces", color: "Willow", cost: "3", power: null, toughness: null, value: null, type: "instant", originalType: "Force", traits: [], text: "Counter a Contra Wind." },
      "card_010": { name: "Willow Tree", color: "Willow", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Willow resource for the current phase." },
      "card_011": { name: "Contra Wind", color: "Willow", cost: "2", power: null, toughness: null, value: null, type: "instant", originalType: "Force", traits: [], text: "Prevent 1 attacking animal." },
      "card_012": { name: "Raging Hawk", color: "Willow", cost: "8", power: 4, toughness: 4, value: null, type: "creature", originalType: "Animal", traits: ["toxic_masculinity"], text: "Deals normal damage, Drunk tokens, AND allows a physical slap." },
      "card_013": { name: "Willow Tree", color: "Willow", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Willow resource for the current phase." },
      "card_014": { name: "Swift Wisp", color: "Willow", cost: "5", power: 5, toughness: 3, value: null, type: "creature", originalType: "Animal", traits: [], text: "" },
      "card_015": { name: "Mystic Owl", color: "Willow", cost: "6", power: 2, toughness: 4, value: null, type: "creature", originalType: "Animal", traits: ["venomous"], text: "If this animal deals damage to another animal, that animal is killed regardless of its Life." },
      "card_016": { name: "Willow Tree", color: "Willow", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Willow resource for the current phase." },
      "card_017": { name: "Willow Tree", color: "Willow", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Willow resource for the current phase." },
      "card_018": { name: "Willow Tree", color: "Willow", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Willow resource for the current phase." },
      "card_019": { name: "Instinct", color: "Willow", cost: "4", power: null, toughness: 6, value: null, type: "spell", originalType: "Vibe", traits: [], text: "Attach to an Animal. Gains +2 Life. Damage to your player or other animals is redirected here." },
      "card_020": { name: "Colossal Falcon", color: "Willow", cost: "3", power: 2, toughness: 2, value: null, type: "creature", originalType: "Animal", traits: ["stampede"], text: "Damage spillover: If this deals lethal damage to an animal, excess damage hits the player." },
      "card_021": { name: "Willow Tree", color: "Willow", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Willow resource for the current phase." },
      "card_022": { name: "Willow Tree", color: "Willow", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Willow resource for the current phase." },
      "card_023": { name: "Searching Wisp", color: "Willow", cost: "3", power: 1, toughness: 2, value: null, type: "creature", originalType: "Animal", traits: ["foraging"], text: "When this animal is played, draw a card." },
      "card_024": { name: "Azure Falcon", color: "Willow", cost: "3", power: 4, toughness: 1, value: null, type: "creature", originalType: "Animal", traits: [], text: "" },
      "card_025": { name: "Willow Tree", color: "Willow", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Willow resource for the current phase." },
      "card_026": { name: "Willow Tree", color: "Willow", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Willow resource for the current phase." },
      "card_027": { name: "Willow Tree", color: "Willow", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Willow resource for the current phase." },
      "card_028": { name: "Willow Tree", color: "Willow", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Willow resource for the current phase." },
      "card_029": { name: "Willow Tree", color: "Willow", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Willow resource for the current phase." },
      "card_030": { name: "Zoomies", color: "Willow", cost: "2", power: null, toughness: 3, value: null, type: "spell", originalType: "Vibe", traits: [], text: "Attach to an Animal. Gains Rabid and Ambush. Opponent chooses attack target." },
      "card_031": { name: "Willow Tree", color: "Willow", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Willow resource for the current phase." },
      "card_032": { name: "Grave Moth", color: "Willow", cost: "4", power: 3, toughness: 1, value: null, type: "creature", originalType: "Animal", traits: ["scavenger"], text: "Whenever another animal dies, choose one: Heal 1 Life to your player OR put a +1/+1 counter on this animal." },
      "card_033": { name: "Swift Hawk", color: "Willow", cost: "8", power: 5, toughness: 5, value: null, type: "creature", originalType: "Animal", traits: ["loud"], text: "Defender may play a free animal on attack." },
      "card_034": { name: "Shimmering Wisp", color: "Willow", cost: "7", power: 5, toughness: 2, value: null, type: "creature", originalType: "Animal", traits: ["collateral", "reincarnation"], text: "To declare this animal as an attacker, you must kill another animal you control. When this animal dies, you may take another dead animal from your Compost and put it into your hand." },
      "card_035": { name: "Immortal Spirit", color: "Willow", cost: "5", power: 2, toughness: 4, value: null, type: "creature", originalType: "Animal", traits: ["reincarnation"], text: "When this animal dies, you may take another dead animal from your Compost and put it into your hand." },
      "card_036": { name: "Willow Tree", color: "Willow", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Willow resource for the current phase." },
      "card_037": { name: "Ghost Hawk", color: "Willow", cost: "6", power: 3, toughness: 2, value: null, type: "creature", originalType: "Animal", traits: ["healing", "camouflage"], text: "Heals controller equal to the amount of damage or tokens dealt to a player. This animal cannot be directly targeted by opponent's Forces or Vibes." },
      "card_038": { name: "Azure Serpent", color: "Willow", cost: "2", power: 1, toughness: 3, value: null, type: "creature", originalType: "Animal", traits: [], text: "" },
      "card_039": { name: "Crazed Owl", color: "Willow", cost: "2", power: 1, toughness: 4, value: null, type: "creature", originalType: "Animal", traits: ["rabid"], text: "This animal MUST attack each turn if able." },
      "card_040": { name: "Drunk Falcon", color: "Willow", cost: "3", power: 3, toughness: 2, value: null, type: "creature", originalType: "Animal", traits: ["drinking"], text: "Drunk Tokens penalty replacing normal damage." },
      "card_041": { name: "Striking Spirit", color: "Willow", cost: "4", power: 3, toughness: 2, value: null, type: "creature", originalType: "Animal", traits: ["ambush"], text: "When in combat, this animal deals its damage BEFORE the opponent's animal." },
      "card_042": { name: "Willow Tree", color: "Willow", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Willow resource for the current phase." },
      "card_043": { name: "Azure Serpent", color: "Willow", cost: "2", power: 1, toughness: 3, value: null, type: "creature", originalType: "Animal", traits: [], text: "" },
      "card_044": { name: "Breezy Drake", color: "Willow", cost: "7", power: 7, toughness: 3, value: null, type: "creature", originalType: "Animal", traits: [], text: "" },
      "card_045": { name: "Alien Forces", color: "Willow", cost: "4", power: null, toughness: null, value: null, type: "instant", originalType: "Force", traits: [], text: "Counter a Human Force." },
      "card_046": { name: "Mutating Serpent", color: "Willow", cost: "8", power: 4, toughness: 3, value: null, type: "creature", originalType: "Animal", traits: ["adaptive"], text: "At the start of your turn, place a +1/+1 counter on this animal permanently." },
      "card_047": { name: "Willow Tree", color: "Willow", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Willow resource for the current phase." },
      "card_048": { name: "Alien Forces", color: "Willow", cost: "4", power: null, toughness: null, value: null, type: "instant", originalType: "Force", traits: [], text: "Counter a Human Force." },
      "card_049": { name: "Hardened Owl", color: "Willow", cost: "3", power: 1, toughness: 1, value: null, type: "creature", originalType: "Animal", traits: ["carapace"], text: "This animal enters with a Carapace counter. The first time this animal would take damage or be killed, ignore it and remove the Carapace counter instead." },
      "card_050": { name: "Willow Tree", color: "Willow", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Willow resource for the current phase." },
      "card_051": { name: "Willow Tree", color: "Willow", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Willow resource for the current phase." },
      "card_052": { name: "Shimmering Hawk", color: "Willow", cost: "4", power: 3, toughness: 2, value: null, type: "creature", originalType: "Animal", traits: ["foraging"], text: "When this animal is played, draw a card." },
      "card_053": { name: "Contra Wind", color: "Willow", cost: "2", power: null, toughness: null, value: null, type: "instant", originalType: "Force", traits: [], text: "Prevent 1 attacking animal." },
      "card_054": { name: "Willow Tree", color: "Willow", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Willow resource for the current phase." },
      "card_055": { name: "Willow Tree", color: "Willow", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Willow resource for the current phase." },
      "card_056": { name: "Whispering Owl", color: "Willow", cost: "8", power: 7, toughness: 1, value: null, type: "creature", originalType: "Animal", traits: ["super_drinking"], text: "Deals both normal damage AND Drunk tokens." },
      "card_057": { name: "Apathy", color: "Willow", cost: "2", power: null, toughness: 5, value: null, type: "spell", originalType: "Vibe", traits: [], text: "Attach to an Animal YOU control. Cannot attack or block. Heal 2 Life to your player at the start of your turn." },
      "card_058": { name: "Willow Tree", color: "Willow", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Willow resource for the current phase." },
      "card_059": { name: "Willow Tree", color: "Willow", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Willow resource for the current phase." }
    }).map(([k, v]) => [`friend_D-2A9AC2__${k}`, v])
  )
},
{
  id: "friend_D-1E90DF",
  name: "Friend Void Deck",
  author: "Imported",
  createdAt: "2026-03-04T13:00:50.745Z",
  notes: "Imported from engine v4.0. Advanced rules stripped; text preserved where possible.",
  format: "cardboard",
  cards: Array.from({ length: 60 }, (_, i) => ({
    cardId: `friend_D-1E90DF__card_${String(i).padStart(3, "0")}`,
    qty: 1
  })),
  embeddedCards: Object.fromEntries(
    Object.entries({
      "card_000": { name: "Lurking Horror", color: "Void", cost: "4", power: 4, toughness: 1, value: null, type: "creature", originalType: "Animal", traits: ["ambush", "rabid"], text: "When in combat, this animal deals its damage BEFORE the opponent's animal. This animal MUST attack each turn if able." },
      "card_001": { name: "Void Tree", color: "Void", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Void resource for the current phase." },
      "card_002": { name: "Shadow Wraith", color: "Void", cost: "1", power: 2, toughness: 1, value: null, type: "creature", originalType: "Animal", traits: ["loud"], text: "Defender may play a free animal on attack." },
      "card_003": { name: "Void Tree", color: "Void", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Void resource for the current phase." },
      "card_004": { name: "Ruthless Horror", color: "Void", cost: "2", power: 4, toughness: 1, value: null, type: "creature", originalType: "Animal", traits: ["collateral"], text: "To declare this animal as an attacker, you must kill another animal you control. If you control no other animals, it cannot attack." },
      "card_005": { name: "Void Tree", color: "Void", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Void resource for the current phase." },
      "card_006": { name: "Void Tree", color: "Void", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Void resource for the current phase." },
      "card_007": { name: "Omnipotence", color: "Void", cost: "3", power: null, toughness: 3, value: null, type: "spell", originalType: "Vibe", traits: [], text: "Attach to an Animal. Gains Stampede and +3 Strength. Damage dealt TO this animal is doubled." },
      "card_008": { name: "Eldritch Reaper", color: "Void", cost: "2", power: 1, toughness: 3, value: null, type: "creature", originalType: "Animal", traits: [], text: "" },
      "card_009": { name: "Void Tree", color: "Void", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Void resource for the current phase." },
      "card_010": { name: "Grave Demon", color: "Void", cost: "3", power: 1, toughness: 2, value: null, type: "creature", originalType: "Animal", traits: ["rabid", "scavenger"], text: "This animal MUST attack each turn if able. Whenever another animal dies, choose one: Heal 1 Life to your player OR put a +1/+1 counter on this animal." },
      "card_011": { name: "Lethal Wraith", color: "Void", cost: "5", power: 1, toughness: 4, value: null, type: "creature", originalType: "Animal", traits: ["venomous"], text: "If this animal deals damage to another animal, that animal is killed regardless of its Life." },
      "card_012": { name: "Alien Forces", color: "Void", cost: "4", power: null, toughness: null, value: null, type: "instant", originalType: "Force", traits: [], text: "Counter a Human Force." },
      "card_013": { name: "Eldritch Reaper", color: "Void", cost: "2", power: 1, toughness: 3, value: null, type: "creature", originalType: "Animal", traits: [], text: "" },
      "card_014": { name: "Void Tree", color: "Void", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Void resource for the current phase." },
      "card_015": { name: "Void Tree", color: "Void", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Void resource for the current phase." },
      "card_016": { name: "Void Tree", color: "Void", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Void resource for the current phase." },
      "card_017": { name: "Human Forces", color: "Void", cost: "3", power: null, toughness: null, value: null, type: "instant", originalType: "Force", traits: [], text: "Counter a Contra Wind." },
      "card_018": { name: "Grim Wraith", color: "Void", cost: "6", power: 6, toughness: 3, value: null, type: "creature", originalType: "Animal", traits: [], text: "" },
      "card_019": { name: "Colossal Shade", color: "Void", cost: "4", power: 4, toughness: 1, value: null, type: "creature", originalType: "Animal", traits: ["stampede", "collateral"], text: "Damage spillover: If this deals lethal damage to an animal, excess damage hits the player. To declare this animal as an attacker, you must kill another animal you control." },
      "card_020": { name: "Void Tree", color: "Void", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Void resource for the current phase." },
      "card_021": { name: "Void Tree", color: "Void", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Void resource for the current phase." },
      "card_022": { name: "Contra Wind", color: "Void", cost: "2", power: null, toughness: null, value: null, type: "instant", originalType: "Force", traits: [], text: "Prevent 1 attacking animal." },
      "card_023": { name: "Contra Wind", color: "Void", cost: "2", power: null, toughness: null, value: null, type: "instant", originalType: "Force", traits: [], text: "Prevent 1 attacking animal." },
      "card_024": { name: "Void Tree", color: "Void", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Void resource for the current phase." },
      "card_025": { name: "Void Tree", color: "Void", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Void resource for the current phase." },
      "card_026": { name: "Apathy", color: "Void", cost: "2", power: null, toughness: 5, value: null, type: "spell", originalType: "Vibe", traits: [], text: "Attach to an Animal YOU control. Cannot attack or block. Heal 2 Life to your player at the start of your turn." },
      "card_027": { name: "Void Tree", color: "Void", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Void resource for the current phase." },
      "card_028": { name: "Blackout Demon", color: "Void", cost: "3", power: 2, toughness: 1, value: null, type: "creature", originalType: "Animal", traits: ["super_drinking"], text: "Deals both normal damage AND Drunk tokens." },
      "card_029": { name: "Tough Demon", color: "Void", cost: "6", power: 3, toughness: 4, value: null, type: "creature", originalType: "Animal", traits: ["carapace"], text: "This animal enters with a Carapace counter. The first time this animal would take damage or be killed, ignore it and remove the Carapace counter instead." },
      "card_030": { name: "Eldritch Wraith", color: "Void", cost: "3", power: 2, toughness: 1, value: null, type: "creature", originalType: "Animal", traits: ["foraging"], text: "When this animal is played, draw a card." },
      "card_031": { name: "Void Tree", color: "Void", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Void resource for the current phase." },
      "card_032": { name: "Void Tree", color: "Void", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Void resource for the current phase." },
      "card_033": { name: "Tipsy Shade", color: "Void", cost: "3", power: 2, toughness: 3, value: null, type: "creature", originalType: "Animal", traits: ["drinking"], text: "Drunk Tokens penalty replacing normal damage." },
      "card_034": { name: "Alien Forces", color: "Void", cost: "4", power: null, toughness: null, value: null, type: "instant", originalType: "Force", traits: [], text: "Counter a Human Force." },
      "card_035": { name: "Toxic Demon", color: "Void", cost: "3", power: 3, toughness: 1, value: null, type: "creature", originalType: "Animal", traits: ["venomous"], text: "If this animal deals damage to another animal, that animal is killed regardless of its Life." },
      "card_036": { name: "Growing Reaper", color: "Void", cost: "5", power: 1, toughness: 2, value: null, type: "creature", originalType: "Animal", traits: ["adaptive"], text: "At the start of your turn, place a +1/+1 counter on this animal permanently." },
      "card_037": { name: "Void Tree", color: "Void", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Void resource for the current phase." },
      "card_038": { name: "Abyssal Leech", color: "Void", cost: "3", power: 2, toughness: 1, value: null, type: "creature", originalType: "Animal", traits: ["camouflage"], text: "This animal cannot be directly targeted by opponent's Forces or Vibes." },
      "card_039": { name: "Mending Demon", color: "Void", cost: "7", power: 6, toughness: 1, value: null, type: "creature", originalType: "Animal", traits: ["healing"], text: "Heals controller equal to the amount of damage or tokens dealt to a player." },
      "card_040": { name: "Void Tree", color: "Void", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Void resource for the current phase." },
      "card_041": { name: "Dark Shade", color: "Void", cost: "3", power: 3, toughness: 3, value: null, type: "creature", originalType: "Animal", traits: [], text: "" },
      "card_042": { name: "Sacrificial Shade", color: "Void", cost: "4", power: 4, toughness: 4, value: null, type: "creature", originalType: "Animal", traits: ["collateral"], text: "To declare this animal as an attacker, you must kill another animal you control. If you control no other animals, it cannot attack." },
      "card_043": { name: "Gale Horror", color: "Void", cost: "4", power: 1, toughness: 3, value: null, type: "creature", originalType: "Animal", traits: ["flying"], text: "Evasion: When attacking a ground animal, they cannot strike back. Direct attacks to the player can only be intercepted by other Flying animals." },
      "card_044": { name: "Dark Shade", color: "Void", cost: "3", power: 3, toughness: 3, value: null, type: "creature", originalType: "Animal", traits: [], text: "" },
      "card_045": { name: "Nether Wraith", color: "Void", cost: "3", power: 2, toughness: 3, value: null, type: "creature", originalType: "Animal", traits: [], text: "" },
      "card_046": { name: "Void Tree", color: "Void", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Void resource for the current phase." },
      "card_047": { name: "Omnipotence", color: "Void", cost: "3", power: null, toughness: 3, value: null, type: "spell", originalType: "Vibe", traits: [], text: "Attach to an Animal. Gains Stampede and +3 Strength. Damage dealt TO this animal is doubled." },
      "card_048": { name: "Dark Horror", color: "Void", cost: "1", power: 1, toughness: 1, value: null, type: "creature", originalType: "Animal", traits: [], text: "" },
      "card_049": { name: "Void Tree", color: "Void", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Void resource for the current phase." },
      "card_050": { name: "Violent Phantom", color: "Void", cost: "4", power: 2, toughness: 1, value: null, type: "creature", originalType: "Animal", traits: ["toxic_masculinity"], text: "Deals normal damage, Drunk tokens, AND allows a physical slap." },
      "card_051": { name: "Void Tree", color: "Void", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Void resource for the current phase." },
      "card_052": { name: "Apathy", color: "Void", cost: "2", power: null, toughness: 5, value: null, type: "spell", originalType: "Vibe", traits: [], text: "Attach to an Animal YOU control. Cannot attack or block. Heal 2 Life to your player at the start of your turn." },
      "card_053": { name: "Void Tree", color: "Void", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Void resource for the current phase." },
      "card_054": { name: "Void Tree", color: "Void", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Void resource for the current phase." },
      "card_055": { name: "Undying Reaper", color: "Void", cost: "3", power: 1, toughness: 1, value: null, type: "creature", originalType: "Animal", traits: ["reincarnation"], text: "When this animal dies, you may take another dead animal from your Compost and put it into your hand." },
      "card_056": { name: "Ironclad Demon", color: "Void", cost: "7", power: 4, toughness: 4, value: null, type: "creature", originalType: "Animal", traits: ["carapace"], text: "This animal enters with a Carapace counter. The first time this animal would take damage or be killed, ignore it and remove the Carapace counter instead." },
      "card_057": { name: "Void Tree", color: "Void", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Void resource for the current phase." },
      "card_058": { name: "Eldritch Shade", color: "Void", cost: "2", power: 2, toughness: 2, value: null, type: "creature", originalType: "Animal", traits: [], text: "" },
      "card_059": { name: "Void Tree", color: "Void", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Void resource for the current phase." }
    }).map(([k, v]) => [`friend_D-1E90DF__${k}`, v])
  )
},
{
  id: "friend_D-B818CB",
  name: "Friends Deck 3",
  author: "Imported",
  createdAt: "2026-03-04T13:00:23.714Z",
  notes: "Imported from engine v4.0. Advanced rules stripped; text preserved where possible.",
  format: "cardboard",
  cards: Array.from({ length: 60 }, (_, i) => ({
    cardId: `friend_D-B818CB__card_${String(i).padStart(3, "0")}`,
    qty: 1
  })),
  embeddedCards: Object.fromEntries(
    Object.entries({
      "card_000": { name: "Wasted Phoenix", color: "Sun", cost: "4", power: 3, toughness: 2, value: null, type: "creature", originalType: "Animal", traits: ["super_drinking"], text: "Deals both normal damage AND Drunk tokens." },
      "card_001": { name: "Solar Phoenix", color: "Sun", cost: "3", power: 3, toughness: 3, value: null, type: "creature", originalType: "Animal", traits: [], text: "" },
      "card_002": { name: "Sun Tree", color: "Sun", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Sun resource for the current phase." },
      "card_003": { name: "Sun Tree", color: "Sun", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Sun resource for the current phase." },
      "card_004": { name: "Apathy", color: "Sun", cost: "2", power: null, toughness: 5, value: null, type: "spell", originalType: "Vibe", traits: [], text: "Attach to an Animal YOU control. Cannot attack or block. Heal 2 Life to your player at the start of your turn." },
      "card_005": { name: "Toxic Griffin", color: "Sun", cost: "3", power: 3, toughness: 1, value: null, type: "creature", originalType: "Animal", traits: ["venomous"], text: "If this animal deals damage to another animal, that animal is killed regardless of its Life." },
      "card_006": { name: "Radiant Phoenix", color: "Sun", cost: "4", power: 1, toughness: 1, value: null, type: "creature", originalType: "Animal", traits: ["adaptive"], text: "At the start of your turn, place a +1/+1 counter on this animal permanently." },
      "card_007": { name: "Sun Tree", color: "Sun", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Sun resource for the current phase." },
      "card_008": { name: "Golden Pegasus", color: "Sun", cost: "5", power: 7, toughness: 1, value: null, type: "creature", originalType: "Animal", traits: ["rabid"], text: "This animal MUST attack each turn if able." },
      "card_009": { name: "Carrion Sphinx", color: "Sun", cost: "5", power: 3, toughness: 2, value: null, type: "creature", originalType: "Animal", traits: ["scavenger"], text: "Whenever another animal dies, choose one: Heal 1 Life to your player OR put a +1/+1 counter on this animal." },
      "card_010": { name: "Sun Tree", color: "Sun", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Sun resource for the current phase." },
      "card_011": { name: "Sun Tree", color: "Sun", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Sun resource for the current phase." },
      "card_012": { name: "Sun Tree", color: "Sun", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Sun resource for the current phase." },
      "card_013": { name: "Zoomies", color: "Sun", cost: "2", power: null, toughness: 3, value: null, type: "spell", originalType: "Vibe", traits: [], text: "Attach to an Animal. Gains Rabid and Ambush. Opponent chooses attack target." },
      "card_014": { name: "Contra Wind", color: "Sun", cost: "2", power: null, toughness: null, value: null, type: "instant", originalType: "Force", traits: [], text: "Prevent 1 attacking animal." },
      "card_015": { name: "Sun Tree", color: "Sun", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Sun resource for the current phase." },
      "card_016": { name: "Blazing Sphinx", color: "Sun", cost: "1", power: 1, toughness: 1, value: null, type: "creature", originalType: "Animal", traits: [], text: "" },
      "card_017": { name: "Armored Griffin", color: "Sun", cost: "3", power: 1, toughness: 1, value: null, type: "creature", originalType: "Animal", traits: ["carapace"], text: "This animal enters with a Carapace counter. The first time this animal would take damage or be killed, ignore it and remove the Carapace counter instead." },
      "card_018": { name: "Sun Tree", color: "Sun", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Sun resource for the current phase." },
      "card_019": { name: "Golden Sphinx", color: "Sun", cost: "3", power: 2, toughness: 2, value: null, type: "creature", originalType: "Animal", traits: ["stampede"], text: "Damage spillover: If this deals lethal damage to an animal, excess damage hits the player." },
      "card_020": { name: "Holy Oracle", color: "Sun", cost: "2", power: 3, toughness: 1, value: null, type: "creature", originalType: "Animal", traits: [], text: "" },
      "card_021": { name: "Gathering Sphinx", color: "Sun", cost: "3", power: 2, toughness: 1, value: null, type: "creature", originalType: "Animal", traits: ["foraging"], text: "When this animal is played, draw a card." },
      "card_022": { name: "Soaring Sphinx", color: "Sun", cost: "3", power: 2, toughness: 1, value: null, type: "creature", originalType: "Animal", traits: ["flying"], text: "Evasion: When attacking a ground animal, they cannot strike back. Direct attacks to the player can only be intercepted by other Flying animals." },
      "card_023": { name: "Stumbling Stallion", color: "Sun", cost: "4", power: 3, toughness: 4, value: null, type: "creature", originalType: "Animal", traits: ["drinking"], text: "Drunk Tokens penalty replacing normal damage." },
      "card_024": { name: "Roaring Oracle", color: "Sun", cost: "2", power: 3, toughness: 1, value: null, type: "creature", originalType: "Animal", traits: ["loud"], text: "Defender may play a free animal on attack." },
      "card_025": { name: "Omnipotence", color: "Sun", cost: "3", power: null, toughness: 3, value: null, type: "spell", originalType: "Vibe", traits: [], text: "Attach to an Animal. Gains Stampede and +3 Strength. Damage dealt TO this animal is doubled." },
      "card_026": { name: "Sun Tree", color: "Sun", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Sun resource for the current phase." },
      "card_027": { name: "Blazing Sphinx", color: "Sun", cost: "1", power: 1, toughness: 1, value: null, type: "creature", originalType: "Animal", traits: [], text: "" },
      "card_028": { name: "Golden Phoenix", color: "Sun", cost: "5", power: 2, toughness: 3, value: null, type: "creature", originalType: "Animal", traits: ["toxic_masculinity"], text: "Deals normal damage, Drunk tokens, AND allows a physical slap." },
      "card_029": { name: "Immortal Sphinx", color: "Sun", cost: "4", power: 2, toughness: 2, value: null, type: "creature", originalType: "Animal", traits: ["reincarnation"], text: "When this animal dies, you may take another dead animal from your Compost and put it into your hand." },
      "card_030": { name: "Sun Tree", color: "Sun", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Sun resource for the current phase." },
      "card_031": { name: "Instinct", color: "Sun", cost: "4", power: null, toughness: 6, value: null, type: "spell", originalType: "Vibe", traits: [], text: "Attach to an Animal. Gains +2 Life. Damage to your player or other animals is redirected here." },
      "card_032": { name: "Luminous Phoenix", color: "Sun", cost: "3", power: 2, toughness: 2, value: null, type: "creature", originalType: "Animal", traits: ["healing"], text: "Heals controller equal to the amount of damage or tokens dealt to a player." },
      "card_033": { name: "Solar Pegasus", color: "Sun", cost: "2", power: 1, toughness: 3, value: null, type: "creature", originalType: "Animal", traits: [], text: "" },
      "card_034": { name: "Divine Oracle", color: "Sun", cost: "2", power: 1, toughness: 2, value: null, type: "creature", originalType: "Animal", traits: ["healing"], text: "Heals controller equal to the amount of damage or tokens dealt to a player." },
      "card_035": { name: "Human Forces", color: "Sun", cost: "3", power: null, toughness: null, value: null, type: "instant", originalType: "Force", traits: [], text: "Counter a Contra Wind." },
      "card_036": { name: "Sun Tree", color: "Sun", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Sun resource for the current phase." },
      "card_037": { name: "Solar Pegasus", color: "Sun", cost: "2", power: 1, toughness: 3, value: null, type: "creature", originalType: "Animal", traits: [], text: "" },
      "card_038": { name: "Solar Phoenix", color: "Sun", cost: "3", power: 3, toughness: 3, value: null, type: "creature", originalType: "Animal", traits: [], text: "" },
      "card_039": { name: "Sun Tree", color: "Sun", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Sun resource for the current phase." },
      "card_040": { name: "Alien Forces", color: "Sun", cost: "4", power: null, toughness: null, value: null, type: "instant", originalType: "Force", traits: [], text: "Counter a Human Force." },
      "card_041": { name: "Sun Tree", color: "Sun", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Sun resource for the current phase." },
      "card_042": { name: "Radiant Stallion", color: "Sun", cost: "2", power: 1, toughness: 1, value: null, type: "creature", originalType: "Animal", traits: ["ambush"], text: "When in combat, this animal deals its damage BEFORE the opponent's animal." },
      "card_043": { name: "Alien Forces", color: "Sun", cost: "4", power: null, toughness: null, value: null, type: "instant", originalType: "Force", traits: [], text: "Counter a Human Force." },
      "card_044": { name: "Solar Griffin", color: "Sun", cost: "3", power: 2, toughness: 1, value: null, type: "creature", originalType: "Animal", traits: ["camouflage"], text: "This animal cannot be directly targeted by opponent's Forces or Vibes." },
      "card_045": { name: "Luminous Stallion", color: "Sun", cost: "2", power: 2, toughness: 2, value: null, type: "creature", originalType: "Animal", traits: [], text: "" },
      "card_046": { name: "Sun Tree", color: "Sun", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Sun resource for the current phase." },
      "card_047": { name: "Sun Tree", color: "Sun", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Sun resource for the current phase." },
      "card_048": { name: "Radiant Griffin", color: "Sun", cost: "2", power: 2, toughness: 1, value: null, type: "creature", originalType: "Animal", traits: [], text: "" },
      "card_049": { name: "Brew-Crazed Stallion", color: "Sun", cost: "2", power: 3, toughness: 1, value: null, type: "creature", originalType: "Animal", traits: ["drinking"], text: "Drunk Tokens penalty replacing normal damage." },
      "card_050": { name: "Sun Tree", color: "Sun", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Sun resource for the current phase." },
      "card_051": { name: "Sun Tree", color: "Sun", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Sun resource for the current phase." },
      "card_052": { name: "Contra Wind", color: "Sun", cost: "2", power: null, toughness: null, value: null, type: "instant", originalType: "Force", traits: [], text: "Prevent 1 attacking animal." },
      "card_053": { name: "Lethal Sphinx", color: "Sun", cost: "1", power: 1, toughness: 1, value: null, type: "creature", originalType: "Animal", traits: ["collateral", "venomous"], text: "To declare this animal as an attacker, you must kill another animal you control. If this animal deals damage to another animal, that animal is killed regardless of its Life." },
      "card_054": { name: "Sun Tree", color: "Sun", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Sun resource for the current phase." },
      "card_055": { name: "Sun Tree", color: "Sun", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Sun resource for the current phase." },
      "card_056": { name: "Sun Tree", color: "Sun", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Sun resource for the current phase." },
      "card_057": { name: "Sun Tree", color: "Sun", cost: "", power: null, toughness: null, value: null, type: "basic_land", originalType: "Tree", traits: [], text: "Generate 1 Sun resource for the current phase." },
      "card_058": { name: "Soaring Sphinx", color: "Sun", cost: "3", power: 2, toughness: 1, value: null, type: "creature", originalType: "Animal", traits: ["flying"], text: "Evasion: When attacking a ground animal, they cannot strike back. Direct attacks to the player can only be intercepted by other Flying animals." },
      "card_059": { name: "Luminous Stallion", color: "Sun", cost: "2", power: 2, toughness: 2, value: null, type: "creature", originalType: "Animal", traits: [], text: "" }
    }).map(([k, v]) => [`friend_D-B818CB__${k}`, v])
  )
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

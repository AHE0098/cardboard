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
    id: "r_example_stormtest",
    name: "Storm Test (Example)",
    author: "R export",
    createdAt: "2026-02-22",
    notes: "Example pasted deck with embedded custom cards.",
    format: "cardboard",
    cards: [
      { cardId: "101", qty: 9 },
      { cardId: "104", qty: 8 },
      { cardId: "MANUAL_1_1", qty: 2 },
      { cardId: "MANUAL_2_1", qty: 1 }
    ],
    sideboard: [{ cardId: "MANUAL_3_1", qty: 1 }],
    embeddedCards: {
      MANUAL_1_1: { name: "Storm", kind: "spell", type: "instant", cost: "1", color: "blue", value: 1 },
      MANUAL_2_1: { name: "Greater Storm", kind: "spell", type: "instant", cost: "2", color: "blue", value: 2 },
      MANUAL_3_1: { name: "Tempest Recall", type: "sorcery", cost: "3", color: "blue", value: 2 }
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

// What changed / how to test:
// - Added resilient localStorage deck persistence helpers for deckbuilder + battle mode.
// - Test in browser console: saveDeck({ id:'t1', name:'Test', createdAt:Date.now(), updatedAt:Date.now(), deckSize:1, cards:['101'], stats:{lands:1,nonlands:0,byLandType:{'101':1}}, source:{} }); getSavedDecks(); loadDeck('t1'); deleteDeck('t1').
(() => {
  const STORAGE_KEY = "cb_decks_v1";

  function deepClone(value) {
    if (typeof structuredClone === "function") return structuredClone(value);
    return JSON.parse(JSON.stringify(value));
  }

  function readRaw() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
      return {
        decks: (parsed && typeof parsed.decks === "object" && parsed.decks) ? parsed.decks : {},
        order: Array.isArray(parsed?.order) ? parsed.order.map(String) : []
      };
    } catch {
      return { decks: {}, order: [] };
    }
  }

  function writeRaw(raw) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(raw));
  }

  function getSavedDecks() {
    const raw = readRaw();
    const byId = raw.decks || {};
    const listed = raw.order.map((id) => byId[id]).filter(Boolean);
    const extras = Object.keys(byId).filter((id) => !raw.order.includes(id)).map((id) => byId[id]);
    return deepClone([...listed, ...extras]);
  }

  function saveDeck(deckObj) {
    const raw = readRaw();
    const id = String(deckObj?.id || `dk_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`);
    const now = Date.now();
    const nextDeck = {
      ...deepClone(deckObj || {}),
      id,
      createdAt: Number(deckObj?.createdAt || now),
      updatedAt: now
    };
    raw.decks[id] = nextDeck;
    raw.order = [id, ...raw.order.filter((x) => x !== id)];
    writeRaw(raw);
    return deepClone(nextDeck);
  }

  function deleteDeck(id) {
    const deckId = String(id || "");
    if (!deckId) return false;
    const raw = readRaw();
    const existed = !!raw.decks[deckId];
    delete raw.decks[deckId];
    raw.order = raw.order.filter((x) => x !== deckId);
    writeRaw(raw);
    return existed;
  }

  function loadDeck(id) {
    const deckId = String(id || "");
    if (!deckId) return null;
    const raw = readRaw();
    const deck = raw.decks[deckId];
    return deck ? deepClone(deck) : null;
  }

  window.CardboardDeckStorage = {
    STORAGE_KEY,
    deepClone,
    getSavedDecks,
    saveDeck,
    deleteDeck,
    loadDeck
  };
})();

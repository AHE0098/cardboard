(() => {
  // Add more decks by appending objects to this array.
  // cards: [{ cardId: "101", qty: 4 }, ...]
  window.CARDBOARD_DECK_LIBRARY = [
    {
      id: "library_boros_starter",
      name: "Boros Starter",
      author: "Cardboard",
      createdAt: "2026-02-18",
      notes: "Aggressive red-white shell for QA testing.",
      format: "cardboard",
      cards: [
        { cardId: "101", qty: 8 },
        { cardId: "104", qty: 8 },
        { cardId: "200", qty: 2 },
        { cardId: "201", qty: 2 },
        { cardId: "202", qty: 2 },
        { cardId: "203", qty: 2 },
        { cardId: "204", qty: 2 },
        { cardId: "205", qty: 2 },
        { cardId: "210", qty: 2 },
        { cardId: "211", qty: 2 },
        { cardId: "212", qty: 2 },
        { cardId: "213", qty: 2 },
        { cardId: "220", qty: 2 },
        { cardId: "221", qty: 2 }
      ]
    },
    {
      id: "library_sultai_mid",
      name: "Sultai Midrange",
      author: "Cardboard",
      createdAt: "2026-02-18",
      notes: "Balanced three-color sample deck.",
      format: "cardboard",
      cards: [
        { cardId: "102", qty: 6 },
        { cardId: "103", qty: 6 },
        { cardId: "105", qty: 6 },
        { cardId: "220", qty: 2 },
        { cardId: "221", qty: 2 },
        { cardId: "222", qty: 2 },
        { cardId: "230", qty: 2 },
        { cardId: "231", qty: 2 },
        { cardId: "240", qty: 2 },
        { cardId: "241", qty: 2 },
        { cardId: "210", qty: 2 },
        { cardId: "211", qty: 2 },
        { cardId: "212", qty: 2 },
        { cardId: "213", qty: 2 }
      ],
      sideboard: [
        { cardId: "204", qty: 2 },
        { cardId: "205", qty: 2 }
      ]
    }
  ];
})();

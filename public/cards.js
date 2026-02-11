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

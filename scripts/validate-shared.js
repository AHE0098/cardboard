const fs = require("fs");
const path = require("path");

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function validateDefinitions(defs) {
  assert(typeof defs.version === "string" && defs.version.length > 0, "definitions.version is required");
  assert(defs.cardAttributes && typeof defs.cardAttributes === "object", "definitions.cardAttributes is required");
  assert(Array.isArray(defs.keywords), "definitions.keywords must be an array");
  assert(defs.deckRules && typeof defs.deckRules === "object", "definitions.deckRules is required");
}

function validateDeckShape(deck) {
  assert(typeof deck.deckId === "string" && deck.deckId.length > 0, "deck.deckId is required");
  assert(typeof deck.name === "string" && deck.name.length > 0, "deck.name is required");
  assert(Array.isArray(deck.cards), "deck.cards must be an array");
}

function main() {
  const root = path.resolve(__dirname, "..");
  const definitionsPath = path.join(root, "shared", "definitions.json");
  const decksPath = path.join(root, "shared", "example_decks.json");

  const definitions = readJson(definitionsPath);
  const decks = readJson(decksPath);

  validateDefinitions(definitions);
  assert(Array.isArray(decks), "shared/example_decks.json must be an array");
  decks.forEach(validateDeckShape);

  console.log(`shared validation passed: definitionsVersion=${definitions.version}, decks=${decks.length}`);
}

if (require.main === module) {
  main();
}

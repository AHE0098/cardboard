const assert = require('node:assert/strict');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { applyIntent } = require('../server');
const { buildStarterDeck, simulateGame } = require('../sim/engine');

function digest(obj) {
  return crypto.createHash('sha256').update(JSON.stringify(obj)).digest('hex').slice(0, 16);
}

function loadReplayFiles() {
  const dir = path.join(__dirname, '..', 'fixtures', 'replays');
  return fs.readdirSync(dir).filter((f) => f.endsWith('.json')).map((f) => path.join(dir, f));
}

function summarizeState(state) {
  const countZones = (zones) => Object.fromEntries(Object.entries(zones).map(([k, v]) => [k, v.length]));
  return {
    version: state.version,
    p1: countZones(state.players.p1.zones),
    p2: countZones(state.players.p2.zones),
    stack: state.sharedZones.stack.length,
    tapped: Object.keys(state.tapped || {}).filter((k) => state.tapped[k]).sort()
  };
}

function executeServerIntentReplay(replay) {
  const room = { state: JSON.parse(JSON.stringify(replay.initialState)) };
  for (const step of replay.actions) {
    const result = applyIntent(room, step.role, step.intent);
    assert.equal(result.ok, true, `Expected action to succeed: ${JSON.stringify(step)}`);
  }
  return digest(summarizeState(room.state));
}

function executeSimReplay(replay) {
  const deckA = buildStarterDeck('A');
  const deckB = buildStarterDeck('B');
  const result = simulateGame({ seed: replay.seed, deckA, deckB, config: { logMode: 'summary' } });
  return digest({
    winner: result.winner,
    turns: result.turns,
    finalLife: result.finalLife,
    endedReason: result.endedReason
  });
}

(function run() {
  const files = loadReplayFiles();
  assert.ok(files.length >= 3, 'Expected at least 3 replay fixtures');

  for (const file of files) {
    const replay = JSON.parse(fs.readFileSync(file, 'utf8'));
    const actual = replay.mode === 'sim' ? executeSimReplay(replay) : executeServerIntentReplay(replay);
    assert.equal(actual, replay.expectedDigest, `Digest mismatch for ${path.basename(file)}: expected ${replay.expectedDigest}, got ${actual}`);
  }

  console.log(`golden replay tests passed (${files.length} fixtures)`);
})();

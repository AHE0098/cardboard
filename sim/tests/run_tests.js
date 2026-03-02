const assert = require('assert');
const crypto = require('crypto');
const { PHASES, buildStarterDeck, buildDeckFromList, simulateGame, simulateMany } = require('../engine');

function digestLog(log) {
  const h = crypto.createHash('sha256');
  h.update(JSON.stringify(log));
  return h.digest('hex');
}

function testDeterminism() {
  const deckA = buildStarterDeck('A');
  const deckB = buildStarterDeck('B');
  const r1 = simulateGame({ seed: 999, deckA, deckB, config: { logMode: 'full', devAssertions: true } });
  const r2 = simulateGame({ seed: 999, deckA, deckB, config: { logMode: 'full', devAssertions: true } });
  assert.equal(r1.winner, r2.winner);
  assert.equal(r1.turns, r2.turns);
  assert.equal(digestLog(r1.log), digestLog(r2.log));
}

function testBaseDrawInvariant() {
  const deckA = buildStarterDeck('A');
  const deckB = buildStarterDeck('B');
  const result = simulateGame({ seed: 42, deckA, deckB, config: { logMode: 'full', devAssertions: true } });
  const draws = result.log.filter((e) => e.eventType === 'draw');
  const byTurnPlayer = new Map();
  draws.forEach((d) => {
    if (d.source !== 'BASE_DRAW') return;
    const key = `${d.turn}|${d.player}`;
    byTurnPlayer.set(key, (byTurnPlayer.get(key) || 0) + 1);
  });
  for (const count of byTurnPlayer.values()) assert.equal(count, 1);
}

function testPhaseOrder() {
  const deckA = buildStarterDeck('A');
  const deckB = buildStarterDeck('B');
  const result = simulateGame({ seed: 7, deckA, deckB, config: { logMode: 'full', devAssertions: true } });
  const phaseEvents = result.log.filter((e) => e.eventType === 'phase_enter');
  const grouped = new Map();
  phaseEvents.forEach((e) => {
    if (!grouped.has(e.turn)) grouped.set(e.turn, []);
    grouped.get(e.turn).push(e.phase);
  });
  const expectedFull = [PHASES.TURN_START, PHASES.DRAW_STEP, PHASES.MAIN_PHASE, PHASES.COMBAT_STEP, PHASES.END_STEP];
  const expectedCombatTerminal = [PHASES.TURN_START, PHASES.DRAW_STEP, PHASES.MAIN_PHASE, PHASES.COMBAT_STEP];
  for (const phases of grouped.values()) {
    const ok = JSON.stringify(phases) === JSON.stringify(expectedFull)
      || JSON.stringify(phases) === JSON.stringify(expectedCombatTerminal);
    assert.equal(ok, true);
  }
}

function testCombatResolution() {
  const deckA = buildDeckFromList([
    { type: 'land', name: 'Basic Land', qty: 40 },
    { type: 'creature', name: 'A-2-2', cost: 0, power: 2, toughness: 2, qty: 2 }
  ], 'CA');
  const deckB = buildDeckFromList([
    { type: 'land', name: 'Basic Land', qty: 40 },
    { type: 'creature', name: 'B-2-2', cost: 0, power: 2, toughness: 2, qty: 2 }
  ], 'CB');

  const result = simulateGame({ seed: 42, deckA, deckB, config: { logMode: 'full', maxTurns: 10, devAssertions: true } });
  assert.equal(result.log.some((e) => e.eventType === 'blocked_combat'), true);
}

function testBatchStatsShape() {
  const deckA = buildStarterDeck('A');
  const deckB = buildStarterDeck('B');
  const batch = simulateMany({ iterations: 10, seedBase: 111, deckA, deckB, config: { logMode: 'none' } });
  assert.equal(batch.iterations, 10);
  assert.ok(batch.summary);
  assert.equal(typeof batch.summary.winsA, 'number');
  assert.equal(typeof batch.summary.cardStats.A, 'object');
  assert.equal(typeof batch.summary.gameLengthHistogram, 'object');
}

function run() {
  testDeterminism();
  testBaseDrawInvariant();
  testPhaseOrder();
  testCombatResolution();
  testBatchStatsShape();
  console.log('sim tests passed');
}

run();

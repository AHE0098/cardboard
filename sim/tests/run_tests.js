const assert = require('assert');
const crypto = require('crypto');
const { buildStarterDeck, buildDeckFromList, simulateGame, simulateMany } = require('../engine');

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

function testConservation() {
  const deckA = buildStarterDeck('A');
  const deckB = buildStarterDeck('B');
  const result = simulateGame({ seed: 7, deckA, deckB, config: { logMode: 'none', devAssertions: true } });
  assert.ok(['A', 'B', 'draw'].includes(result.winner));
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

  const result = simulateGame({
    seed: 42,
    deckA,
    deckB,
    config: { logMode: 'full', maxTurns: 10, devAssertions: true }
  });

  const hasBlockedCombat = result.log.some((e) => e.type === 'blocked_combat');
  assert.equal(hasBlockedCombat, true);
}

function testBatchStatsShape() {
  const deckA = buildStarterDeck('A');
  const deckB = buildStarterDeck('B');
  const batch = simulateMany({ iterations: 10, seedBase: 111, deckA, deckB, config: { logMode: 'none' } });
  assert.equal(batch.iterations, 10);
  assert.ok(batch.summary);
  assert.equal(typeof batch.summary.winsA, 'number');
  assert.equal(typeof batch.summary.cardStats.A, 'object');
}


function testEotSnapshotsCapturedOnce() {
  const deckA = buildStarterDeck('A');
  const deckB = buildStarterDeck('B');
  const result = simulateGame({ seed: 123, deckA, deckB, config: { logMode: 'full', maxTurns: 30, devAssertions: true } });
  const turnSummaries = result.turnSummaries || {};
  Object.entries(turnSummaries).forEach(([turn, perPlayer]) => {
    Object.entries(perPlayer || {}).forEach(([player, entry]) => {
      const turnEndEvents = (entry.actionsByPhase?.END_STEP || []).filter((e) => e.type === 'turn_end');
      if (entry.eotSnapshot) {
        assert.equal(turnEndEvents.length, 1, `Expected exactly one turn_end for ${player} turn ${turn}`);
      } else {
        assert.ok((entry.warnings || []).some((w) => String(w).includes('Snapshot missing')), `Missing snapshot warning for ${player} turn ${turn}`);
      }
    });
  });
}

function testSnapshotAggregatesShape() {
  const deckA = buildStarterDeck('A');
  const deckB = buildStarterDeck('B');
  const batch = simulateMany({ iterations: 5, seedBase: 77, deckA, deckB, config: { logMode: 'none' } });
  assert.equal(typeof batch.summary.eotAveragesByTurn, 'object');
  assert.equal(typeof batch.summary.deadTurnRateByTurn, 'object');
}

function run() {
  testDeterminism();
  testConservation();
  testCombatResolution();
  testBatchStatsShape();
  testEotSnapshotsCapturedOnce();
  testSnapshotAggregatesShape();
  console.log('sim tests passed');
}

run();

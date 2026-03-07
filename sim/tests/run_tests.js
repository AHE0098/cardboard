const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { buildStarterDeck, buildDeckFromList, simulateGame, simulateMany } = require('../engine');
const { chooseAttackers, chooseBlocks } = require('../ai');

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

function testNoLegacyWinrateHelperReference() {
  const app2Path = path.join(__dirname, '..', '..', 'public', 'app2.js');
  const app2Source = fs.readFileSync(app2Path, 'utf8');
  assert.equal(
    app2Source.includes('buildWinrateCheckpoints'),
    false,
    'public/app2.js must not reference legacy buildWinrateCheckpoints helper'
  );
}


function testSummoningSicknessToggle() {
  const deckA = buildDeckFromList([
    { type: 'land', name: 'Basic Land', qty: 40 },
    { type: 'creature', name: 'A-2-2', cost: 0, power: 2, toughness: 2, qty: 3 }
  ], 'SSA');
  const deckB = buildDeckFromList([
    { type: 'land', name: 'Basic Land', qty: 40 },
    { type: 'creature', name: 'B-2-2', cost: 0, power: 2, toughness: 2, qty: 3 }
  ], 'SSB');

  const offResult = simulateGame({
    seed: 4242,
    deckA,
    deckB,
    config: { logMode: 'full', maxTurns: 4, devAssertions: true, rules: { summoningSickness: false } }
  });
  const onResult = simulateGame({
    seed: 4242,
    deckA,
    deckB,
    config: { logMode: 'full', maxTurns: 4, devAssertions: true, rules: { summoningSickness: true } }
  });

  const offTurn1Damage = offResult.log.filter((e) => e.type === 'unblocked_damage' && e.turn === 1).length;
  const onTurn1Damage = onResult.log.filter((e) => e.type === 'unblocked_damage' && e.turn === 1).length;
  const onTurn2PlusAttackers = onResult.log
    .filter((e) => e.type === 'combat_start' && e.turn >= 2)
    .reduce((acc, e) => acc + ((e.attackers || []).length), 0);

  assert.ok(offTurn1Damage > 0, 'Expected immediate attack damage with summoning sickness disabled');
  assert.equal(onTurn1Damage, 0, 'Expected no turn-1 damage when summoning sickness enabled');
  assert.ok(onTurn2PlusAttackers > 0, 'Expected legal attackers on later turns when summoning sickness enabled');
}

function testSummoningSicknessDefaultMatchesExplicitFalse() {
  const deckA = buildStarterDeck('A');
  const deckB = buildStarterDeck('B');
  const implicit = simulateGame({ seed: 999, deckA, deckB, config: { logMode: 'full', devAssertions: true } });
  const explicitFalse = simulateGame({
    seed: 999,
    deckA,
    deckB,
    config: { logMode: 'full', devAssertions: true, rules: { summoningSickness: false } }
  });
  assert.equal(implicit.winner, explicitFalse.winner);
  assert.equal(implicit.turns, explicitFalse.turns);
  assert.equal(digestLog(implicit.log), digestLog(explicitFalse.log));
}



function testNoBlockAfterAttackingToggle() {
  const deckA = buildStarterDeck('A');
  const deckB = buildStarterDeck('B');

  const offResult = simulateGame({
    seed: 1337,
    deckA,
    deckB,
    config: { logMode: 'full', maxTurns: 20, devAssertions: true, rules: { summoningSickness: false, noBlockAfterAttacking: false, debugRules: true } }
  });
  const onResult = simulateGame({
    seed: 1337,
    deckA,
    deckB,
    config: { logMode: 'full', maxTurns: 20, devAssertions: true, rules: { summoningSickness: false, noBlockAfterAttacking: true, debugRules: true } }
  });

  const offBlocked = offResult.log.filter((e) => e.type === 'blocked_combat').length;
  const onBlocked = onResult.log.filter((e) => e.type === 'blocked_combat').length;
  const onFiltered = onResult.log.filter((e) => e.type === 'rules_debug_blockers_filtered').length;

  assert.ok(offBlocked > 0, 'Expected blocked combats when no-block-after-attacking is disabled');
  assert.equal(onBlocked, 0, 'Expected no blocked combats when no-block-after-attacking is enabled for this fixed-seed baseline');
  assert.ok(onFiltered > 0, 'Expected engine blocker legality filter logs when no-block-after-attacking is enabled');
}

function testNoBlockAfterAttackingDefaultMatchesExplicitFalse() {
  const deckA = buildStarterDeck('A');
  const deckB = buildStarterDeck('B');
  const implicit = simulateGame({ seed: 8128, deckA, deckB, config: { logMode: 'full', devAssertions: true } });
  const explicitFalse = simulateGame({
    seed: 8128,
    deckA,
    deckB,
    config: { logMode: 'full', devAssertions: true, rules: { summoningSickness: false, noBlockAfterAttacking: false } }
  });
  assert.equal(implicit.winner, explicitFalse.winner);
  assert.equal(implicit.turns, explicitFalse.turns);
  assert.equal(digestLog(implicit.log), digestLog(explicitFalse.log));
}

function testSmartAttackingAvoidsPointlessSuicide() {
  const attackers = [
    { id: 'a1', power: 2, toughness: 1 },
    { id: 'a2', power: 2, toughness: 1 }
  ];
  const defenders = [
    { id: 'd1', power: 2, toughness: 3 },
    { id: 'd2', power: 2, toughness: 3 }
  ];
  const choice = chooseAttackers(attackers, defenders, {
    ai: { smartAttacking: true, certainty: { attack: 100, defend: 100 } },
    rng: () => 0
  });
  assert.equal(choice.attackers.length, 0, 'Expected smart attacking Rule A to prevent pointless attacks');
}

function testSmartBlockingForcesKillSurvive() {
  const attackers = [
    { id: 'a1', power: 3, toughness: 1 },
    { id: 'a2', power: 3, toughness: 1 }
  ];
  const defenders = [
    { id: 'd1', power: 2, toughness: 3 },
    { id: 'd2', power: 1, toughness: 4 }
  ];

  const choice = chooseBlocks(attackers, defenders, {
    ai: { smartBlocking: true, certainty: { defend: 0 } },
    rng: () => 0.9
  });

  assert.ok(choice.meta.forcedBlocks.length >= 1, 'Expected forced smart block count');
  assert.equal(choice.meta.defendDecisionMode, 'alternative');
}

function testCertaintyZeroUsesAlternative() {
  const attackers = [{ id: 'a1', power: 2, toughness: 2 }];
  const defenders = [{ id: 'd1', power: 2, toughness: 2 }];
  const atk = chooseAttackers(attackers, defenders, {
    ai: { certainty: { attack: 0 } },
    rng: () => 0.5
  });
  const blk = chooseBlocks(attackers, defenders, {
    ai: { certainty: { defend: 0 } },
    rng: () => 0.5
  });
  assert.equal(atk.meta.attackDecisionMode, 'alternative');
  assert.equal(blk.meta.defendDecisionMode, 'alternative');
}

function run() {
  testDeterminism();
  testConservation();
  testCombatResolution();
  testBatchStatsShape();
  testEotSnapshotsCapturedOnce();
  testSnapshotAggregatesShape();
  testSummoningSicknessToggle();
  testSummoningSicknessDefaultMatchesExplicitFalse();
  testNoBlockAfterAttackingToggle();
  testNoBlockAfterAttackingDefaultMatchesExplicitFalse();
  testSmartAttackingAvoidsPointlessSuicide();
  testSmartBlockingForcesKillSurvive();
  testCertaintyZeroUsesAlternative();
  testNoLegacyWinrateHelperReference();
  console.log('sim tests passed');
}

run();

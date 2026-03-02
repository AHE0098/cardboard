#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { buildStarterDeck, buildDeckFromList, simulateGame, simulateMany } = require('./engine');

function parseArgs(argv) {
  const out = {
    iterations: 100,
    seed: 1337,
    log: 'summary',
    maxTurns: 200,
    startingLife: 20,
    sampleLogFile: 'sim_game_log.txt',
    resultsFile: 'sim_results.json',
    deckMode: 'starter',
    smartBlocking: false,
    smartAttacking: false,
    attackCertainty: 100,
    defendCertainty: 100,
    aiDebugDecisions: false
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    const next = argv[i + 1];
    if (token === '--iterations' && next) out.iterations = Number(next), i += 1;
    else if (token === '--seed' && next) out.seed = Number(next), i += 1;
    else if (token === '--log' && next) out.log = String(next), i += 1;
    else if (token === '--maxTurns' && next) out.maxTurns = Number(next), i += 1;
    else if (token === '--startingLife' && next) out.startingLife = Number(next), i += 1;
    else if (token === '--sampleLogFile' && next) out.sampleLogFile = String(next), i += 1;
    else if (token === '--resultsFile' && next) out.resultsFile = String(next), i += 1;
    else if (token === '--deckMode' && next) out.deckMode = String(next), i += 1;
    else if (token === '--smartBlocking' && next) out.smartBlocking = String(next) === '1', i += 1;
    else if (token === '--smartAttacking' && next) out.smartAttacking = String(next) === '1', i += 1;
    else if (token === '--attackCertainty' && next) out.attackCertainty = Number(next), i += 1;
    else if (token === '--defendCertainty' && next) out.defendCertainty = Number(next), i += 1;
    else if (token === '--aiDebugDecisions' && next) out.aiDebugDecisions = String(next) === '1', i += 1;
  }
  return out;
}

function makeDecks(mode) {
  if (mode === 'lands-only') {
    return {
      deckA: buildDeckFromList([{ type: 'land', name: 'Basic Land', qty: 40 }], 'LA'),
      deckB: buildDeckFromList([{ type: 'land', name: 'Basic Land', qty: 40 }], 'LB')
    };
  }

  if (mode === 'low-land') {
    return {
      deckA: buildDeckFromList([
        { type: 'land', name: 'Basic Land', qty: 8 },
        { type: 'creature', name: 'Greedy 4/4', cost: 4, power: 4, toughness: 4, qty: 16 },
        { type: 'creature', name: 'Huge 6/6', cost: 6, power: 6, toughness: 6, qty: 16 }
      ], 'LLA'),
      deckB: buildDeckFromList([
        { type: 'land', name: 'Basic Land', qty: 8 },
        { type: 'creature', name: 'Greedy 4/4', cost: 4, power: 4, toughness: 4, qty: 16 },
        { type: 'creature', name: 'Huge 6/6', cost: 6, power: 6, toughness: 6, qty: 16 }
      ], 'LLB')
    };
  }

  return {
    deckA: buildStarterDeck('A'),
    deckB: buildStarterDeck('B')
  };
}

function printSummary(summary) {
  const winRateA = summary.games ? ((summary.winsA / summary.games) * 100).toFixed(2) : '0.00';
  const winRateB = summary.games ? ((summary.winsB / summary.games) * 100).toFixed(2) : '0.00';
  console.log('=== Simulation Summary ===');
  console.table({
    games: summary.games,
    winsA: summary.winsA,
    winsB: summary.winsB,
    draws: summary.draws,
    winRateA: `${winRateA}%`,
    winRateB: `${winRateB}%`,
    avgTurns: Number(summary.avgTurns.toFixed(2)),
    medianTurns: summary.medianTurns,
    creaturesPlayedA: summary.totalCreaturesPlayed.A,
    creaturesPlayedB: summary.totalCreaturesPlayed.B,
    creaturesDiedA: summary.totalCreaturesDied.A,
    creaturesDiedB: summary.totalCreaturesDied.B
  });
}

function main() {
  const args = parseArgs(process.argv);
  const { deckA, deckB } = makeDecks(args.deckMode);

  const config = {
    startingLife: args.startingLife,
    maxTurns: args.maxTurns,
    logMode: args.log,
    devAssertions: true,
    ai: {
      smartBlocking: !!args.smartBlocking,
      smartAttacking: !!args.smartAttacking,
      debugDecisions: !!args.aiDebugDecisions,
      certainty: {
        attack: Math.max(0, Math.min(100, Number(args.attackCertainty) || 100)),
        defend: Math.max(0, Math.min(100, Number(args.defendCertainty) || 100))
      }
    }
  };

  const sample = simulateGame({ seed: args.seed, deckA, deckB, config: { ...config, logMode: 'full' } });
  const sampleLines = sample.log.map((e) => JSON.stringify(e));
  fs.writeFileSync(path.resolve(args.sampleLogFile), sampleLines.join('\n') + '\n', 'utf8');
  console.log(`Sample game winner=${sample.winner}, turns=${sample.turns}, reason=${sample.endedReason}`);

  const batch = simulateMany({
    iterations: args.iterations,
    seedBase: args.seed,
    deckA,
    deckB,
    config
  });

  printSummary(batch.summary);

  const resultPayload = {
    config: args,
    sampleGame: {
      seed: sample.seed,
      winner: sample.winner,
      turns: sample.turns,
      endedReason: sample.endedReason,
      finalLife: sample.finalLife
    },
    summary: batch.summary
  };
  fs.writeFileSync(path.resolve(args.resultsFile), JSON.stringify(resultPayload, null, 2), 'utf8');
  console.log(`Wrote ${args.resultsFile} and ${args.sampleLogFile}`);
}

if (require.main === module) main();

function createCardStatBucket() {
  return {
    timesDrawn: 0,
    timesPlayed: 0,
    timesDied: 0,
    killsMade: 0,
    damageToPlayer: 0,
    winsWhenDrawn: 0,
    gamesWhenDrawn: 0,
    winsWhenPlayed: 0,
    gamesWhenPlayed: 0
  };
}

function ensureCardStats(map, cardName) {
  if (!map[cardName]) map[cardName] = createCardStatBucket();
  return map[cardName];
}

function median(values) {
  if (!values.length) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) return (sorted[mid - 1] + sorted[mid]) / 2;
  return sorted[mid];
}

function average(arr) {
  if (!arr.length) return 0;
  return arr.reduce((sum, n) => sum + n, 0) / arr.length;
}

function aggregateResults(results) {
  const out = {
    games: results.length,
    winsA: 0,
    winsB: 0,
    draws: 0,
    avgTurns: 0,
    medianTurns: 0,
    totalCreaturesPlayed: { A: 0, B: 0 },
    totalCreaturesDied: { A: 0, B: 0 },
    cardStats: { A: {}, B: {} },
    eotAveragesByTurn: {},
    deadTurnRateByTurn: {},
    aiCounters: {
      smartBlockingForcedBlocksCount: 0,
      smartAttackingForcedAttackersCount: 0,
      attackHeuristicCount: 0,
      attackAlternativeCount: 0,
      defendHeuristicCount: 0,
      defendAlternativeCount: 0,
      smartAttackingRuleAPreventedCount: 0
    }
  };

  const turns = [];
  const turnBuckets = {};

  for (const game of results) {
    turns.push(game.turns);
    if (game.winner === 'A') out.winsA += 1;
    else if (game.winner === 'B') out.winsB += 1;
    else out.draws += 1;

    out.totalCreaturesPlayed.A += game.stats.players[0].creaturesPlayed;
    out.totalCreaturesPlayed.B += game.stats.players[1].creaturesPlayed;
    out.totalCreaturesDied.A += game.stats.players[0].creaturesDied;
    out.totalCreaturesDied.B += game.stats.players[1].creaturesDied;

    const gameAiCounters = game.aiCounters || {};
    out.aiCounters.smartBlockingForcedBlocksCount += Number(gameAiCounters.smartBlockingForcedBlocksCount || 0);
    out.aiCounters.smartAttackingForcedAttackersCount += Number(gameAiCounters.smartAttackingForcedAttackersCount || 0);
    out.aiCounters.attackHeuristicCount += Number(gameAiCounters.attackHeuristicCount || 0);
    out.aiCounters.attackAlternativeCount += Number(gameAiCounters.attackAlternativeCount || 0);
    out.aiCounters.defendHeuristicCount += Number(gameAiCounters.defendHeuristicCount || 0);
    out.aiCounters.defendAlternativeCount += Number(gameAiCounters.defendAlternativeCount || 0);
    out.aiCounters.smartAttackingRuleAPreventedCount += Number(gameAiCounters.smartAttackingRuleAPreventedCount || 0);

    Object.entries(game.turnSummaries || {}).forEach(([turnKey, perPlayer]) => {
      turnBuckets[turnKey] ||= { hand: [], battlefield: [], deadTurns: 0, totalSnapshots: 0 };
      Object.values(perPlayer || {}).forEach((entry) => {
        const snap = entry?.eotSnapshot;
        if (!snap) return;
        turnBuckets[turnKey].hand.push(Number(snap?.zones?.handSize || 0));
        turnBuckets[turnKey].battlefield.push(Number(snap?.zones?.battlefieldCount || 0));
        turnBuckets[turnKey].totalSnapshots += 1;
        if (snap?.flags?.deadTurn) turnBuckets[turnKey].deadTurns += 1;
      });
    });

    [0, 1].forEach((idx) => {
      const sideKey = idx === 0 ? 'A' : 'B';
      const sideStats = out.cardStats[sideKey];
      const perCard = game.stats.players[idx].perCard;

      Object.entries(perCard).forEach(([cardName, cardData]) => {
        const bucket = ensureCardStats(sideStats, cardName);
        bucket.timesDrawn += cardData.timesDrawn;
        bucket.timesPlayed += cardData.timesPlayed;
        bucket.timesDied += cardData.timesDied;
        bucket.killsMade += cardData.killsMade;
        bucket.damageToPlayer += cardData.damageToPlayer;

        if (cardData.timesDrawn > 0) {
          bucket.gamesWhenDrawn += 1;
          if (game.winner === sideKey) bucket.winsWhenDrawn += 1;
        }
        if (cardData.timesPlayed > 0) {
          bucket.gamesWhenPlayed += 1;
          if (game.winner === sideKey) bucket.winsWhenPlayed += 1;
        }
      });
    });
  }

  const totalTurns = turns.reduce((sum, t) => sum + t, 0);
  out.avgTurns = out.games ? totalTurns / out.games : 0;
  out.medianTurns = median(turns);

  Object.entries(turnBuckets).forEach(([turnKey, bucket]) => {
    out.eotAveragesByTurn[turnKey] = {
      avgHandSize: average(bucket.hand),
      avgBattlefieldCount: average(bucket.battlefield),
      samples: bucket.totalSnapshots
    };
    out.deadTurnRateByTurn[turnKey] = bucket.totalSnapshots
      ? bucket.deadTurns / bucket.totalSnapshots
      : 0;
  });

  return out;
}

module.exports = {
  aggregateResults
};

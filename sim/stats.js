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
    cardStats: { A: {}, B: {} }
  };

  const turns = [];

  for (const game of results) {
    turns.push(game.turns);
    if (game.winner === 'A') out.winsA += 1;
    else if (game.winner === 'B') out.winsB += 1;
    else out.draws += 1;

    out.totalCreaturesPlayed.A += game.stats.players[0].creaturesPlayed;
    out.totalCreaturesPlayed.B += game.stats.players[1].creaturesPlayed;
    out.totalCreaturesDied.A += game.stats.players[0].creaturesDied;
    out.totalCreaturesDied.B += game.stats.players[1].creaturesDied;

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

  return out;
}

module.exports = {
  aggregateResults
};

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
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function percentile(values, p) {
  if (!values.length) return 0;
  const sorted = values.slice().sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1));
  return sorted[idx];
}

function mergeCurve(dest, src) {
  Object.entries(src || {}).forEach(([turn, value]) => {
    const t = Number(turn);
    if (!dest[t]) dest[t] = { total: 0, n: 0 };
    dest[t].total += Number(value || 0);
    dest[t].n += 1;
  });
}

function averageCurve(curveMap) {
  const out = {};
  Object.entries(curveMap).forEach(([turn, agg]) => {
    out[turn] = agg.n ? agg.total / agg.n : 0;
  });
  return out;
}

function aggregateResults(results) {
  const out = {
    games: results.length,
    winsA: 0,
    winsB: 0,
    draws: 0,
    winRateA: 0,
    winRateB: 0,
    avgTurns: 0,
    medianTurns: 0,
    minTurns: 0,
    p95Turns: 0,
    maxTurns: 0,
    totalCreaturesPlayed: { A: 0, B: 0 },
    totalCreaturesDied: { A: 0, B: 0 },
    cardStats: { A: {}, B: {} },
    firstAttackTurnAvg: 0,
    firstLethalTurnAvg: 0,
    deadDrawTurnsTotal: 0,
    deckOuts: 0,
    drawViolations: 0,
    drawBreakdown: { A: { base: 0, extra: 0, total: 0 }, B: { base: 0, extra: 0, total: 0 } },
    curves: {
      handSize: { A: {}, B: {} },
      lands: { A: {}, B: {} },
      creatures: { A: {}, B: {} },
      damage: { A: {}, B: {} }
    },
    gameLengthHistogram: {}
  };

  const turns = [];
  const firstAttackTurns = [];
  const firstLethalTurns = [];
  const handCurveAgg = { A: {}, B: {} };
  const landCurveAgg = { A: {}, B: {} };
  const creatureCurveAgg = { A: {}, B: {} };
  const damageCurveAgg = { A: {}, B: {} };

  for (const game of results) {
    turns.push(game.turns);
    out.gameLengthHistogram[game.turns] = (out.gameLengthHistogram[game.turns] || 0) + 1;

    if (game.winner === 'A') out.winsA += 1;
    else if (game.winner === 'B') out.winsB += 1;
    else out.draws += 1;

    if (String(game.endedReason || '').startsWith('deck_out')) out.deckOuts += 1;
    out.drawViolations += Array.isArray(game.violations) ? game.violations.length : 0;

    out.totalCreaturesPlayed.A += game.stats.players[0].creaturesPlayed;
    out.totalCreaturesPlayed.B += game.stats.players[1].creaturesPlayed;
    out.totalCreaturesDied.A += game.stats.players[0].creaturesDied;
    out.totalCreaturesDied.B += game.stats.players[1].creaturesDied;

    out.deadDrawTurnsTotal += Number(game?.metrics?.deadDrawTurns || 0);
    if (Number.isFinite(game?.metrics?.firstAttackTurn)) firstAttackTurns.push(game.metrics.firstAttackTurn);
    if (Number.isFinite(game?.metrics?.firstLethalTurn)) firstLethalTurns.push(game.metrics.firstLethalTurn);

    ['A', 'B'].forEach((side, idx) => {
      const sideStats = out.cardStats[side];
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
          if (game.winner === side) bucket.winsWhenDrawn += 1;
        }
        if (cardData.timesPlayed > 0) {
          bucket.gamesWhenPlayed += 1;
          if (game.winner === side) bucket.winsWhenPlayed += 1;
        }
      });

      const drawMetrics = game?.metrics?.draws?.[side] || {};
      out.drawBreakdown[side].base += Number(drawMetrics.base || 0);
      out.drawBreakdown[side].extra += Number(drawMetrics.extra || 0);
      out.drawBreakdown[side].total += Number(drawMetrics.total || 0);

      mergeCurve(handCurveAgg[side], game?.metrics?.handSizeByTurn?.[side]);
      mergeCurve(landCurveAgg[side], game?.metrics?.landsByTurn?.[side]);
      mergeCurve(creatureCurveAgg[side], game?.metrics?.creaturesByTurn?.[side]);
      mergeCurve(damageCurveAgg[side], game?.metrics?.damageByTurn?.[side]);
    });
  }

  const totalTurns = turns.reduce((sum, t) => sum + t, 0);
  out.avgTurns = out.games ? totalTurns / out.games : 0;
  out.medianTurns = median(turns);
  out.minTurns = turns.length ? Math.min(...turns) : 0;
  out.maxTurns = turns.length ? Math.max(...turns) : 0;
  out.p95Turns = percentile(turns, 95);
  out.winRateA = out.games ? out.winsA / out.games : 0;
  out.winRateB = out.games ? out.winsB / out.games : 0;
  out.firstAttackTurnAvg = firstAttackTurns.length ? firstAttackTurns.reduce((a, b) => a + b, 0) / firstAttackTurns.length : 0;
  out.firstLethalTurnAvg = firstLethalTurns.length ? firstLethalTurns.reduce((a, b) => a + b, 0) / firstLethalTurns.length : 0;

  out.curves.handSize.A = averageCurve(handCurveAgg.A);
  out.curves.handSize.B = averageCurve(handCurveAgg.B);
  out.curves.lands.A = averageCurve(landCurveAgg.A);
  out.curves.lands.B = averageCurve(landCurveAgg.B);
  out.curves.creatures.A = averageCurve(creatureCurveAgg.A);
  out.curves.creatures.B = averageCurve(creatureCurveAgg.B);
  out.curves.damage.A = averageCurve(damageCurveAgg.A);
  out.curves.damage.B = averageCurve(damageCurveAgg.B);

  return out;
}

module.exports = { aggregateResults };

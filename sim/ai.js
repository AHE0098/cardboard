function compareCreatureForCasting(a, b) {
  if (b.cost !== a.cost) return b.cost - a.cost;
  const aValue = a.power + a.toughness;
  const bValue = b.power + b.toughness;
  if (bValue !== aValue) return bValue - aValue;
  const byName = String(a.name).localeCompare(String(b.name));
  if (byName !== 0) return byName;
  return String(a.id).localeCompare(String(b.id));
}

function chooseCreaturesToCast(hand, availableMana) {
  const creatures = hand
    .filter((card) => card.type === 'creature' && Number.isFinite(card.cost) && card.cost >= 0)
    .slice()
    .sort(compareCreatureForCasting);

  const chosen = [];
  let mana = availableMana;
  for (const creature of creatures) {
    if (creature.cost <= mana) {
      chosen.push(creature);
      mana -= creature.cost;
    }
  }

  return { chosen, spentMana: availableMana - mana };
}

function evaluatePairing(attacker, defender) {
  const attackerDies = defender.power >= attacker.toughness;
  const defenderDies = attacker.power >= defender.toughness;
  return { attackerDies, defenderDies };
}

function pairingScore(attacker, defender, config) {
  const { attackerDies: killAttacker } = evaluatePairing(attacker, defender);
  const survive = attacker.power < defender.toughness;
  const die = !survive;

  let score = 0;
  if (killAttacker) {
    score += config.killAttackerBonus;
    score += config.killValueWeight * (attacker.power + attacker.toughness);
  }
  if (survive) score += config.surviveBonus;
  if (die) {
    score += config.diePenalty;
    score -= config.lossValueWeight * (defender.power + defender.toughness);
  }

  return score;
}

function compareById(a, b) {
  return String(a.id).localeCompare(String(b.id));
}

function clampPct(n) {
  const value = Number.isFinite(Number(n)) ? Number(n) : 100;
  return Math.max(0, Math.min(100, value));
}

function chooseObjectiveBlocks(attackers, defenders) {
  const sortedAttackers = attackers.slice().sort((a, b) => {
    const threatDiff = (b.power + b.toughness) - (a.power + a.toughness);
    if (threatDiff !== 0) return threatDiff;
    return compareById(a, b);
  });

  const unassignedDefenders = defenders.slice().sort(compareById);
  const blocks = [];

  for (const attacker of sortedAttackers) {
    const viable = unassignedDefenders
      .map((defender) => ({ defender, outcome: evaluatePairing(attacker, defender) }))
      .filter((entry) => entry.outcome.attackerDies && !entry.outcome.defenderDies)
      .sort((a, b) => {
        if (a.defender.power !== b.defender.power) return a.defender.power - b.defender.power;
        if (a.defender.toughness !== b.defender.toughness) return a.defender.toughness - b.defender.toughness;
        return compareById(a.defender, b.defender);
      });

    if (viable.length === 0) continue;
    const picked = viable[0].defender;
    blocks.push({ attackerId: attacker.id, defenderId: picked.id, score: Number.POSITIVE_INFINITY, forced: true });
    const idx = unassignedDefenders.findIndex((d) => d.id === picked.id);
    if (idx >= 0) unassignedDefenders.splice(idx, 1);
  }

  return blocks;
}

function chooseHeuristicBlocks(attackers, defenders, options = {}) {
  const cfg = {
    killAttackerBonus: 100,
    surviveBonus: 30,
    diePenalty: -80,
    killValueWeight: 1,
    lossValueWeight: 1,
    ...options
  };

  const pairings = [];
  for (const attacker of attackers) {
    for (const defender of defenders) {
      pairings.push({
        attackerId: attacker.id,
        defenderId: defender.id,
        score: pairingScore(attacker, defender, cfg)
      });
    }
  }

  pairings.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const aAtk = String(a.attackerId);
    const bAtk = String(b.attackerId);
    if (aAtk !== bAtk) return aAtk.localeCompare(bAtk);
    return String(a.defenderId).localeCompare(String(b.defenderId));
  });

  const assignedAttackers = new Set();
  const assignedDefenders = new Set();
  const blocks = [];

  for (const pair of pairings) {
    if (assignedAttackers.has(pair.attackerId) || assignedDefenders.has(pair.defenderId)) continue;
    assignedAttackers.add(pair.attackerId);
    assignedDefenders.add(pair.defenderId);
    blocks.push({ attackerId: pair.attackerId, defenderId: pair.defenderId, score: pair.score });
  }

  return blocks;
}

function decideWithCertainty({ certaintyPct, rng, heuristicFn, alternativeFn }) {
  const p = clampPct(certaintyPct) / 100;
  const roll = typeof rng === 'function' ? rng() : 0;
  const useHeuristic = roll < p;
  return {
    roll,
    used: useHeuristic ? 'heuristic' : 'alternative',
    decision: useHeuristic ? heuristicFn() : alternativeFn()
  };
}

function chooseBlocks(attackers, defenders, options = {}) {
  const ai = options.ai || {};
  const forcedBlocks = ai.smartBlocking ? chooseObjectiveBlocks(attackers, defenders) : [];
  const forcedAttackers = new Set(forcedBlocks.map((b) => b.attackerId));
  const forcedDefenders = new Set(forcedBlocks.map((b) => b.defenderId));
  const remAttackers = attackers.filter((a) => !forcedAttackers.has(a.id));
  const remDefenders = defenders.filter((d) => !forcedDefenders.has(d.id));

  const certainty = decideWithCertainty({
    certaintyPct: ai.certainty?.defend,
    rng: options.rng,
    heuristicFn: () => chooseHeuristicBlocks(remAttackers, remDefenders, options.blockScoring || {}),
    alternativeFn: () => []
  });

  return {
    blocks: [...forcedBlocks, ...certainty.decision],
    meta: {
      forcedBlocks,
      defendDecisionMode: certainty.used,
      defendRoll: certainty.roll,
      defendCertainty: clampPct(ai.certainty?.defend)
    }
  };
}

function predictOutcomeForAttackers(attackers, defenders, options = {}) {
  if (attackers.length === 0) return { attackersAllDie: false, defendersKilled: 0 };
  const chosenBlocks = chooseBlocks(attackers, defenders, {
    ai: { ...(options.ai || {}), certainty: { ...(options.ai?.certainty || {}), defend: 100 } },
    blockScoring: options.blockScoring,
    rng: () => 0
  }).blocks;

  const blockMap = new Map(chosenBlocks.map((b) => [b.attackerId, b.defenderId]));
  const defenderById = new Map(defenders.map((d) => [d.id, d]));

  let deadAttackers = 0;
  let defendersKilled = 0;
  for (const attacker of attackers) {
    const defenderId = blockMap.get(attacker.id);
    if (!defenderId) continue;
    const defender = defenderById.get(defenderId);
    if (!defender) continue;
    const { attackerDies, defenderDies } = evaluatePairing(attacker, defender);
    if (attackerDies) deadAttackers += 1;
    if (defenderDies) defendersKilled += 1;
  }

  return {
    attackersAllDie: deadAttackers === attackers.length,
    defendersKilled
  };
}

function chooseAttackers(attackers, defenders, options = {}) {
  const ai = options.ai || {};
  const forcedAttackers = [];
  let pointlessPrevented = false;

  if (ai.smartAttacking) {
    const sortedAttackers = attackers.slice().sort(compareById);
    for (const attacker of sortedAttackers) {
      const killableBySingle = defenders.some((defender) => evaluatePairing(attacker, defender).attackerDies);
      if (!killableBySingle) forcedAttackers.push(attacker);
    }

    const predicted = predictOutcomeForAttackers(attackers, defenders, options);
    if (predicted.attackersAllDie && predicted.defendersKilled === 0 && forcedAttackers.length === 0) {
      pointlessPrevented = true;
      return {
        attackers: [],
        meta: {
          forcedAttackers,
          attackDecisionMode: 'objective_none',
          attackRoll: 0,
          attackCertainty: clampPct(ai.certainty?.attack),
          pointlessPrevented
        }
      };
    }
  }

  const forcedIds = new Set(forcedAttackers.map((a) => a.id));
  const remaining = attackers.filter((a) => !forcedIds.has(a.id));
  const certainty = decideWithCertainty({
    certaintyPct: ai.certainty?.attack,
    rng: options.rng,
    heuristicFn: () => remaining,
    alternativeFn: () => []
  });

  return {
    attackers: [...forcedAttackers, ...certainty.decision].sort(compareById),
    meta: {
      forcedAttackers,
      attackDecisionMode: certainty.used,
      attackRoll: certainty.roll,
      attackCertainty: clampPct(ai.certainty?.attack),
      pointlessPrevented
    }
  };
}

module.exports = {
  chooseCreaturesToCast,
  chooseAttackers,
  chooseBlocks,
  evaluatePairing,
  decideWithCertainty
};

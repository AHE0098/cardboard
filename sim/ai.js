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

function pairingScore(attacker, defender, config) {
  const killAttacker = defender.power >= attacker.toughness;
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

function chooseBlocks(attackers, defenders, options = {}) {
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
        score: pairingScore(attacker, defender, cfg),
        attacker,
        defender
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

module.exports = {
  chooseCreaturesToCast,
  chooseBlocks
};

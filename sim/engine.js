const { chooseCreaturesToCast, chooseBlocks } = require('./ai');
const { aggregateResults } = require('./stats');

const PHASES = {
  TURN_START: 'TURN_START',
  DRAW_STEP: 'DRAW_STEP',
  MAIN_PHASE: 'MAIN_PHASE',
  COMBAT_STEP: 'COMBAT_STEP',
  END_STEP: 'END_STEP'
};

function mulberry32(seed) {
  let t = seed >>> 0;
  return function rng() {
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffleInPlace(arr, rng) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

function assertValidCard(card, i) {
  if (!card || typeof card !== 'object') throw new Error(`Invalid card at index ${i}`);
  if (typeof card.id !== 'string' || !card.id) throw new Error(`Card at index ${i} missing id`);
  if (typeof card.name !== 'string' || !card.name) throw new Error(`Card ${card.id} missing name`);
  if (card.type !== 'land' && card.type !== 'creature') throw new Error(`Card ${card.id} has invalid type ${card.type}`);
  if (card.type === 'creature') {
    ['cost', 'power', 'toughness'].forEach((field) => {
      if (!Number.isFinite(card[field])) throw new Error(`Creature ${card.id} missing numeric ${field}`);
    });
  }
}

function cloneDeckWithValidation(deck, sideLabel) {
  if (!Array.isArray(deck) || !deck.length) throw new Error(`Deck ${sideLabel} must be a non-empty array`);
  const ids = new Set();
  return deck.map((card, i) => {
    assertValidCard(card, i);
    if (ids.has(card.id)) throw new Error(`Deck ${sideLabel} contains duplicate card id: ${card.id}`);
    ids.add(card.id);
    return { ...card };
  });
}

function createPlayer(deck, startingLife, name) {
  return {
    name,
    library: deck,
    hand: [],
    battlefieldLands: [],
    battlefieldCreatures: [],
    graveyard: [],
    life: startingLife,
    landsPlayedThisTurn: 0,
    manaAvailable: 0
  };
}

function createEmptyCardStats() {
  return { timesDrawn: 0, timesPlayed: 0, timesDied: 0, killsMade: 0, damageToPlayer: 0 };
}

function ensureCardStats(playerStats, cardName) {
  if (!playerStats.perCard[cardName]) playerStats.perCard[cardName] = createEmptyCardStats();
  return playerStats.perCard[cardName];
}

function createGameStats() {
  return {
    players: [
      { creaturesPlayed: 0, creaturesDied: 0, perCard: {} },
      { creaturesPlayed: 0, creaturesDied: 0, perCard: {} }
    ]
  };
}

function logEvent(game, event) {
  const withMeta = {
    gameId: game.gameId,
    turn: game.turn,
    activePlayerId: game.players[game.activePlayerIndex]?.name || 'A',
    phase: game.currentPhase || null,
    logicalTs: game.logicalTs++,
    ...event
  };
  game.log.push(withMeta);
}

function recordViolation(game, message, extra = {}) {
  const payload = { turn: game.turn, message, ...extra };
  game.violations.push(payload);
  logEvent(game, { eventType: 'violation', ...payload });
  if (game.config.devAssertions) throw new Error(message);
}

function drawCard(game, playerIndex, context = {}) {
  const player = game.players[playerIndex];
  const source = context.source || 'CARD_EFFECT';

  if (source === 'BASE_DRAW') {
    const slot = game.baseDrawDoneThisTurn[player.name];
    if (slot) {
      return recordViolation(
        game,
        `BASE_DRAW repeated in same turn for ${player.name}`,
        { player: player.name, source }
      );
    }
    game.baseDrawDoneThisTurn[player.name] = true;
  }

  if (player.library.length === 0) {
    game.winner = playerIndex === 0 ? 'B' : 'A';
    game.endedReason = `deck_out:${player.name}`;
    logEvent(game, { eventType: 'deck_out', player: player.name, source });
    return null;
  }

  const card = player.library.shift();
  player.hand.push(card);
  const ps = game.stats.players[playerIndex];
  ensureCardStats(ps, card.name).timesDrawn += 1;

  if (!game.metrics.drawsByTurn[player.name][game.turn]) {
    game.metrics.drawsByTurn[player.name][game.turn] = { base: 0, extra: 0 };
  }
  if (source === 'BASE_DRAW') game.metrics.drawsByTurn[player.name][game.turn].base += 1;
  else game.metrics.drawsByTurn[player.name][game.turn].extra += 1;

  logEvent(game, {
    eventType: 'draw',
    player: player.name,
    card: card.name,
    cardId: card.id,
    source,
    effectId: context.effectId || null
  });
  return card;
}

function moveCardBetweenArrays(cardId, from, to) {
  const idx = from.findIndex((c) => c.id === cardId);
  if (idx < 0) return null;
  const [card] = from.splice(idx, 1);
  to.push(card);
  return card;
}

function verifyConservation(game) {
  for (const player of game.players) {
    const all = [...player.library, ...player.hand, ...player.battlefieldLands, ...player.battlefieldCreatures, ...player.graveyard];
    const ids = new Set();
    for (const card of all) {
      if (ids.has(card.id)) return recordViolation(game, `Duplicate card id in zones: ${card.id}`);
      ids.add(card.id);
    }
    if (all.length !== game.initialDeckSizes[player.name]) {
      return recordViolation(game, `Card conservation failed for ${player.name}`);
    }
    if (player.life < 0) return recordViolation(game, `Life below 0 for ${player.name}`);
  }
  return null;
}

function enterPhase(game, phase) {
  game.currentPhase = phase;
  game.phaseOrderByTurn[game.turn] ||= [];
  game.phaseOrderByTurn[game.turn].push(phase);
  logEvent(game, { eventType: 'phase_enter', phase });
}

function playMainPhase(game, playerIndex, config) {
  const player = game.players[playerIndex];
  const startHand = player.hand.length;
  player.landsPlayedThisTurn = 0;
  let playedAny = false;

  const landToPlay = player.hand.find((card) => card.type === 'land');
  if (landToPlay && player.landsPlayedThisTurn < 1) {
    moveCardBetweenArrays(landToPlay.id, player.hand, player.battlefieldLands);
    player.landsPlayedThisTurn += 1;
    playedAny = true;
    logEvent(game, { eventType: 'play_land', player: player.name, card: landToPlay.name, cardId: landToPlay.id });
  }

  player.manaAvailable = player.battlefieldLands.length;
  const { chosen, spentMana } = chooseCreaturesToCast(player.hand, player.manaAvailable);

  for (const creature of chosen) {
    if (creature.cost > player.manaAvailable) continue;
    moveCardBetweenArrays(creature.id, player.hand, player.battlefieldCreatures);
    player.manaAvailable -= creature.cost;
    playedAny = true;
    const ps = game.stats.players[playerIndex];
    ps.creaturesPlayed += 1;
    ensureCardStats(ps, creature.name).timesPlayed += 1;
    logEvent(game, {
      eventType: 'cast_creature',
      player: player.name,
      card: creature.name,
      cardId: creature.id,
      cost: creature.cost
    });
  }

  if (!playedAny && player.hand.length === startHand) game.metrics.deadDrawTurns += 1;

  logEvent(game, {
    eventType: 'main_phase_end',
    player: player.name,
    manaSpent: spentMana,
    manaRemaining: player.manaAvailable,
    handSize: player.hand.length,
    landsInPlay: player.battlefieldLands.length,
    creaturesInPlay: player.battlefieldCreatures.length
  });

  if (config.devAssertions) verifyConservation(game);
}

function resolveCombat(game, attackerIndex, defenderIndex, config) {
  const attackerP = game.players[attackerIndex];
  const defenderP = game.players[defenderIndex];
  const attackers = attackerP.battlefieldCreatures.slice();

  if (attackers.length === 0) {
    logEvent(game, { eventType: 'combat_skip', attacker: attackerP.name });
    return;
  }

  if (!game.metrics.firstAttackTurn) game.metrics.firstAttackTurn = game.turn;

  const defenders = defenderP.battlefieldCreatures.slice();
  const blocks = chooseBlocks(attackers, defenders, config.blockScoring);
  const blockMap = new Map(blocks.map((b) => [b.attackerId, b.defenderId]));
  const defenderById = new Map(defenders.map((d) => [d.id, d]));

  const deadAttackers = new Set();
  const deadDefenders = new Set();

  logEvent(game, {
    eventType: 'combat_start',
    attacker: attackerP.name,
    defender: defenderP.name,
    attackers: attackers.map((c) => c.id),
    blocks
  });

  for (const attacker of attackers) {
    const defenderId = blockMap.get(attacker.id);
    if (!defenderId) {
      defenderP.life = Math.max(0, defenderP.life - attacker.power);
      const aps = game.stats.players[attackerIndex];
      ensureCardStats(aps, attacker.name).damageToPlayer += attacker.power;
      game.metrics.damageByTurn[attackerP.name][game.turn] = (game.metrics.damageByTurn[attackerP.name][game.turn] || 0) + attacker.power;
      logEvent(game, {
        eventType: 'unblocked_damage',
        attacker: attacker.id,
        playerDamaged: defenderP.name,
        amount: attacker.power,
        lifeAfter: defenderP.life
      });
      continue;
    }

    const defender = defenderById.get(defenderId);
    const attackerDies = defender.power >= attacker.toughness;
    const defenderDies = attacker.power >= defender.toughness;
    if (attackerDies) deadAttackers.add(attacker.id);
    if (defenderDies) deadDefenders.add(defender.id);

    if (defenderDies) ensureCardStats(game.stats.players[attackerIndex], attacker.name).killsMade += 1;
    if (attackerDies) ensureCardStats(game.stats.players[defenderIndex], defender.name).killsMade += 1;

    logEvent(game, {
      eventType: 'blocked_combat',
      attacker: attacker.id,
      defender: defender.id,
      attackerDies,
      defenderDies
    });
  }

  for (const deadId of deadAttackers) {
    const deadCard = moveCardBetweenArrays(deadId, attackerP.battlefieldCreatures, attackerP.graveyard);
    if (!deadCard) continue;
    const aps = game.stats.players[attackerIndex];
    aps.creaturesDied += 1;
    ensureCardStats(aps, deadCard.name).timesDied += 1;
  }

  for (const deadId of deadDefenders) {
    const deadCard = moveCardBetweenArrays(deadId, defenderP.battlefieldCreatures, defenderP.graveyard);
    if (!deadCard) continue;
    const dps = game.stats.players[defenderIndex];
    dps.creaturesDied += 1;
    ensureCardStats(dps, deadCard.name).timesDied += 1;
  }

  if (defenderP.life <= 0) {
    game.winner = attackerIndex === 0 ? 'A' : 'B';
    game.endedReason = 'life_zero';
    if (!game.metrics.firstLethalTurn) game.metrics.firstLethalTurn = game.turn;
    logEvent(game, { eventType: 'game_end_life_zero', loser: defenderP.name, winner: attackerP.name });
  }

  if (config.devAssertions) verifyConservation(game);
}

function newGame({ seed, deckA, deckB, config }) {
  const rng = mulberry32(seed >>> 0);
  const deckACloned = cloneDeckWithValidation(deckA, 'A');
  const deckBCloned = cloneDeckWithValidation(deckB, 'B');
  shuffleInPlace(deckACloned, rng);
  shuffleInPlace(deckBCloned, rng);

  const game = {
    gameId: `g_${seed}`,
    turn: 1,
    activePlayerIndex: 0,
    seed,
    currentPhase: null,
    logicalTs: 0,
    players: [createPlayer(deckACloned, config.startingLife, 'A'), createPlayer(deckBCloned, config.startingLife, 'B')],
    log: [],
    winner: null,
    endedReason: null,
    stats: createGameStats(),
    initialDeckSizes: { A: deckACloned.length, B: deckBCloned.length },
    baseDrawDoneThisTurn: { A: false, B: false },
    phaseOrderByTurn: {},
    violations: [],
    config,
    metrics: {
      firstAttackTurn: null,
      firstLethalTurn: null,
      deadDrawTurns: 0,
      drawsByTurn: { A: {}, B: {} },
      handSizeByTurn: { A: {}, B: {} },
      landsByTurn: { A: {}, B: {} },
      creaturesByTurn: { A: {}, B: {} },
      damageByTurn: { A: {}, B: {} }
    }
  };

  for (let i = 0; i < config.startingHandSize; i += 1) {
    if (!game.winner) drawCard(game, 0, { source: 'RULE_EFFECT', effectId: 'STARTING_HAND' });
    if (!game.winner) drawCard(game, 1, { source: 'RULE_EFFECT', effectId: 'STARTING_HAND' });
  }

  if (config.devAssertions) verifyConservation(game);
  return game;
}

function validatePhaseOrder(game) {
  const full = [PHASES.TURN_START, PHASES.DRAW_STEP, PHASES.MAIN_PHASE, PHASES.COMBAT_STEP, PHASES.END_STEP];
  const combatTerminal = [PHASES.TURN_START, PHASES.DRAW_STEP, PHASES.MAIN_PHASE, PHASES.COMBAT_STEP];
  Object.entries(game.phaseOrderByTurn).forEach(([turn, phases]) => {
    const got = phases.join('>');
    const ok = got === full.join('>') || got === combatTerminal.join('>');
    if (!ok) recordViolation(game, `Phase order mismatch on turn ${turn}: ${got}`);
  });
}

function summarizeGameDraws(drawsByTurn) {
  let base = 0;
  let extra = 0;
  Object.values(drawsByTurn || {}).forEach((perTurn) => {
    base += Number(perTurn?.base || 0);
    extra += Number(perTurn?.extra || 0);
  });
  return { base, extra, total: base + extra };
}

function simulateGame({ seed = 1, deckA, deckB, config = {} }) {
  const cfg = {
    startingLife: 20,
    maxTurns: 200,
    startingHandSize: 7,
    logMode: 'summary',
    devAssertions: true,
    blockScoring: {},
    ...config
  };

  const game = newGame({ seed, deckA, deckB, config: cfg });

  while (!game.winner && game.turn <= cfg.maxTurns) {
    const ap = game.activePlayerIndex;
    const dp = ap === 0 ? 1 : 0;
    const activePlayer = game.players[ap];
    game.baseDrawDoneThisTurn[activePlayer.name] = false;

    enterPhase(game, PHASES.TURN_START);
    logEvent(game, { eventType: 'turn_start', player: activePlayer.name });

    enterPhase(game, PHASES.DRAW_STEP);
    drawCard(game, ap, { source: 'BASE_DRAW' });
    if (game.winner) break;

    enterPhase(game, PHASES.MAIN_PHASE);
    playMainPhase(game, ap, cfg);

    enterPhase(game, PHASES.COMBAT_STEP);
    resolveCombat(game, ap, dp, cfg);
    if (game.winner) break;

    enterPhase(game, PHASES.END_STEP);
    game.metrics.handSizeByTurn[activePlayer.name][game.turn] = activePlayer.hand.length;
    game.metrics.landsByTurn[activePlayer.name][game.turn] = activePlayer.battlefieldLands.length;
    game.metrics.creaturesByTurn[activePlayer.name][game.turn] = activePlayer.battlefieldCreatures.length;
    logEvent(game, {
      eventType: 'turn_end',
      player: activePlayer.name,
      handSize: activePlayer.hand.length,
      landsInPlay: activePlayer.battlefieldLands.length,
      creaturesInPlay: activePlayer.battlefieldCreatures.length
    });

    game.activePlayerIndex = dp;
    game.turn += 1;
  }

  if (!game.winner) {
    game.winner = 'draw';
    game.endedReason = 'max_turns';
    logEvent(game, { eventType: 'game_end_max_turns' });
  }

  validatePhaseOrder(game);

  const drawsA = summarizeGameDraws(game.metrics.drawsByTurn.A);
  const drawsB = summarizeGameDraws(game.metrics.drawsByTurn.B);

  let log = game.log;
  if (cfg.logMode === 'none') log = [];
  if (cfg.logMode === 'summary') {
    log = game.log.filter((event) => [
      'turn_start', 'phase_enter', 'draw', 'turn_end', 'game_end_life_zero', 'game_end_max_turns', 'deck_out', 'violation'
    ].includes(event.eventType));
  }

  return {
    gameId: game.gameId,
    seed: game.seed,
    winner: game.winner,
    endedReason: game.endedReason,
    turns: game.turn,
    finalLife: { A: game.players[0].life, B: game.players[1].life },
    stats: game.stats,
    log,
    violations: game.violations,
    metrics: {
      ...game.metrics,
      draws: { A: drawsA, B: drawsB }
    }
  };
}

function buildDeckFromList(entries, prefix = 'D') {
  if (!Array.isArray(entries)) throw new Error('entries must be array');
  const out = [];
  let nextId = 1;
  for (const entry of entries) {
    const qty = Number(entry.qty || 1);
    if (!Number.isInteger(qty) || qty <= 0) throw new Error(`Invalid qty for ${entry.name}`);
    for (let i = 0; i < qty; i += 1) {
      out.push({
        id: `${prefix}_${nextId}`,
        type: entry.type,
        name: entry.name,
        cost: entry.type === 'creature' ? Number(entry.cost) : undefined,
        power: entry.type === 'creature' ? Number(entry.power) : undefined,
        toughness: entry.type === 'creature' ? Number(entry.toughness) : undefined
      });
      nextId += 1;
    }
  }
  return out;
}

function buildStarterDeck(prefix = 'S') {
  return buildDeckFromList([
    { type: 'land', name: 'Basic Land', qty: 24 },
    { type: 'creature', name: 'Grunt 2/2', cost: 2, power: 2, toughness: 2, qty: 12 },
    { type: 'creature', name: 'Brute 3/3', cost: 3, power: 3, toughness: 3, qty: 8 },
    { type: 'creature', name: 'Titan 5/5', cost: 5, power: 5, toughness: 5, qty: 4 }
  ], prefix);
}

function simulateMany({ iterations = 100, seedBase = 1337, deckA, deckB, config = {} }) {
  if (!Number.isInteger(iterations) || iterations < 1) throw new Error(`iterations must be positive integer, got ${iterations}`);
  const games = [];
  for (let i = 0; i < iterations; i += 1) games.push(simulateGame({ seed: (seedBase + i) >>> 0, deckA, deckB, config }));
  return { iterations, seedBase, summary: aggregateResults(games), games };
}

module.exports = {
  PHASES,
  mulberry32,
  shuffleInPlace,
  simulateGame,
  simulateMany,
  buildDeckFromList,
  buildStarterDeck
};

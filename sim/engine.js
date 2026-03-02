const { chooseCreaturesToCast, chooseAttackers, chooseBlocks } = require('./ai');
const { aggregateResults } = require('./stats');
const { buildEotSnapshot } = require('./eotSnapshot');

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
  if (!Array.isArray(deck) || !deck.length) {
    throw new Error(`Deck ${sideLabel} must be a non-empty array`);
  }
  const ids = new Set();
  const copy = deck.map((card, i) => {
    assertValidCard(card, i);
    if (ids.has(card.id)) throw new Error(`Deck ${sideLabel} contains duplicate card id: ${card.id}`);
    ids.add(card.id);
    return { ...card };
  });
  return copy;
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
  return {
    timesDrawn: 0,
    timesPlayed: 0,
    timesDied: 0,
    killsMade: 0,
    damageToPlayer: 0
  };
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
  game.log.push(event);
}

function ensureTurnSummary(game, turn, playerName) {
  const t = String(turn);
  if (!game.turnSummaries[t]) game.turnSummaries[t] = {};
  if (!game.turnSummaries[t][playerName]) {
    game.turnSummaries[t][playerName] = {
      player: playerName,
      actionsByPhase: {
        DRAW_STEP: [],
        MAIN_PHASE: [],
        COMBAT_STEP: [],
        END_STEP: []
      },
      eotSnapshot: null,
      warnings: []
    };
  }
  return game.turnSummaries[t][playerName];
}

function trackTurnAction(game, turn, playerName, phase, event) {
  const summary = ensureTurnSummary(game, turn, playerName);
  summary.actionsByPhase[phase] ||= [];
  summary.actionsByPhase[phase].push(event);
}

function captureSnapshot(game, playerIndex, turnContext) {
  const player = game.players[playerIndex];
  const summary = ensureTurnSummary(game, game.turn, player.name);
  if (summary.eotSnapshot) {
    const warning = `Duplicate EoT snapshot for ${player.name} turn ${game.turn}`;
    summary.warnings.push(warning);
    game.warnings.push(warning);
    return;
  }
  summary.eotSnapshot = buildEotSnapshot(game, playerIndex, turnContext);
}

function drawCard(game, playerIndex) {
  const player = game.players[playerIndex];
  if (player.library.length === 0) {
    game.winner = playerIndex === 0 ? 'B' : 'A';
    game.endedReason = `deck_out:${player.name}`;
    logEvent(game, { turn: game.turn, type: 'deck_out', player: player.name });
    return null;
  }
  const card = player.library.shift();
  player.hand.push(card);

  const ps = game.stats.players[playerIndex];
  ensureCardStats(ps, card.name).timesDrawn += 1;
  const event = { turn: game.turn, type: 'draw', player: player.name, card: card.name, cardId: card.id, phase: 'DRAW_STEP' };
  logEvent(game, event);
  if (game.isTurnActive) trackTurnAction(game, game.turn, player.name, 'DRAW_STEP', event);
  return card;
}

function moveCardBetweenArrays(cardId, from, to) {
  const idx = from.findIndex((c) => c.id === cardId);
  if (idx < 0) return false;
  const [card] = from.splice(idx, 1);
  to.push(card);
  return card;
}

function canAttackWithCreature(game, creature, config) {
  if (!config?.rules?.summoningSickness) return true;
  return Number(creature?.enteredTurn) < Number(game.turn);
}

function verifyConservation(game) {
  for (const player of game.players) {
    const all = [
      ...player.library,
      ...player.hand,
      ...player.battlefieldLands,
      ...player.battlefieldCreatures,
      ...player.graveyard
    ];
    const ids = new Set();
    for (const card of all) {
      if (ids.has(card.id)) throw new Error(`Duplicate card id in zones: ${card.id}`);
      ids.add(card.id);
    }
    if (all.length !== game.initialDeckSizes[player.name]) {
      throw new Error(`Card conservation failed for ${player.name}: expected ${game.initialDeckSizes[player.name]}, found ${all.length}`);
    }
    if (player.life < 0) throw new Error(`Life below 0 for ${player.name}`);
  }
}

function playMainPhase(game, playerIndex, config) {
  const player = game.players[playerIndex];
  player.landsPlayedThisTurn = 0;

  const landToPlay = player.hand.find((card) => card.type === 'land');
  if (landToPlay && player.landsPlayedThisTurn < 1) {
    moveCardBetweenArrays(landToPlay.id, player.hand, player.battlefieldLands);
    player.landsPlayedThisTurn += 1;
    const event = { turn: game.turn, type: 'play_land', player: player.name, card: landToPlay.name, cardId: landToPlay.id, phase: 'MAIN_PHASE' };
    logEvent(game, event);
    trackTurnAction(game, game.turn, player.name, 'MAIN_PHASE', event);
    game.turnContext.cardsPlayedThisTurn += 1;
  }

  player.manaAvailable = player.battlefieldLands.length;
  const { chosen, spentMana } = chooseCreaturesToCast(player.hand, player.manaAvailable);

  for (const creature of chosen) {
    if (creature.cost > player.manaAvailable) continue;
    const movedCreature = moveCardBetweenArrays(creature.id, player.hand, player.battlefieldCreatures);
    if (movedCreature) movedCreature.enteredTurn = game.turn;
    player.manaAvailable -= creature.cost;
    const ps = game.stats.players[playerIndex];
    ps.creaturesPlayed += 1;
    ensureCardStats(ps, creature.name).timesPlayed += 1;
    const event = {
      turn: game.turn,
      type: 'cast_creature',
      player: player.name,
      card: creature.name,
      cardId: creature.id,
      cost: creature.cost,
      phase: 'MAIN_PHASE'
    };
    logEvent(game, event);
    trackTurnAction(game, game.turn, player.name, 'MAIN_PHASE', event);
    game.turnContext.cardsPlayedThisTurn += 1;
  }

  const mainPhaseEnd = {
    turn: game.turn,
    type: 'main_phase_end',
    player: player.name,
    manaSpent: spentMana,
    manaRemaining: player.manaAvailable,
    phase: 'MAIN_PHASE'
  };
  logEvent(game, mainPhaseEnd);
  trackTurnAction(game, game.turn, player.name, 'MAIN_PHASE', mainPhaseEnd);
  game.turnContext.manaSpent = spentMana;
  game.turnContext.manaAvailable = player.battlefieldLands.length;
  if (spentMana > 0) game.turnContext.activeActions += 1;

  if (config.devAssertions) verifyConservation(game);
}

function resolveCombat(game, attackerIndex, defenderIndex, config) {
  const attackerP = game.players[attackerIndex];
  const defenderP = game.players[defenderIndex];
  const attackers = attackerP.battlefieldCreatures.filter((creature) => canAttackWithCreature(game, creature, config));
  if (attackers.length === 0) {
    const event = { turn: game.turn, type: 'combat_skip', attacker: attackerP.name, phase: 'COMBAT_STEP' };
    logEvent(game, event);
    trackTurnAction(game, game.turn, attackerP.name, 'COMBAT_STEP', event);
    return;
  }

  const defenders = defenderP.battlefieldCreatures.slice();
  const attackChoice = chooseAttackers(attackers, defenders, {
    ai: config.ai,
    blockScoring: config.blockScoring,
    rng: game.rng
  });
  const chosenAttackers = attackChoice.attackers;
  const summoningSick = attackerP.battlefieldCreatures
    .filter((creature) => !canAttackWithCreature(game, creature, config))
    .map((creature) => creature.id);
  if (summoningSick.length) {
    const sickEvent = {
      turn: game.turn,
      type: 'summoning_sickness_prevented',
      attacker: attackerP.name,
      creatures: summoningSick,
      phase: 'COMBAT_STEP'
    };
    logEvent(game, sickEvent);
    trackTurnAction(game, game.turn, attackerP.name, 'COMBAT_STEP', sickEvent);
  }
  if (chosenAttackers.length === 0) {
    const event = { turn: game.turn, type: 'combat_skip_no_attackers_chosen', attacker: attackerP.name, phase: 'COMBAT_STEP' };
    logEvent(game, event);
    trackTurnAction(game, game.turn, attackerP.name, 'COMBAT_STEP', event);
    return;
  }

  const blockChoice = chooseBlocks(chosenAttackers, defenders, {
    ai: config.ai,
    blockScoring: config.blockScoring,
    rng: game.rng
  });
  const blocks = blockChoice.blocks;
  const blockMap = new Map(blocks.map((b) => [b.attackerId, b.defenderId]));
  const defenderById = new Map(defenders.map((d) => [d.id, d]));

  const deadAttackers = new Set();
  const deadDefenders = new Set();

  const combatStart = {
    turn: game.turn,
    type: 'combat_start',
    attacker: attackerP.name,
    defender: defenderP.name,
    attackers: chosenAttackers.map((c) => c.id),
    blocks,
    phase: 'COMBAT_STEP'
  };
  logEvent(game, combatStart);
  trackTurnAction(game, game.turn, attackerP.name, 'COMBAT_STEP', combatStart);
  game.turnContext.activeActions += 1;

  game.aiCounters.smartBlockingForcedBlocksCount += blockChoice.meta.forcedBlocks.length;
  game.aiCounters.smartAttackingForcedAttackersCount += attackChoice.meta.forcedAttackers.length;
  if (attackChoice.meta.attackDecisionMode === 'heuristic') game.aiCounters.attackHeuristicCount += 1;
  else game.aiCounters.attackAlternativeCount += 1;
  if (blockChoice.meta.defendDecisionMode === 'heuristic') game.aiCounters.defendHeuristicCount += 1;
  else game.aiCounters.defendAlternativeCount += 1;
  if (attackChoice.meta.pointlessPrevented) game.aiCounters.smartAttackingRuleAPreventedCount += 1;

  if (config.ai?.debugDecisions) {
    const aiEvent = {
      turn: game.turn,
      type: 'ai_decision',
      phase: 'COMBAT_STEP',
      attacker: attackerP.name,
      defender: defenderP.name,
      smartAttacking: config.ai.smartAttacking,
      smartBlocking: config.ai.smartBlocking,
      attackCertainty: config.ai.certainty.attack,
      defendCertainty: config.ai.certainty.defend,
      forcedAttackers: attackChoice.meta.forcedAttackers.map((c) => c.id),
      forcedBlocks: blockChoice.meta.forcedBlocks,
      attackRoll: attackChoice.meta.attackRoll,
      defendRoll: blockChoice.meta.defendRoll,
      attackDecisionMode: attackChoice.meta.attackDecisionMode,
      defendDecisionMode: blockChoice.meta.defendDecisionMode,
      finalAttackers: chosenAttackers.map((c) => c.id),
      finalBlocks: blocks
    };
    logEvent(game, aiEvent);
    trackTurnAction(game, game.turn, attackerP.name, 'COMBAT_STEP', aiEvent);
  }

  for (const attacker of chosenAttackers) {
    const defenderId = blockMap.get(attacker.id);
    if (!defenderId) {
      defenderP.life = Math.max(0, defenderP.life - attacker.power);
      const aps = game.stats.players[attackerIndex];
      ensureCardStats(aps, attacker.name).damageToPlayer += attacker.power;
      const dmgEvent = {
        turn: game.turn,
        type: 'unblocked_damage',
        attacker: attacker.id,
        playerDamaged: defenderP.name,
        amount: attacker.power,
        lifeAfter: defenderP.life,
        phase: 'COMBAT_STEP'
      };
      logEvent(game, dmgEvent);
      trackTurnAction(game, game.turn, attackerP.name, 'COMBAT_STEP', dmgEvent);
      game.turnContext.damageDealtThisTurn += attacker.power;
      game.turnContext.cumulativeDamageDealt += attacker.power;
      continue;
    }

    const defender = defenderById.get(defenderId);
    const attackerDies = defender.power >= attacker.toughness;
    const defenderDies = attacker.power >= defender.toughness;

    if (attackerDies) deadAttackers.add(attacker.id);
    if (defenderDies) deadDefenders.add(defender.id);

    if (defenderDies) {
      const aps = game.stats.players[attackerIndex];
      ensureCardStats(aps, attacker.name).killsMade += 1;
    }
    if (attackerDies) {
      const dps = game.stats.players[defenderIndex];
      ensureCardStats(dps, defender.name).killsMade += 1;
    }

    const blockEvent = {
      turn: game.turn,
      type: 'blocked_combat',
      attacker: attacker.id,
      defender: defender.id,
      attackerPower: attacker.power,
      attackerToughness: attacker.toughness,
      defenderPower: defender.power,
      defenderToughness: defender.toughness,
      attackerDies,
      defenderDies,
      phase: 'COMBAT_STEP'
    };
    logEvent(game, blockEvent);
    trackTurnAction(game, game.turn, attackerP.name, 'COMBAT_STEP', blockEvent);
  }

  for (const deadId of deadAttackers) {
    const deadCard = moveCardBetweenArrays(deadId, attackerP.battlefieldCreatures, attackerP.graveyard);
    const aps = game.stats.players[attackerIndex];
    aps.creaturesDied += 1;
    ensureCardStats(aps, deadCard.name).timesDied += 1;
  }
  for (const deadId of deadDefenders) {
    const deadCard = moveCardBetweenArrays(deadId, defenderP.battlefieldCreatures, defenderP.graveyard);
    const dps = game.stats.players[defenderIndex];
    dps.creaturesDied += 1;
    ensureCardStats(dps, deadCard.name).timesDied += 1;
  }

  if (defenderP.life <= 0) {
    game.winner = attackerIndex === 0 ? 'A' : 'B';
    game.endedReason = 'life_zero';
    logEvent(game, { turn: game.turn, type: 'game_end_life_zero', loser: defenderP.name, winner: attackerP.name });
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
    turn: 1,
    activePlayerIndex: 0,
    seed,
    players: [
      createPlayer(deckACloned, config.startingLife, 'A'),
      createPlayer(deckBCloned, config.startingLife, 'B')
    ],
    log: [],
    winner: null,
    endedReason: null,
    stats: createGameStats(),
    initialDeckSizes: {
      A: deckACloned.length,
      B: deckBCloned.length
    },
    turnSummaries: {},
    warnings: [],
    turnContext: {},
    isTurnActive: false,
    cumulativeDamageByPlayer: { A: 0, B: 0 },
    aiCounters: {
      smartBlockingForcedBlocksCount: 0,
      smartAttackingForcedAttackersCount: 0,
      attackHeuristicCount: 0,
      attackAlternativeCount: 0,
      defendHeuristicCount: 0,
      defendAlternativeCount: 0,
      smartAttackingRuleAPreventedCount: 0
    },
    rng
  };

  for (let i = 0; i < config.startingHandSize; i += 1) {
    if (!game.winner) drawCard(game, 0);
    if (!game.winner) drawCard(game, 1);
  }

  if (config.devAssertions) verifyConservation(game);
  return game;
}

function simulateGame({ seed = 1, deckA, deckB, config = {} }) {
  const cfg = {
    startingLife: 20,
    maxTurns: 200,
    startingHandSize: 7,
    logMode: 'summary',
    devAssertions: true,
    blockScoring: {},
    ai: {
      smartBlocking: false,
      smartAttacking: false,
      certainty: {
        attack: 100,
        defend: 100
      },
      debugDecisions: false,
      ...(config?.ai || {})
    },
    rules: {
      summoningSickness: false,
      ...(config?.rules || {})
    },
    ...config
  };
  cfg.rules = {
    summoningSickness: false,
    ...(cfg.rules || {})
  };

  cfg.ai = {
    smartBlocking: !!cfg.ai?.smartBlocking,
    smartAttacking: !!cfg.ai?.smartAttacking,
    debugDecisions: !!cfg.ai?.debugDecisions,
    certainty: {
      attack: Number.isFinite(Number(cfg.ai?.certainty?.attack)) ? Number(cfg.ai.certainty.attack) : 100,
      defend: Number.isFinite(Number(cfg.ai?.certainty?.defend)) ? Number(cfg.ai.certainty.defend) : 100
    }
  };

  const game = newGame({ seed, deckA, deckB, config: cfg });

  while (!game.winner && game.turn <= cfg.maxTurns) {
    const ap = game.activePlayerIndex;
    const dp = ap === 0 ? 1 : 0;
    const activePlayer = game.players[ap];

    game.isTurnActive = true;
    game.turnContext = {
      cardsPlayedThisTurn: 0,
      manaSpent: 0,
      manaAvailable: 0,
      damageDealtThisTurn: 0,
      cumulativeDamageDealt: game.cumulativeDamageByPlayer?.[activePlayer.name] || 0,
      activeActions: 0
    };
    const turnStart = { turn: game.turn, type: 'turn_start', player: activePlayer.name, phase: 'TURN_START' };
    logEvent(game, turnStart);
    ensureTurnSummary(game, game.turn, activePlayer.name);

    drawCard(game, ap);
    if (game.winner) {
      const summary = ensureTurnSummary(game, game.turn, activePlayer.name);
      summary.warnings.push('Snapshot missing: turn ended before END_STEP');
      game.warnings.push(`Snapshot missing for ${activePlayer.name} turn ${game.turn}`);
      game.isTurnActive = false;
      break;
    }

    playMainPhase(game, ap, cfg);
    resolveCombat(game, ap, dp, cfg);

    game.cumulativeDamageByPlayer[activePlayer.name] = game.turnContext.cumulativeDamageDealt;
    captureSnapshot(game, ap, game.turnContext);
    const snapshotEvent = {
      turn: game.turn,
      type: 'turn_end',
      player: activePlayer.name,
      phase: 'END_STEP',
      snapshotCaptured: !!ensureTurnSummary(game, game.turn, activePlayer.name).eotSnapshot
    };
    logEvent(game, snapshotEvent);
    trackTurnAction(game, game.turn, activePlayer.name, 'END_STEP', snapshotEvent);

    if (game.winner) {
      game.isTurnActive = false;
      break;
    }

    game.isTurnActive = false;
    game.activePlayerIndex = dp;
    game.turn += 1;
  }

  if (!game.winner) {
    game.winner = 'draw';
    game.endedReason = 'max_turns';
    logEvent(game, { turn: game.turn, type: 'game_end_max_turns' });
  }

  const winner = game.winner === 'draw' ? 'draw' : game.winner;
  const result = {
    seed: game.seed,
    winner,
    endedReason: game.endedReason,
    turns: game.turn,
    finalLife: {
      A: game.players[0].life,
      B: game.players[1].life
    },
    stats: game.stats,
    aiCounters: game.aiCounters,
    turnSummaries: game.turnSummaries,
    warnings: game.warnings,
    log: cfg.logMode === 'none' ? [] : game.log
  };

  if (cfg.logMode === 'summary') {
    result.log = game.log.filter((event) => (
      event.type === 'turn_start'
      || event.type.startsWith('game_end')
      || event.type === 'deck_out'
    ));
  }

  return result;
}

function simulateMany({ iterations = 100, seedBase = 1337, deckA, deckB, config = {} }) {
  if (!Number.isInteger(iterations) || iterations < 1) {
    throw new Error(`iterations must be positive integer, got ${iterations}`);
  }

  const games = [];
  for (let i = 0; i < iterations; i += 1) {
    const seed = (seedBase + i) >>> 0;
    games.push(simulateGame({ seed, deckA, deckB, config }));
  }

  return {
    iterations,
    seedBase,
    summary: aggregateResults(games),
    games
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

module.exports = {
  mulberry32,
  shuffleInPlace,
  simulateGame,
  simulateMany,
  buildDeckFromList,
  buildStarterDeck
};

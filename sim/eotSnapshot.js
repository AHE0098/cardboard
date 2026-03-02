function sumCreaturePower(creatures) {
  return (creatures || []).reduce((sum, c) => sum + (Number(c?.power) || 0), 0);
}

function buildEotSnapshot(game, playerIndex, turnContext = {}) {
  const player = game.players[playerIndex];
  const opponent = game.players[playerIndex === 0 ? 1 : 0];
  const handSize = player.hand.length;
  const deckSize = player.library.length;
  const graveyardSize = player.graveyard.length;
  const landsInPlay = player.battlefieldLands.length;
  const creaturesInPlay = player.battlefieldCreatures.length;
  const battlefieldCount = landsInPlay + creaturesInPlay;
  const totalCreaturePower = sumCreaturePower(player.battlefieldCreatures);
  const cardsPlayedThisTurn = Number(turnContext.cardsPlayedThisTurn || 0);
  const manaSpent = Number(turnContext.manaSpent || 0);
  const manaAvailable = Number(turnContext.manaAvailable || 0);
  const damageDealtThisTurn = Number(turnContext.damageDealtThisTurn || 0);
  const cumulativeDamageDealt = Number(turnContext.cumulativeDamageDealt || 0);
  const activeActions = Number(turnContext.activeActions || 0);

  const deadTurn = activeActions === 0;
  const resourceScrew = game.turn >= 3 && landsInPlay <= Math.floor(game.turn / 3);
  const resourceFlood = landsInPlay >= handSize + creaturesInPlay + 3;
  const stalledBoard = creaturesInPlay >= 3 && opponent?.battlefieldCreatures?.length >= 3 && damageDealtThisTurn === 0;

  return {
    player: player.name,
    turn: game.turn,
    life: player.life,
    opponentLife: opponent.life,
    zones: {
      handSize,
      deckSize,
      graveyardSize,
      landsInPlay,
      creaturesInPlay,
      battlefieldCount,
      cardsInKnownZones: handSize + deckSize + graveyardSize + battlefieldCount
    },
    tempo: {
      cardsPlayedThisTurn,
      manaSpent,
      manaAvailable,
      manaUnused: Math.max(0, manaAvailable - manaSpent)
    },
    combat: {
      attackersAvailable: creaturesInPlay,
      totalCreaturePower,
      damageDealtThisTurn,
      cumulativeDamageDealt
    },
    flags: {
      deadTurn,
      resourceScrew,
      resourceFlood,
      stalledBoard
    }
  };
}

module.exports = {
  buildEotSnapshot
};

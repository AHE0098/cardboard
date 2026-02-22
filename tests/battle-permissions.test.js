const assert = require('node:assert/strict');
const { applyIntent, makeRoom } = require('../server');

function mkRoom() {
  const room = makeRoom({ playerId: 'p1-id', playerName: 'Alice' });
  room.state.players.p2.id = 'p2-id';
  room.state.players.p2.name = 'Bob';
  return room;
}

(function run() {
  const room = mkRoom();

  const p1Card = room.state.players.p1.zones.hand[0];
  const p2Card = room.state.players.p2.zones.hand[0];

  let res = applyIntent(room, 'p1', {
    type: 'MOVE_CARD',
    payload: {
      cardId: p1Card,
      from: { owner: 'p1', zone: 'hand' },
      to: { owner: 'p1', zone: 'lands' }
    }
  });
  assert.equal(res.ok, true, 'p1 should move own card to own battlefield');

  const numericMoveCard = Number(room.state.players.p1.zones.hand[0]);
  res = applyIntent(room, 'p1', {
    type: 'MOVE_CARD',
    payload: {
      cardId: numericMoveCard,
      from: { owner: 'p1', zone: 'hand' },
      to: { owner: 'p1', zone: 'permanents' }
    }
  });
  assert.equal(res.ok, true, 'numeric card id should match string-backed zone cards for MOVE_CARD');


  res = applyIntent(room, 'p1', {
    type: 'MOVE_CARD',
    payload: {
      cardId: p2Card,
      from: { owner: 'p2', zone: 'hand' },
      to: { owner: 'p1', zone: 'lands' }
    }
  });
  assert.equal(res.ok, false, 'p1 cannot move opponent private card');


  res = applyIntent(room, 'p1', {
    type: 'MOVE_CARD',
    payload: {
      cardId: room.state.players.p1.zones.hand[0],
      from: { owner: 'p1', zone: 'hand' },
      to: { owner: 'p2', zone: 'permanents' }
    }
  });
  assert.equal(res.ok, true, 'p1 can play from own hand directly to opponent battlefield zones');

  res = applyIntent(room, 'p1', {
    type: 'DRAW_CARD',
    payload: { owner: 'p2' }
  });
  assert.equal(res.ok, false, 'p1 cannot draw from p2 deck');

  res = applyIntent(room, 'p1', {
    type: 'MOVE_CARD',
    payload: {
      cardId: room.state.players.p1.zones.lands[0],
      from: { owner: 'p1', zone: 'lands' },
      to: { owner: 'p1', zone: 'stack' }
    }
  });
  assert.equal(res.ok, true, 'p1 can move own battlefield card to shared stack');




  const p2BattleCard = room.state.players.p2.zones.hand[0];
  res = applyIntent(room, 'p2', {
    type: 'MOVE_CARD',
    payload: {
      cardId: p2BattleCard,
      from: { owner: 'p2', zone: 'hand' },
      to: { owner: 'p2', zone: 'lands' }
    }
  });
  assert.equal(res.ok, true, 'p2 should move own card to battlefield for interaction tests');

  res = applyIntent(room, 'p1', {
    type: 'MOVE_CARD',
    payload: {
      cardId: p2BattleCard,
      from: { owner: 'p2', zone: 'lands' },
      to: { owner: 'p1', zone: 'permanents' }
    }
  });
  assert.equal(res.ok, true, 'p1 can move opponent battlefield card between battlefield zones');

  res = applyIntent(room, 'p1', {
    type: 'TOGGLE_TAP',
    payload: { cardId: p2BattleCard, kind: 'tapped' }
  });
  assert.equal(res.ok, true, 'p1 can toggle opponent battlefield card');


  if (!room.state.players.p1.zones.hand.length) {
    applyIntent(room, 'p1', { type: 'DRAW_CARD', payload: { owner: 'p1' } });
  }
  const toDeckCard = room.state.players.p1.zones.hand[0];
  res = applyIntent(room, 'p1', {
    type: 'DECK_PLACE',
    payload: {
      cardId: toDeckCard,
      from: { owner: 'p1', zone: 'hand' },
      owner: 'p1',
      where: 'top'
    }
  });
  assert.equal(res.ok, true, 'p1 can place own hand card on top of own deck');
  assert.equal(room.state.players.p1.zones.deck[0], toDeckCard, 'card should be placed on top');

  if (!room.state.players.p1.zones.hand.length) {
    applyIntent(room, 'p1', { type: 'DRAW_CARD', payload: { owner: 'p1' } });
  }
  const numericDeckPlaceCard = Number(room.state.players.p1.zones.hand[0]);
  res = applyIntent(room, 'p1', {
    type: 'DECK_PLACE',
    payload: {
      cardId: numericDeckPlaceCard,
      from: { owner: 'p1', zone: 'hand' },
      owner: 'p1',
      where: 'bottom'
    }
  });
  assert.equal(res.ok, true, 'numeric card id should match string-backed zone cards for DECK_PLACE');

  res = applyIntent(room, 'p1', {
    type: 'DECK_PLACE',
    payload: {
      cardId: room.state.players.p2.zones.hand[0],
      from: { owner: 'p2', zone: 'hand' },
      owner: 'p1',
      where: 'bottom'
    }
  });
  assert.equal(res.ok, false, 'p1 cannot place opponent private card into own deck');

  console.log('battle permissions tests passed');
})();

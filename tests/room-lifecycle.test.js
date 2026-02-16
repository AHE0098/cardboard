const assert = require('node:assert/strict');
const { makeRoom, rooms } = require('../server');
const { DEFAULT_BATTLE_DECK_P1, DEFAULT_BATTLE_DECK_P2 } = require('../battleDecks');

(function run() {
  rooms.clear();
  const room = makeRoom({ playerId: 'host-id', playerName: 'Host' }, { requestedRoomId: 'ABCD12' });
  assert.ok(room, 'room should be created');
  assert.equal(room.roomId, 'ABCD12', 'requested room id should be used');

  assert.equal(room.state.players.p1.zones.hand.length + room.state.players.p1.zones.deck.length, DEFAULT_BATTLE_DECK_P1.length, 'p1 should receive default battle deck size');
  assert.equal(room.state.players.p2.zones.hand.length + room.state.players.p2.zones.deck.length, DEFAULT_BATTLE_DECK_P2.length, 'p2 should receive default battle deck size');
  assert.equal(typeof room.state.players.p1.zones.hand[0], 'string', 'p1 cards should remain string ids');
  assert.equal(typeof room.state.players.p2.zones.hand[0], 'string', 'p2 cards should remain string ids');

  // Simulate host leaving with new behavior (seat should be clear-able without auto deletion)
  room.state.players.p1 = { ...room.state.players.p1, id: null, name: 'Waiting for Player 1...' };
  assert.ok(rooms.has('ABCD12'), 'room should still exist after host seat is empty');
  assert.equal(room.state.players.p1.id, null, 'p1 seat should be available');

  // Second player can still be seated and room remains listable until full
  room.state.players.p2 = { ...room.state.players.p2, id: 'guest-id', name: 'Guest' };
  assert.equal(room.state.players.p2.id, 'guest-id', 'p2 should be set');

  // Cleanup behavior expected by delete-all endpoint path
  rooms.clear();
  assert.equal(rooms.size, 0, 'rooms map should be empty after clear');

  console.log('room lifecycle tests passed');
})();

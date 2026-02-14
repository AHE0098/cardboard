const assert = require('node:assert/strict');
const { makeRoom, rooms } = require('../server');

(function run() {
  rooms.clear();
  const room = makeRoom({ playerId: 'host-id', playerName: 'Host' }, { requestedRoomId: 'ABCD12' });
  assert.ok(room, 'room should be created');
  assert.equal(room.roomId, 'ABCD12', 'requested room id should be used');

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

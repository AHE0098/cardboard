const assert = require('node:assert/strict');
const crypto = require('crypto');
const server = require('../server');

(function run() {
  const originalNow = Date.now;
  const originalRandomInt = crypto.randomInt;

  try {
    Date.now = () => 1700000000000;
    crypto.randomInt = undefined;

    const ids = new Set();
    for (let i = 0; i < 12; i += 1) {
      const room = server.makeRoom({ playerId: `p-${i}`, playerName: `Player${i}` });
      assert.ok(room, `Expected room creation to succeed on iteration ${i}`);
      assert.ok(!ids.has(room.roomId), `Expected unique roomId, got duplicate ${room.roomId}`);
      ids.add(room.roomId);
      server.rooms.delete(room.roomId);
    }
  } finally {
    Date.now = originalNow;
    crypto.randomInt = originalRandomInt;
  }

  console.log('room code collision regression test passed');
})();

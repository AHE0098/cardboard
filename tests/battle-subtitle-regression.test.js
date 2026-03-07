const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

(function run() {
  const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'app2.js'), 'utf8');
  assert.match(src, /getSubtitleText:\s*\(\{\s*activePlayer\s*\}\)\s*=>\s*\{/m, 'battle mount should provide subtitle adapter');
  assert.match(src, /const roomLabel = battleRoomId \? `Game \$\{battleRoomId\}` : "Game -";/, 'battle subtitle should include room id when available');
  console.log('battle subtitle regression test passed');
})();

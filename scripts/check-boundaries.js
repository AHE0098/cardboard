const fs = require('fs');
const path = require('path');

function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.git')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.(js|ts|tsx|md)$/.test(entry.name)) out.push(full);
  }
  return out;
}

function fail(msg) {
  console.error(`boundary check failed: ${msg}`);
  process.exitCode = 1;
}

const coreFiles = walk(path.join(process.cwd(), 'core'));
for (const file of coreFiles) {
  const text = fs.readFileSync(file, 'utf8');
  const banned = ['window.', 'document.', 'localStorage', 'Date.now(', 'Math.random('];
  for (const token of banned) {
    if (text.includes(token)) fail(`${path.relative(process.cwd(), file)} contains banned token \`${token}\``);
  }
}

const manuscriptFiles = walk(path.join(process.cwd(), 'manuscripts'));
for (const file of manuscriptFiles) {
  const text = fs.readFileSync(file, 'utf8');
  if (/from\s+['\"].*adapters\//.test(text) || /require\(['\"].*adapters\//.test(text)) {
    fail(`${path.relative(process.cwd(), file)} imports adapters, which is forbidden`);
  }
}

const compositionFiles = walk(path.join(process.cwd(), 'compositions')).filter((f) => /\.(js|ts)$/.test(f));
for (const file of compositionFiles) {
  const text = fs.readFileSync(file, 'utf8');
  const logicTokens = (text.match(/\b(if|for|while|switch)\b/g) || []).length;
  if (logicTokens > 12) {
    fail(`${path.relative(process.cwd(), file)} appears to include business logic (tokens=${logicTokens})`);
  }
}

if (!process.exitCode) {
  console.log('boundary checks passed');
}

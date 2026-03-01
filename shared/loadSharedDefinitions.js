const fs = require("fs");
const path = require("path");

function getDefinitionsPath(rootDir = __dirname) {
  return path.join(rootDir, "definitions.json");
}

function loadSharedDefinitions(opts = {}) {
  const rootDir = opts.rootDir || __dirname;
  const definitionsPath = getDefinitionsPath(rootDir);

  if (!fs.existsSync(definitionsPath)) {
    return { found: false, definitionsPath, data: null };
  }

  try {
    const raw = fs.readFileSync(definitionsPath, "utf8");
    const data = JSON.parse(raw);
    return { found: true, definitionsPath, data };
  } catch (error) {
    return { found: true, definitionsPath, data: null, error };
  }
}

module.exports = {
  getDefinitionsPath,
  loadSharedDefinitions
};

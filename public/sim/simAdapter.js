(function initSimAdapter(global) {
  const SimUI = (global.SimUI = global.SimUI || {});

  function toSimCost(raw, parseManaCost) {
    if (Number.isFinite(Number(raw))) return Number(raw);
    const tokens = parseManaCost(raw);
    let cost = 0;
    tokens.forEach((tok) => {
      if (/^\d+$/.test(tok)) cost += Number(tok);
      else if (/^[WUBRGX]$/.test(tok)) cost += 1;
    });
    return cost;
  }

  function resolveDeckToSimCards(deckObj, sideLabel, deps) {
    const ids = typeof global.expandDeckCardIds === "function"
      ? global.expandDeckCardIds(deckObj)
      : (Array.isArray(deckObj?.cards) ? deckObj.cards.map(String) : []);
    const out = [];
    const unsupported = [];
    ids.forEach((cardId, idx) => {
      const data = deps.getCardDef(cardId);
      const kind = typeof global.CARD_KIND === "function"
        ? global.CARD_KIND(cardId)
        : String(data?.kind || data?.type || "").toLowerCase();
      const name = String(data?.name || `Card ${cardId}`);
      if (kind === "land") {
        out.push({ id: `${sideLabel}_${idx}_${cardId}`, type: "land", name });
        return;
      }
      if (kind === "creature") {
        const power = Number(data?.power);
        const toughness = Number(data?.toughness);
        const cost = toSimCost(data?.cost ?? data?.costs ?? data?.cmc ?? 0, deps.parseManaCost);
        if (!Number.isFinite(power) || !Number.isFinite(toughness) || !Number.isFinite(cost)) {
          unsupported.push(`${name} (missing P/T/cost)`);
          return;
        }
        out.push({ id: `${sideLabel}_${idx}_${cardId}`, type: "creature", name, cost, power, toughness });
        return;
      }
      unsupported.push(`${name} (${kind || "unknown"})`);
    });
    return { cards: out, unsupported };
  }

  function normalizeSimResult(raw, iterations) {
    const runsMeta = Array.isArray(raw?.runsMeta) ? raw.runsMeta : [];
    const sampleGame = raw?.sampleGame || null;
    const summary = raw?.summary || null;
    const winPoints = SimUI.computeWinrateSeries ? SimUI.computeWinrateSeries(runsMeta, iterations) : [];
    const turns = sampleGame?.turnSummaries || {};
    const turnCount = Object.keys(turns).length;
    const turnRows = [];
    let snapshotCount = 0;
    Object.keys(turns).sort((a, b) => Number(a) - Number(b)).forEach((turnKey) => {
      const perPlayer = turns[turnKey] || {};
      Object.keys(perPlayer).sort().forEach((player) => {
        const summaryRow = perPlayer[player] || {};
        const snap = summaryRow.eotSnapshot;
        if (snap) snapshotCount += 1;
        const events = ["DRAW_STEP", "MAIN_PHASE", "COMBAT_STEP", "END_STEP"].reduce((acc, phase) => acc + ((summaryRow?.actionsByPhase?.[phase] || []).length), 0);
        turnRows.push({ turn: Number(turnKey), player, summary: summaryRow, events, hasSnapshot: !!snap });
      });
    });
    return { summary, sampleGame, runsMeta, winPoints, turnRows, metrics: { turnCount, rowCount: turnRows.length, snapshotCount, winPointCount: winPoints.length } };
  }

  function buildParityHash(vm) {
    if (!vm) return "sim-parity:none";
    const payload = { turns: vm.metrics?.turnCount || 0, rows: vm.metrics?.rowCount || 0, snapshots: vm.metrics?.snapshotCount || 0, winPoints: vm.metrics?.winPointCount || 0, events: (vm.turnRows || []).map((r) => [r.turn, r.player, r.events, r.hasSnapshot ? 1 : 0]) };
    return `sim-parity:${JSON.stringify(payload)}`;
  }

  SimUI.resolveDeckToSimCards = resolveDeckToSimCards;
  SimUI.normalizeSimResult = normalizeSimResult;
  SimUI.buildParityHash = buildParityHash;
})(window);

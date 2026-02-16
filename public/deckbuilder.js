(() => {
  const DEBUG = false;

  const DEFAULTS = {
    deckSize: 40,
    lands: 17,
    targetValueSum: 0,
    targetDeckScore: 0,
    includeLands: true,
    seed: "1337",
    powerLevel: 50,
    avgCmcTarget: 2.6,
    curvePreset: "midrange",
    enforceCurve: true,
    lockColors: false,
    allowDuplicates: false,
    colorsSelected: ["W", "U", "B", "R", "G"],
    overviewMode: "grid",
    listSort: "name"
  };

  const CONSTS = {
    K_PENALTY: 60,
    PSTAR_A: 0.25,
    PSTAR_B: 0.05,
    PSTAR_MIN: 0.2,
    PSTAR_MAX: 0.6
  };

  const COLOR_ORDER = ["W", "U", "B", "R", "G", "C"];
  const CURVE_ORDER = ["0", "1", "2", "3", "4", "5", "6+"];
  const CURVE_PRESETS = {
    aggro: { "0": 0.05, "1": 0.2, "2": 0.3, "3": 0.25, "4": 0.12, "5": 0.05, "6+": 0.03 },
    midrange: { "0": 0.05, "1": 0.12, "2": 0.23, "3": 0.25, "4": 0.2, "5": 0.1, "6+": 0.05 },
    control: { "0": 0.08, "1": 0.08, "2": 0.16, "3": 0.2, "4": 0.22, "5": 0.14, "6+": 0.12 },
    random: { "0": 0.14, "1": 0.14, "2": 0.14, "3": 0.14, "4": 0.14, "5": 0.14, "6+": 0.16 }
  };

  const LAND_IDS = [101, 102, 103, 104, 105, 106].map((id) => String(id));
  const LAND_ID_SET = new Set(LAND_IDS);

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  function toFiniteNumber(x, fallback = 0) {
    const n = Number(x);
    return Number.isFinite(n) ? n : fallback;
  }

  function hashSeed(input) {
    const str = String(input || "1337");
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i += 1) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return h >>> 0;
  }

  function makeRng(seedInput) {
    let seed = hashSeed(seedInput);
    return () => {
      seed += 0x6d2b79f5;
      let t = seed;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function isLandId(id) {
    return LAND_ID_SET.has(String(id));
  }

  function parseManaCost(costInput) {
    const out = {
      cmcApprox: 0,
      colors: {},
      pipCount: { W: 0, U: 0, B: 0, R: 0, G: 0 },
      isColorless: true
    };
    const costStr = (costInput == null ? "" : String(costInput)).trim().toUpperCase();
    if (!costStr) return out;

    const symbols = costStr.match(/[0-9]+|[WUBRGCX]/g) || [];
    symbols.forEach((symbol) => {
      if (/^[0-9]+$/.test(symbol)) {
        out.cmcApprox += Number(symbol);
      } else if (symbol === "X") {
        out.cmcApprox += 1;
      } else if (["W", "U", "B", "R", "G"].includes(symbol)) {
        out.cmcApprox += 1;
        out.colors[symbol] = true;
        out.pipCount[symbol] += 1;
      } else if (symbol === "C") {
        out.cmcApprox += 1;
      }
    });

    out.cmcApprox = Math.max(0, out.cmcApprox);
    out.isColorless = Object.keys(out.colors).length === 0;
    return out;
  }

  function normalizeCard(rawId, card) {
    if (rawId == null || rawId === "") return null;
    const id = String(rawId);
    const mana = parseManaCost(card?.cost);
    return {
      id,
      name: String(card?.name || `Card ${id}`),
      rawCost: card?.cost == null ? "" : String(card.cost),
      cmc: Number(mana.cmcApprox || 0),
      colors: Object.keys(mana.colors),
      colorMask: COLOR_ORDER.reduce((mask, c, idx) => (mana.colors[c] ? mask | (1 << idx) : mask), 0),
      power: toFiniteNumber(card?.power, 0),
      toughness: toFiniteNumber(card?.toughness, 0),
      value: toFiniteNumber(card?.value, 0),
      type: isLandId(id) ? "land" : "spell"
    };
  }

  function analyzeCardPool(allCards) {
    const entries = Array.isArray(allCards)
      ? allCards.map((c, index) => [c?.id ?? c?.cardId ?? index, c])
      : (allCards && typeof allCards === "object")
        ? Object.entries(allCards)
        : [];

    let droppedMalformed = 0;
    const pool = [];
    entries.forEach(([idRaw, card]) => {
      const normalized = normalizeCard(idRaw, card);
      if (!normalized) {
        droppedMalformed += 1;
        return;
      }
      pool.push(normalized);
    });

    return {
      pool,
      droppedMalformed,
      landCount: pool.filter((c) => c.type === "land").length
    };
  }

  function getDeckbuilderCardPool(allCards) {
    return analyzeCardPool(allCards).pool;
  }

  function computeDeckScore(stats) {
    const pStar = clamp(CONSTS.PSTAR_A + CONSTS.PSTAR_B * stats.avgCost, CONSTS.PSTAR_MIN, CONSTS.PSTAR_MAX);
    const consistency = Math.exp(-CONSTS.K_PENALTY * ((stats.landFraction - pStar) ** 2));
    return {
      pStar,
      consistency,
      deckScore: stats.baseValue * consistency
    };
  }

  function getCurveBucket(cmc) {
    if (!Number.isFinite(cmc)) return "0";
    if (cmc >= 6) return "6+";
    return String(clamp(Math.floor(cmc), 0, 5));
  }

  function computeDeckStats(deck, poolById) {
    const ids = Array.isArray(deck?.nonlandIds) ? deck.nonlandIds.map((id) => String(id)) : [];
    const lands = Math.max(0, Math.round(toFiniteNumber(deck?.lands, 0)));
    const cards = ids.map((id) => poolById[id]).filter(Boolean);

    const totalCards = cards.length + lands;
    const sumValue = cards.reduce((sum, c) => sum + c.value, 0);
    const sumPT = cards.reduce((sum, c) => sum + c.power + c.toughness, 0);
    const sumCmc = cards.reduce((sum, c) => sum + c.cmc, 0);
    const avgCmc = cards.length ? sumCmc / cards.length : 0;
    const avgValue = cards.length ? sumValue / cards.length : 0;
    const landFraction = totalCards ? lands / totalCards : 0;

    const histogram = { "0": 0, "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6+": 0 };
    const colorCounts = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0 };
    cards.forEach((c) => {
      histogram[getCurveBucket(c.cmc)] += 1;
      if (!c.colors.length) colorCounts.C += 1;
      c.colors.forEach((color) => {
        if (colorCounts[color] != null) colorCounts[color] += 1;
      });
    });

    const dupMap = {};
    ids.forEach((id) => {
      dupMap[id] = (dupMap[id] || 0) + 1;
    });
    const duplicatesCount = Object.values(dupMap).reduce((sum, n) => sum + Math.max(0, n - 1), 0);

    const scoreBits = computeDeckScore({ avgCost: avgCmc, landFraction, baseValue: avgValue });
    const quality = clamp(
      50 + avgValue * 4 - duplicatesCount * 1.5 - Math.abs(landFraction - 0.42) * 30 - Math.abs(avgCmc - 2.6) * 6,
      0,
      100
    );

    return {
      totalCards,
      lands,
      nonlands: cards.length,
      sumValue,
      avgValue,
      sumPT,
      avgCmc,
      avgCost: avgCmc,
      baseValue: avgValue,
      landFraction,
      curveHistogram: histogram,
      colorCounts,
      duplicatesCount,
      pStar: scoreBits.pStar,
      consistency: scoreBits.consistency,
      deckScore: scoreBits.deckScore,
      deckQuality: quality
    };
  }

  function normalizeSettings(input = {}) {
    const merged = { ...DEFAULTS, ...input };
    const deckSize = clamp(Math.round(toFiniteNumber(merged.deckSize, DEFAULTS.deckSize)), 20, 100);
    const lands = clamp(Math.round(toFiniteNumber(merged.lands, DEFAULTS.lands)), 0, deckSize);
    const curvePreset = CURVE_PRESETS[String(merged.curvePreset || "").toLowerCase()] ? String(merged.curvePreset).toLowerCase() : "midrange";
    const colorsSelected = Array.isArray(merged.colorsSelected)
      ? COLOR_ORDER.filter((c) => merged.colorsSelected.map(String).map((x) => x.toUpperCase()).includes(c))
      : DEFAULTS.colorsSelected.slice();

    return {
      ...merged,
      deckSize,
      lands,
      targetValueSum: Math.round(toFiniteNumber(merged.targetValueSum, 0)),
      powerLevel: clamp(Math.round(toFiniteNumber(merged.powerLevel, 50)), 0, 100),
      avgCmcTarget: clamp(toFiniteNumber(merged.avgCmcTarget, 2.6), 1.5, 4.5),
      curvePreset,
      enforceCurve: merged.enforceCurve !== false,
      lockColors: !!merged.lockColors,
      allowDuplicates: !!merged.allowDuplicates,
      colorsSelected,
      seed: merged.seed == null ? "1337" : String(merged.seed),
      overviewMode: ["grid", "curve", "list"].includes(merged.overviewMode) ? merged.overviewMode : "grid",
      listSort: ["name", "value", "cmc"].includes(merged.listSort) ? merged.listSort : "name"
    };
  }

  function normalizeState(state) {
    return {
      settings: normalizeSettings(state?.settings || {}),
      lastDeck: state?.lastDeck || null,
      savedDecks: Array.isArray(state?.savedDecks) ? state.savedDecks : [],
      lastSelectedDeckId: state?.lastSelectedDeckId || "",
      inspectCardId: state?.inspectCardId || ""
    };
  }

  function colorEligibility(card, selectedSet, strict) {
    if (!selectedSet.size) return true;
    if (!card.colors.length) return true;
    if (!strict) return true;
    return card.colors.every((c) => selectedSet.has(c));
  }

  function colorPreference(card, selectedSet) {
    if (!selectedSet.size) return 0;
    if (!card.colors.length) return 0.15;
    const hits = card.colors.filter((c) => selectedSet.has(c)).length;
    return hits / card.colors.length;
  }

  function buildDeck(settingsInput, allCards) {
    const startedAt = (typeof performance !== "undefined" ? performance.now() : Date.now());
    const safe = normalizeSettings(settingsInput);
    const cardsSource =
  allCards ??
  window.CARD_REPO ??
  window.CARD_DB ??
  window.CARDS ??
  null;

const inspected = analyzeCardPool(cardsSource);

    const pool = inspected.pool.filter((c) => c.type !== "land");
    const poolById = Object.fromEntries(pool.map((c) => [c.id, c]));
    const selectedSet = new Set(safe.colorsSelected.filter((c) => c !== "C"));
    const nonlandTarget = Math.max(0, safe.deckSize - safe.lands);

    const diagnostics = {
      poolSize: pool.length,
      legalPoolSize: 0,
      droppedMalformed: inspected.droppedMalformed,
      recognizedLandIds: inspected.landCount,
      relaxed: [],
      warning: "",
      status: "",
      feasibleRange: [0, 0],
      iterations: 0,
      buildMs: 0
    };

    if (!pool.length) {
      diagnostics.status = "Pool: 0 cards. No deck can be built.";
      return {
        nonlandIds: [],
        lands: safe.lands,
        settings: safe,
        diagnostics,
        error: "No cards available.",
        stats: computeDeckStats({ nonlandIds: [], lands: safe.lands }, poolById),
        builtAt: Date.now()
      };
    }

    const valueList = pool.map((c) => c.value);
    const minValue = Math.min(...valueList);
    const maxValue = Math.max(...valueList);
    diagnostics.feasibleRange = [Number((minValue * nonlandTarget).toFixed(1)), Number((maxValue * nonlandTarget).toFixed(1))];

    const seedTag = `${safe.seed}|${safe.deckSize}|${safe.lands}|${safe.targetValueSum}|${safe.avgCmcTarget}|${safe.curvePreset}|${safe.colorsSelected.join("")}|${safe.lockColors}|${safe.allowDuplicates}`;
    const rng = makeRng(seedTag);

    let legalPool = pool.filter((c) => colorEligibility(c, selectedSet, safe.lockColors));
    diagnostics.legalPoolSize = legalPool.length;
    let allowDuplicates = safe.allowDuplicates;
    if (legalPool.length < nonlandTarget && !allowDuplicates) {
      allowDuplicates = true;
      diagnostics.relaxed.push("duplicates:on");
      diagnostics.warning = `Only ${legalPool.length} legal cards; duplicates enabled.`;
    }
    if (!legalPool.length && safe.lockColors) {
      legalPool = pool.filter((c) => colorEligibility(c, selectedSet, false));
      diagnostics.relaxed.push("color:soft");
      diagnostics.warning = "Strict color lock had no legal cards; switched to soft color preference.";
    }
    if (!legalPool.length) {
      legalPool = pool.slice();
      diagnostics.relaxed.push("pool:any");
      diagnostics.warning = "All constraints relaxed due to empty legal pool.";
    }

    const targetCurve = CURVE_PRESETS[safe.curvePreset] || CURVE_PRESETS.midrange;
    const targetAvg = safe.avgCmcTarget;
    const targetValue = safe.targetValueSum;

    function pickWeighted(candidates) {
      let total = 0;
      const weights = candidates.map((c) => {
        const valueFit = 1 / (1 + Math.abs(c.value - (targetValue / Math.max(nonlandTarget, 1))));
        const cmcFit = 1 / (1 + Math.abs(c.cmc - targetAvg));
        const colorFit = 0.5 + colorPreference(c, selectedSet);
        const w = (valueFit * 0.5) + (cmcFit * 0.3) + (colorFit * 0.2);
        total += w;
        return w;
      });
      if (total <= 0) return candidates[Math.floor(rng() * candidates.length)];
      let hit = rng() * total;
      for (let i = 0; i < candidates.length; i += 1) {
        hit -= weights[i];
        if (hit <= 0) return candidates[i];
      }
      return candidates[candidates.length - 1];
    }

    const seedDeck = [];
    const available = legalPool.slice();
    for (let i = 0; i < nonlandTarget; i += 1) {
      if (!available.length && !allowDuplicates) break;
      const source = allowDuplicates ? legalPool : available;
      const chosen = pickWeighted(source);
      seedDeck.push(chosen.id);
      if (!allowDuplicates) {
        const idx = available.findIndex((c) => c.id === chosen.id);
        if (idx >= 0) available.splice(idx, 1);
      }
    }

    if (seedDeck.length < nonlandTarget) {
      while (seedDeck.length < nonlandTarget) {
        const chosen = legalPool[Math.floor(rng() * legalPool.length)];
        if (!chosen) break;
        seedDeck.push(chosen.id);
      }
      diagnostics.relaxed.push("fill:any");
    }

    function objective(ids) {
      const deck = { nonlandIds: ids, lands: safe.lands };
      const stats = computeDeckStats(deck, poolById);
      const valuePenalty = Math.abs(stats.sumValue - targetValue);
      const avgPenalty = Math.abs(stats.avgCmc - targetAvg) * 8;
      const curvePenalty = safe.enforceCurve
        ? CURVE_ORDER.reduce((sum, bucket) => {
          const actual = stats.nonlands ? (stats.curveHistogram[bucket] / stats.nonlands) : 0;
          const target = targetCurve[bucket] || 0;
          return sum + Math.abs(actual - target) * 40;
        }, 0)
        : 0;
      const colorPenalty = ids.reduce((sum, id) => {
        const card = poolById[id];
        if (!card) return sum + 10;
        if (safe.lockColors && !colorEligibility(card, selectedSet, true)) return sum + 30;
        return sum + (1 - colorPreference(card, selectedSet));
      }, 0);
      const duplicatePenalty = stats.duplicatesCount * 5;
      return {
        score: valuePenalty + avgPenalty + curvePenalty + colorPenalty + duplicatePenalty - stats.sumPT * 0.02,
        stats
      };
    }

    let bestIds = seedDeck.slice();
    let probe = objective(bestIds);
    let bestScore = probe.score;
    let bestStats = probe.stats;

    const iterations = safe.optimizeIterations || 800;
    diagnostics.iterations = iterations;
    for (let i = 0; i < iterations; i += 1) {
      if (!bestIds.length) break;
      const nextIds = bestIds.slice();
      const slot = Math.floor(rng() * nextIds.length);
      const candidate = legalPool[Math.floor(rng() * legalPool.length)];
      if (!candidate) continue;
      if (!allowDuplicates && nextIds.includes(candidate.id) && nextIds[slot] !== candidate.id) continue;
      nextIds[slot] = candidate.id;
      const next = objective(nextIds);
      const temperature = 1 - (i / Math.max(1, iterations));
      const accept = next.score < bestScore || rng() < 0.01 * temperature;
      if (accept) {
        bestIds = nextIds;
        bestScore = next.score;
        bestStats = next.stats;
      }
    }

    const endedAt = (typeof performance !== "undefined" ? performance.now() : Date.now());
    diagnostics.buildMs = Math.round(Math.max(0, endedAt - startedAt));
    diagnostics.status = `Pool: ${pool.length} cards (legal: ${legalPool.length}). Built in ${diagnostics.buildMs}ms. Iterations: ${iterations}. Duplicates: ${bestStats.duplicatesCount}.`;

    if (DEBUG) {
      console.debug("deckbuilder", { safe, diagnostics, bestScore, bestStats });
    }

    return {
      nonlandIds: bestIds,
      lands: safe.lands,
      settings: safe,
      diagnostics,
      stats: bestStats,
      builtAt: Date.now()
    };
  }

  function mapLandsToIds(landCount, seedInput) {
    const lands = Math.max(0, Number(landCount || 0));
    const rng = makeRng(`${seedInput || "lands"}|${lands}`);
    const out = [];
    for (let i = 0; i < lands; i += 1) {
      const idx = Math.floor(rng() * LAND_IDS.length);
      out.push(LAND_IDS[idx]);
    }
    return out;
  }

  function buildSavedDeckPayload(deck, poolById, name) {
    const nonlandIds = Array.isArray(deck?.nonlandIds)
      ? deck.nonlandIds.map(String).filter((id) => !!poolById[id])
      : [];
    const landIds = mapLandsToIds(deck?.lands || 0, `${deck?.settings?.seed || Date.now()}|${name || "deck"}`);
    const statsSnapshot = deck?.stats || computeDeckStats(deck, poolById);
    const now = Date.now();
    return {
      deckId: `dk_${now}_${Math.random().toString(16).slice(2, 8)}`,
      name: (name || "Untitled Deck").trim(),
      createdAt: now,
      updatedAt: now,
      settingsSnapshot: deck?.settings || null,
      meta: {
        colorsSelected: deck?.settings?.colorsSelected || [],
        curvePreset: deck?.settings?.curvePreset || "midrange",
        avgCmcTarget: deck?.settings?.avgCmcTarget || 2.6,
        allowDuplicates: !!deck?.settings?.allowDuplicates,
        seed: deck?.settings?.seed ?? "1337"
      },
      deck: {
        size: nonlandIds.length + landIds.length,
        lands: landIds.length,
        cards: [...nonlandIds, ...landIds].map(String)
      },
      statsSnapshot
    };
  }

  function hydrateBuiltDeckFromSaved(savedDeck, poolById) {
    const cards = Array.isArray(savedDeck?.deck?.cards) ? savedDeck.deck.cards.map((id) => String(id)) : [];
    const lands = cards.filter((id) => isLandId(id)).length;
    const nonlandIds = cards.filter((id) => !isLandId(id) && poolById[id]);
    const stats = computeDeckStats({ nonlandIds, lands }, poolById);
    return {
      nonlandIds,
      lands,
      settings: normalizeSettings(savedDeck?.settingsSnapshot || {}),
      stats,
      builtAt: Date.now()
    };
  }

  function renderMiniCardTile(cardId, cardData = {}, opts = {}) {
    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "miniCard dbMiniCard";
    tile.dataset.cardId = String(cardId || "");

    const isLand = !!opts.isLand;
    if (isLand) tile.classList.add("miniLand");

    const cost = document.createElement("div");
    cost.className = "miniCost";
    cost.textContent = isLand ? "LAND" : String(cardData?.rawCost || cardData?.cmc || "0");
    tile.appendChild(cost);

    const pt = document.createElement("div");
    pt.className = "miniPT";
    pt.textContent = isLand ? "-|-" : `${Number(cardData?.power || 0)}|${Number(cardData?.toughness || 0)}`;
    tile.appendChild(pt);

    const valueBadge = document.createElement("div");
    valueBadge.className = "miniValue";
    valueBadge.textContent = `v:${Number(toFiniteNumber(cardData?.value, 0)).toFixed(1)}`;
    tile.appendChild(valueBadge);

    const title = isLand ? "Basic Land" : (cardData?.name || `Card ${cardId}`);
    tile.title = `${title} (${cost.textContent}, ${pt.textContent})`;

    tile.onclick = () => {
      opts.onInspect?.({
        id: String(cardId),
        isLand,
        name: title,
        cost: isLand ? "LAND" : String(cardData?.rawCost || cardData?.cmc || "0"),
        power: isLand ? null : Number(cardData?.power || 0),
        toughness: isLand ? null : Number(cardData?.toughness || 0),
        value: Number(cardData?.value || 0)
      });
    };

    return tile;
  }

  function renderDeckOverview(deck, poolById, opts = {}) {
    const viewMode = ["grid", "curve", "list"].includes(opts.viewMode) ? opts.viewMode : "grid";
    const host = document.createElement("div");
    host.className = "deckOverviewWrap";

    const cards = [];
    const nonlandIds = Array.isArray(deck?.nonlandIds) ? deck.nonlandIds : [];
    nonlandIds.forEach((id, index) => {
      const data = poolById[String(id)];
      if (!data) return;
      cards.push({ key: `c_${id}_${index}`, id: String(id), data, bucket: getCurveBucket(data.cmc), isLand: false });
    });

    const lands = Math.max(0, Number(deck?.lands || 0));
    for (let i = 0; i < lands; i += 1) {
      cards.push({ key: `l_${i}`, id: LAND_IDS[i % LAND_IDS.length], data: { name: "Basic Land", rawCost: "LAND", cmc: 0, power: 0, toughness: 0, value: 0 }, bucket: "LAND", isLand: true });
    }

    if (viewMode === "list") {
      const table = document.createElement("table");
      table.className = "dbListTable";
      const head = document.createElement("tr");
      head.innerHTML = "<th>Name</th><th>Cost</th><th>PT</th><th>Value</th>";
      table.appendChild(head);
      cards.forEach((item) => {
        const row = document.createElement("tr");
        row.innerHTML = `<td>${item.data.name}</td><td>${item.isLand ? "LAND" : item.data.rawCost || item.data.cmc}</td><td>${item.isLand ? "-|-" : `${item.data.power}|${item.data.toughness}`}</td><td>${Number(item.data.value || 0).toFixed(2)}</td>`;
        row.onclick = () => opts.onInspect?.({ id: item.id, isLand: item.isLand, name: item.data.name, cost: item.data.rawCost || item.data.cmc, power: item.data.power, toughness: item.data.toughness, value: item.data.value });
        table.appendChild(row);
      });
      host.appendChild(table);
      return host;
    }

    if (viewMode === "grid") {
      const grid = document.createElement("div");
      grid.className = "deckOverviewGrid";
      cards.forEach((item) => grid.appendChild(renderMiniCardTile(item.id, item.data, { isLand: item.isLand, onInspect: opts.onInspect })));
      host.appendChild(grid);
      return host;
    }

    const sections = [{ key: "LAND", label: "Lands" }, ...CURVE_ORDER.map((k) => ({ key: k, label: `${k} mana` }))];
    sections.forEach((section) => {
      const groupCards = cards.filter((c) => c.bucket === section.key);
      const group = document.createElement("div");
      group.className = "dbCurveGroup";
      const title = document.createElement("h4");
      title.textContent = `${section.label} (${groupCards.length})`;
      const grid = document.createElement("div");
      grid.className = "deckOverviewGrid";
      groupCards.forEach((item) => grid.appendChild(renderMiniCardTile(item.id, item.data, { isLand: item.isLand, onInspect: opts.onInspect })));
      group.append(title, grid);
      host.appendChild(group);
    });

    return host;
  }

  function buildHintLines(settings, diagnostics, nonlandPoolStats) {
    const hints = [];
    const [minFeasible, maxFeasible] = diagnostics.feasibleRange || [0, 0];
    if (settings.targetValueSum < minFeasible || settings.targetValueSum > maxFeasible) {
      hints.push(`Target value is outside feasible range (${minFeasible}..${maxFeasible}).`);
    }
    if (diagnostics.warning) hints.push(diagnostics.warning);
    if (settings.avgCmcTarget >= 3.4 && settings.lands < Math.floor(settings.deckSize * 0.42)) {
      hints.push("High curve often wants more lands.");
    }
    if (nonlandPoolStats.count === 0) {
      hints.push("No nonland cards are currently available.");
    }
    return hints;
  }

  function renderDeckbuilder(rootNode, state, deps = {}) {
    const workingState = normalizeState(state);
    const cardsSource =
  deps.allCards ??
  window.CARD_REPO ??
  window.CARD_DB ??
  window.CARDS ??
  null;

const pool = getDeckbuilderCardPool(cardsSource);

    const poolById = Object.fromEntries(pool.filter((c) => c.type !== "land").map((c) => [c.id, c]));
    if (Array.isArray(deps.savedDecks)) workingState.savedDecks = deps.savedDecks;
    if (typeof deps.lastSelectedDeckId === "string") workingState.lastSelectedDeckId = deps.lastSelectedDeckId;

    const commitState = () => {
      deps.onStateChange?.(workingState);
      deps.persist?.();
    };

    const commitSavedDecks = () => {
      deps.onSavedDecksChange?.(workingState.savedDecks, workingState.lastSelectedDeckId);
      commitState();
    };

    const nonlandPool = pool.filter((c) => c.type !== "land");
    const avgValue = nonlandPool.length ? nonlandPool.reduce((sum, c) => sum + c.value, 0) / nonlandPool.length : 0;
    if (workingState.settings.targetValueSum === 0 && nonlandPool.length) {
      workingState.settings.targetValueSum = Math.round(avgValue * Math.max(0, workingState.settings.deckSize - workingState.settings.lands));
    }

    const wrap = document.createElement("div");
    wrap.className = "deckbuilderWrap dbPanel";

    const controls = document.createElement("div");
    controls.className = "menuCard dbControls";
    controls.innerHTML = "<h2>Deckbuilder v2</h2>";

    function addSectionTitle(text) {
      const el = document.createElement("div");
      el.className = "dbSectionTitle";
      el.textContent = text;
      controls.appendChild(el);
    }

    function addSlider(label, key, min, max, step = 1, onApply) {
      const row = document.createElement("label");
      row.className = "dbControl";
      const title = document.createElement("span");
      title.textContent = label;
      const inputRow = document.createElement("div");
      inputRow.className = "dbInputRow";
      const slider = document.createElement("input");
      slider.type = "range";
      slider.min = String(min);
      slider.max = String(max);
      slider.step = String(step);
      slider.value = String(workingState.settings[key]);
      const num = document.createElement("input");
      num.type = "number";
      num.min = String(min);
      num.max = String(max);
      num.step = String(step);
      num.value = String(workingState.settings[key]);
      const apply = (val) => {
        const next = clamp(toFiniteNumber(val, min), min, max);
        workingState.settings[key] = step === 1 ? Math.round(next) : Number(next.toFixed(2));
        slider.value = String(workingState.settings[key]);
        num.value = String(workingState.settings[key]);
        onApply?.(workingState.settings[key]);
        commitState();
      };
      slider.oninput = () => apply(slider.value);
      num.onchange = () => apply(num.value);
      inputRow.append(slider, num);
      row.append(title, inputRow);
      controls.appendChild(row);
      return { slider, num };
    }

    addSectionTitle("Core");
    const deckSizeControl = addSlider("Deck size X", "deckSize", 20, 100, 1, (nextDeckSize) => {
      workingState.settings.lands = clamp(workingState.settings.lands, 0, nextDeckSize);
      if (landControl) {
        landControl.slider.max = String(nextDeckSize);
        landControl.num.max = String(nextDeckSize);
        landControl.slider.value = String(workingState.settings.lands);
        landControl.num.value = String(workingState.settings.lands);
      }
    });
    const landControl = addSlider("Lands Z", "lands", 0, workingState.settings.deckSize, 1);

    const dynamicMaxY = Math.max(100, Math.round((avgValue || 10) * workingState.settings.deckSize * 1.8));
    addSlider("Target total value Y", "targetValueSum", -100, dynamicMaxY, 1);
    addSlider("Power level", "powerLevel", 0, 100, 1, (p) => {
      const curveAdjust = (p - 50) / 50;
      workingState.settings.avgCmcTarget = clamp(Number((2.6 + curveAdjust * 0.6).toFixed(2)), 1.5, 4.5);
    });

    addSectionTitle("Curve");
    addSlider("Avg CMC target", "avgCmcTarget", 1.5, 4.5, 0.1);

    const presetRow = document.createElement("div");
    presetRow.className = "dbInline";
    const presetLabel = document.createElement("span");
    presetLabel.className = "dbHint";
    presetLabel.textContent = "Curve preset";
    const presetSelect = document.createElement("select");
    ["aggro", "midrange", "control", "random"].forEach((preset) => {
      const opt = document.createElement("option");
      opt.value = preset;
      opt.textContent = preset[0].toUpperCase() + preset.slice(1);
      if (workingState.settings.curvePreset === preset) opt.selected = true;
      presetSelect.appendChild(opt);
    });
    presetSelect.onchange = () => {
      workingState.settings.curvePreset = presetSelect.value;
      commitState();
    };
    const enforceCurve = document.createElement("input");
    enforceCurve.type = "checkbox";
    enforceCurve.checked = !!workingState.settings.enforceCurve;
    enforceCurve.onchange = () => {
      workingState.settings.enforceCurve = enforceCurve.checked;
      commitState();
    };
    const enforceLabel = document.createElement("label");
    enforceLabel.className = "dbHint";
    enforceLabel.textContent = "Enforce curve";
    enforceLabel.prepend(enforceCurve);
    presetRow.append(presetLabel, presetSelect, enforceLabel);
    controls.appendChild(presetRow);

    addSectionTitle("Colors");
    const colorRow = document.createElement("div");
    colorRow.className = "dbInline";
    COLOR_ORDER.forEach((color) => {
      const btn = document.createElement("button");
      btn.className = `menuBtn dbChip ${workingState.settings.colorsSelected.includes(color) ? "active" : ""}`;
      btn.textContent = color;
      btn.onclick = () => {
        const selected = new Set(workingState.settings.colorsSelected);
        if (selected.has(color)) selected.delete(color);
        else selected.add(color);
        workingState.settings.colorsSelected = COLOR_ORDER.filter((c) => selected.has(c));
        commitState();
        deps.render?.();
      };
      colorRow.appendChild(btn);
    });
    controls.appendChild(colorRow);

    const lockColorLabel = document.createElement("label");
    lockColorLabel.className = "dbHint";
    const lockColorInput = document.createElement("input");
    lockColorInput.type = "checkbox";
    lockColorInput.checked = !!workingState.settings.lockColors;
    lockColorInput.onchange = () => {
      workingState.settings.lockColors = lockColorInput.checked;
      commitState();
    };
    lockColorLabel.append(lockColorInput, document.createTextNode("Lock colors"));
    controls.appendChild(lockColorLabel);

    addSectionTitle("Advanced");
    const seedInput = document.createElement("input");
    seedInput.className = "menuInput";
    seedInput.value = String(workingState.settings.seed ?? "1337");
    seedInput.placeholder = "Seed";
    seedInput.onchange = () => {
      workingState.settings.seed = String(seedInput.value || "1337");
      commitState();
    };
    controls.appendChild(seedInput);

    const dupLabel = document.createElement("label");
    dupLabel.className = "dbHint";
    const dupInput = document.createElement("input");
    dupInput.type = "checkbox";
    dupInput.checked = !!workingState.settings.allowDuplicates;
    dupInput.onchange = () => {
      workingState.settings.allowDuplicates = dupInput.checked;
      commitState();
    };
    dupLabel.append(dupInput, document.createTextNode("Allow duplicates"));
    controls.appendChild(dupLabel);

    const buttonRow = document.createElement("div");
    buttonRow.className = "dbInline";
    const buildBtn = document.createElement("button");
    buildBtn.className = "menuBtn";
    buildBtn.textContent = "Build Deck";
    buildBtn.onclick = () => {
      workingState.lastDeck = buildDeck(workingState.settings, deps.allCards);
      commitState();
      deps.render?.();
    };

    const rerollBtn = document.createElement("button");
    rerollBtn.className = "menuBtn";
    rerollBtn.textContent = "Reroll";
    rerollBtn.onclick = () => {
      workingState.settings.seed = `${workingState.settings.seed}_r`;
      workingState.lastDeck = buildDeck(workingState.settings, deps.allCards);
      commitState();
      deps.render?.();
    };

    const optimizeBtn = document.createElement("button");
    optimizeBtn.className = "menuBtn";
    optimizeBtn.textContent = "Optimize";
    optimizeBtn.onclick = () => {
      workingState.lastDeck = buildDeck({ ...workingState.settings, optimizeIterations: 4000 }, deps.allCards);
      commitState();
      deps.render?.();
    };

    buttonRow.append(buildBtn, rerollBtn, optimizeBtn);
    controls.appendChild(buttonRow);
    wrap.appendChild(controls);

    const out = document.createElement("div");
    out.className = "menuCard dbOutput";
    const deck = workingState.lastDeck;
    if (!pool.length) {
      out.innerHTML = '<h3>Deck Output</h3><div class="dbWarning">CARD_REPO is empty. Add cards to build decks.</div>';
      wrap.appendChild(out);
      rootNode.replaceChildren(wrap);
      return;
    }

    if (!deck) {
      out.innerHTML = `<h3>Deck Output</h3><div class="dbHint">Pool: ${pool.length} cards. Set options and click Build Deck.</div>`;
      wrap.appendChild(out);
      rootNode.replaceChildren(wrap);
      return;
    }

    const stats = deck.stats || computeDeckStats(deck, poolById);
    const diagnostics = deck.diagnostics || {};
    const hintLines = buildHintLines(workingState.settings, diagnostics, { count: nonlandPool.length });

    const chipRow = document.createElement("div");
    chipRow.className = "dbInline";
    const chips = [
      `X ${stats.totalCards}`,
      `Z ${stats.lands}`,
      `Avg CMC ${stats.avgCmc.toFixed(2)}`,
      `Value ${stats.sumValue.toFixed(1)}`,
      `Deck Quality ${stats.deckQuality.toFixed(0)}`,
      `Colors W${stats.colorCounts.W}/U${stats.colorCounts.U}/B${stats.colorCounts.B}/R${stats.colorCounts.R}/G${stats.colorCounts.G}/C${stats.colorCounts.C}`
    ];
    chips.forEach((text) => {
      const chip = document.createElement("span");
      chip.className = "dbChip";
      chip.textContent = text;
      chipRow.appendChild(chip);
    });

    const hist = document.createElement("div");
    hist.className = "dbCurveHistogram";
    CURVE_ORDER.forEach((bucket) => {
      const barWrap = document.createElement("div");
      const value = stats.curveHistogram[bucket] || 0;
      const pct = stats.nonlands ? Math.round((value / stats.nonlands) * 100) : 0;
      barWrap.innerHTML = `<div class="dbHint">${bucket}</div><div style="height:10px;background:#444;position:relative"><div style="width:${pct}%;height:100%;background:#7aa2f7"></div></div><div class="dbHint">${value}</div>`;
      hist.appendChild(barWrap);
    });

    const status = document.createElement("div");
    status.className = "dbHint";
    status.textContent = diagnostics.status || "Built.";

    const relaxed = document.createElement("div");
    relaxed.className = "dbHint";
    if (diagnostics.relaxed?.length) {
      relaxed.textContent = `Relaxed: ${diagnostics.relaxed.join(" → ")}.`;
    }

    const hintWrap = document.createElement("div");
    hintLines.forEach((line) => {
      const hint = document.createElement("div");
      hint.className = "dbWarning";
      hint.textContent = line;
      hintWrap.appendChild(hint);
    });

    const inspector = document.createElement("div");
    inspector.className = "zoneMeta";
    inspector.textContent = "Inspect: click a card to pin details.";

    const modeRow = document.createElement("div");
    modeRow.className = "dbInline";
    ["grid", "curve", "list"].forEach((mode) => {
      const b = document.createElement("button");
      b.className = "menuBtn";
      b.textContent = `${mode[0].toUpperCase()}${mode.slice(1)} view`;
      b.disabled = workingState.settings.overviewMode === mode;
      b.onclick = () => {
        workingState.settings.overviewMode = mode;
        commitState();
        deps.render?.();
      };
      modeRow.appendChild(b);
    });

    const overview = renderDeckOverview(deck, poolById, {
      viewMode: workingState.settings.overviewMode,
      onInspect: (card) => {
        inspector.textContent = `${card.name} • cost ${card.cost} • ${card.isLand ? "LAND" : `${card.power}|${card.toughness}`} • value ${Number(card.value || 0).toFixed(2)}`;
      }
    });

    const saveBtn = document.createElement("button");
    saveBtn.className = "menuBtn";
    saveBtn.textContent = "Save Deck";
    saveBtn.onclick = () => {
      const suggested = `Deck ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`;
      const name = window.prompt("Deck name", suggested);
      if (name == null) return;
      const trimmed = String(name || "").trim();
      if (!trimmed) return;
      const payload = buildSavedDeckPayload(deck, poolById, trimmed);
      workingState.savedDecks = [payload, ...(workingState.savedDecks || [])];
      workingState.lastSelectedDeckId = payload.deckId;
      commitSavedDecks();
      deps.render?.();
    };

    const savedWrap = document.createElement("div");
    savedWrap.className = "dbSavedDecks";
    const savedTitle = document.createElement("h3");
    savedTitle.textContent = "Saved Decks";
    savedWrap.appendChild(savedTitle);
    const savedDecks = Array.isArray(workingState.savedDecks) ? workingState.savedDecks : [];
    if (!savedDecks.length) {
      const empty = document.createElement("div");
      empty.className = "dbHint";
      empty.textContent = "No saved decks yet.";
      savedWrap.appendChild(empty);
    } else {
      savedDecks.forEach((saved) => {
        const row = document.createElement("div");
        row.className = "dbSavedDeckRow";
        const meta = document.createElement("div");
        meta.className = "dbHint";
        const snap = saved.statsSnapshot || {};
        meta.textContent = `${saved.name} • quality ${Number(snap.deckQuality || 0).toFixed(0)} • size ${Number(saved?.deck?.size || 0)}`;

        const loadBtn = document.createElement("button");
        loadBtn.className = "menuBtn";
        loadBtn.textContent = "Load";
        loadBtn.onclick = () => {
          workingState.lastDeck = hydrateBuiltDeckFromSaved(saved, poolById);
          workingState.lastSelectedDeckId = saved.deckId;
          commitSavedDecks();
          deps.render?.();
        };

        const renameBtn = document.createElement("button");
        renameBtn.className = "menuBtn";
        renameBtn.textContent = "Rename";
        renameBtn.onclick = () => {
          const nextName = window.prompt("Rename deck", saved.name);
          if (nextName == null) return;
          saved.name = String(nextName || "").trim() || saved.name;
          saved.updatedAt = Date.now();
          commitSavedDecks();
          deps.render?.();
        };

        const dupBtn = document.createElement("button");
        dupBtn.className = "menuBtn";
        dupBtn.textContent = "Duplicate";
        dupBtn.onclick = () => {
          const now = Date.now();
          const clone = JSON.parse(JSON.stringify(saved));
          clone.deckId = `dk_${now}_${Math.random().toString(16).slice(2, 8)}`;
          clone.name = `${saved.name} Copy`;
          clone.createdAt = now;
          clone.updatedAt = now;
          workingState.savedDecks = [clone, ...savedDecks];
          commitSavedDecks();
          deps.render?.();
        };

        const delBtn = document.createElement("button");
        delBtn.className = "menuBtn";
        delBtn.textContent = "Delete";
        delBtn.onclick = () => {
          workingState.savedDecks = savedDecks.filter((d) => d.deckId !== saved.deckId);
          if (workingState.lastSelectedDeckId === saved.deckId) workingState.lastSelectedDeckId = "";
          commitSavedDecks();
          deps.render?.();
        };

        row.append(meta, loadBtn, renameBtn, dupBtn, delBtn);
        savedWrap.appendChild(row);
      });
    }

    out.append(chipRow, hist, status);
    if (diagnostics.relaxed?.length) out.append(relaxed);
    if (deck.error) {
      const err = document.createElement("div");
      err.className = "dbWarning";
      err.textContent = deck.error;
      out.appendChild(err);
    }
    out.append(hintWrap, modeRow, overview, inspector, saveBtn, savedWrap);

    wrap.appendChild(out);
    rootNode.replaceChildren(wrap);
  }

  window.CardboardDeckbuilder = {
    DEFAULTS,
    normalizeState,
    renderDeckbuilder,
    renderDeckOverview,
    renderMiniCardTile,
    buildDeck,
    computeDeckStats,
    computeDeckScore,
    getDeckbuilderCardPool
  };
})();

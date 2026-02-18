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
    listSort: "name",
    buildMode: "guided",
    buildIntent: "balanced",
    consistencyVsExplosiveness: 50,
    autoLandCount: true,
    autoLandMix: true,
    roleTargets: {},
    multiCandidate: false,
    remixAction: "make_faster",
    colorsPolicy: "auto",
    colorLegality: "soft",
    playstyleIntent: "midrange",
    strictSingleton: false,
    minimumEarlyPlays: 0,
    maximumClunk: 99,
    avoidDuplicatesSoft: 30,
    debugDiagnostics: false
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
  const ROLE_KEYS = ["threat", "removal", "draw", "ramp", "interaction", "finisher", "utility"];
  const BUILD_INTENT_WEIGHTS = {
    balanced: { curvePenalty: 1, variancePenalty: 1, colorPenalty: 1, interactionBias: 1, landBias: 0, valueBias: 1 },
    speed: { curvePenalty: 1.4, variancePenalty: 0.7, colorPenalty: 0.9, interactionBias: 0.7, landBias: -1, valueBias: 0.9 },
    late_game: { curvePenalty: 0.8, variancePenalty: 1, colorPenalty: 1.1, interactionBias: 1.1, landBias: 2, valueBias: 1.3 },
    consistency: { curvePenalty: 1.2, variancePenalty: 1.7, colorPenalty: 1.4, interactionBias: 1, landBias: 1, valueBias: 1 },
    synergy: { curvePenalty: 0.9, variancePenalty: 1, colorPenalty: 1.1, interactionBias: 1.2, landBias: 0, valueBias: 1.1 },
    high_variance: { curvePenalty: 0.7, variancePenalty: 0.3, colorPenalty: 0.7, interactionBias: 0.9, landBias: -2, valueBias: 1.4 }
  };

  const CURVE_PRESETS = {
    aggro: { "0": 0.05, "1": 0.2, "2": 0.3, "3": 0.25, "4": 0.12, "5": 0.05, "6+": 0.03 },
    midrange: { "0": 0.05, "1": 0.12, "2": 0.23, "3": 0.25, "4": 0.2, "5": 0.1, "6+": 0.05 },
    control: { "0": 0.08, "1": 0.08, "2": 0.16, "3": 0.2, "4": 0.22, "5": 0.14, "6+": 0.12 },
    random: { "0": 0.14, "1": 0.14, "2": 0.14, "3": 0.14, "4": 0.14, "5": 0.14, "6+": 0.16 }
  };

  const LAND_IDS = [101, 102, 103, 104, 105, 106].map((id) => String(id));
  const BASIC_LAND_BY_COLOR = { W: "101", U: "102", B: "103", R: "104", G: "105", C: "106" };
  const LAND_ID_SET = new Set(LAND_IDS);

  function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }
  function toFiniteNumber(x, fallback = 0) { const n = Number(x); return Number.isFinite(n) ? n : fallback; }

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

  function isLandId(id) { return LAND_ID_SET.has(String(id)); }

  function parseManaCost(costInput) {
    const out = { cmcApprox: 0, colors: {}, pipCount: { W: 0, U: 0, B: 0, R: 0, G: 0 }, isColorless: true };
    const costStr = (costInput == null ? "" : String(costInput)).trim().toUpperCase();
    if (!costStr) return out;
    const symbols = costStr.match(/[0-9]+|[WUBRGCX]/g) || [];
    symbols.forEach((symbol) => {
      if (/^[0-9]+$/.test(symbol)) out.cmcApprox += Number(symbol);
      else if (symbol === "X") out.cmcApprox += 1;
      else if (["W", "U", "B", "R", "G"].includes(symbol)) {
        out.cmcApprox += 1; out.colors[symbol] = true; out.pipCount[symbol] += 1;
      } else if (symbol === "C") out.cmcApprox += 1;
    });
    out.cmcApprox = Math.max(0, out.cmcApprox);
    out.isColorless = Object.keys(out.colors).length === 0;
    return out;
  }

  function inferRoles(card) {
    const roles = new Set();
    const notes = [];
    const cmc = toFiniteNumber(card?.cmc, 0);
    const p = toFiniteNumber(card?.power, 0);
    const t = toFiniteNumber(card?.toughness, 0);
    const v = toFiniteNumber(card?.value, 0);
    let confidence = "low";

    if (cmc <= 2 && (p + t) >= 3) { roles.add("threat"); notes.push("efficient early body"); confidence = "med"; }
    if (cmc >= 5 && (v >= 4 || (p + t) >= 8)) { roles.add("finisher"); notes.push("late-game payoff"); confidence = "med"; }
    if (cmc >= 3 && cmc <= 5 && v >= 3.5) { roles.add("utility"); notes.push("mid-curve value spike"); }
    if (cmc <= 3 && v >= 3.8) roles.add("interaction");
    if (cmc <= 2 && v <= 2.2) roles.add("ramp");
    if (v >= 4.5) roles.add("draw");
    if (!roles.size) roles.add("threat");
    if (roles.has("finisher") && roles.has("threat")) roles.delete("threat");
    if (roles.has("interaction")) roles.add("removal");
    if (roles.size >= 3) confidence = "high";

    return { roles: [...roles], archetypes: [], notes, roleConfidence: confidence };
  }

  function normalizeCard(rawId, card) {
    if (rawId == null || rawId === "") return null;
    const id = String(rawId);
    const mana = parseManaCost(card?.cost);
    const roleData = inferRoles({
      cmc: mana.cmcApprox,
      power: card?.power,
      toughness: card?.toughness,
      value: card?.value
    });
    return {
      id,
      name: String(card?.name || `Card ${id}`),
      rawCost: card?.cost == null ? "" : String(card.cost),
      cmc: Number(mana.cmcApprox || 0),
      colors: Object.keys(mana.colors),
      pipCount: mana.pipCount,
      colorMask: COLOR_ORDER.reduce((mask, c, idx) => (mana.colors[c] ? mask | (1 << idx) : mask), 0),
      power: toFiniteNumber(card?.power, 0),
      toughness: toFiniteNumber(card?.toughness, 0),
      value: toFiniteNumber(card?.value, 0),
      type: isLandId(id) ? "land" : "spell",
      roles: roleData.roles,
      archetypes: roleData.archetypes,
      notes: roleData.notes,
      roleConfidence: roleData.roleConfidence
    };
  }

  function analyzeCardPool(allCards) {
    const entries = Array.isArray(allCards)
      ? allCards.map((c, index) => [c?.id ?? c?.cardId ?? index, c])
      : (allCards && typeof allCards === "object") ? Object.entries(allCards) : [];
    let droppedMalformed = 0;
    const pool = [];
    entries.forEach(([idRaw, card]) => {
      const normalized = normalizeCard(idRaw, card);
      if (!normalized) { droppedMalformed += 1; return; }
      pool.push(normalized);
    });
    return { pool, droppedMalformed, landCount: pool.filter((c) => c.type === "land").length };
  }

  function getDeckbuilderCardPool(allCards) { return analyzeCardPool(allCards).pool; }

  function computeDeckScore(stats) {
    const pStar = clamp(CONSTS.PSTAR_A + CONSTS.PSTAR_B * stats.avgCost, CONSTS.PSTAR_MIN, CONSTS.PSTAR_MAX);
    const consistency = Math.exp(-CONSTS.K_PENALTY * ((stats.landFraction - pStar) ** 2));
    return { pStar, consistency, deckScore: stats.baseValue * consistency };
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
    const roleCounts = Object.fromEntries(ROLE_KEYS.map((role) => [role, 0]));

    cards.forEach((c) => {
      histogram[getCurveBucket(c.cmc)] += 1;
      if (!c.colors.length) colorCounts.C += 1;
      c.colors.forEach((color) => { if (colorCounts[color] != null) colorCounts[color] += 1; });
      (c.roles || []).forEach((role) => { if (roleCounts[role] != null) roleCounts[role] += 1; });
    });

    const dupMap = {};
    ids.forEach((id) => { dupMap[id] = (dupMap[id] || 0) + 1; });
    const duplicatesCount = Object.values(dupMap).reduce((sum, n) => sum + Math.max(0, n - 1), 0);

    const scoreBits = computeDeckScore({ avgCost: avgCmc, landFraction, baseValue: avgValue });
    const quality = clamp(50 + avgValue * 4 - duplicatesCount * 1.5 - Math.abs(landFraction - 0.42) * 30 - Math.abs(avgCmc - 2.6) * 6, 0, 100);

    return { totalCards, lands, nonlands: cards.length, sumValue, avgValue, sumPT, avgCmc, avgCost: avgCmc, baseValue: avgValue, landFraction, curveHistogram: histogram, colorCounts, roleCounts, duplicatesCount, pStar: scoreBits.pStar, consistency: scoreBits.consistency, deckScore: scoreBits.deckScore, deckQuality: quality };
  }

  function getIntentWeights(intent) {
    return BUILD_INTENT_WEIGHTS[intent] || BUILD_INTENT_WEIGHTS.balanced;
  }

  function getDefaultRoleTargets(intent) {
    const presets = {
      speed: { threat: 0.42, interaction: 0.12, ramp: 0.08, finisher: 0.07, utility: 0.12, draw: 0.1, removal: 0.09 },
      late_game: { threat: 0.25, interaction: 0.15, ramp: 0.14, finisher: 0.16, utility: 0.11, draw: 0.1, removal: 0.09 },
      consistency: { threat: 0.28, interaction: 0.18, ramp: 0.1, finisher: 0.09, utility: 0.15, draw: 0.12, removal: 0.08 },
      high_variance: { threat: 0.26, interaction: 0.1, ramp: 0.08, finisher: 0.2, utility: 0.11, draw: 0.09, removal: 0.06 },
      synergy: { threat: 0.3, interaction: 0.13, ramp: 0.1, finisher: 0.11, utility: 0.16, draw: 0.1, removal: 0.1 },
      balanced: { threat: 0.3, interaction: 0.14, ramp: 0.1, finisher: 0.11, utility: 0.14, draw: 0.11, removal: 0.1 }
    };
    return { ...presets[intent || "balanced"] };
  }

  function normalizeRoleTargets(input, intent) {
    const defaults = getDefaultRoleTargets(intent);
    const out = { ...defaults };
    if (!input || typeof input !== "object") return out;
    ROLE_KEYS.forEach((role) => {
      const n = toFiniteNumber(input[role], defaults[role]);
      out[role] = clamp(n, 0, 1);
    });
    return out;
  }

  function normalizeSettings(input = {}) {
    const merged = { ...DEFAULTS, ...input };
    const deckSize = clamp(Math.round(toFiniteNumber(merged.deckSize, DEFAULTS.deckSize)), 20, 100);
    const curvePreset = CURVE_PRESETS[String(merged.curvePreset || "").toLowerCase()] ? String(merged.curvePreset).toLowerCase() : "midrange";
    const buildMode = ["quick", "guided", "advanced", "remix"].includes(merged.buildMode) ? merged.buildMode : "guided";
    const buildIntent = BUILD_INTENT_WEIGHTS[merged.buildIntent] ? merged.buildIntent : "balanced";
    const colorsSelected = Array.isArray(merged.colorsSelected)
      ? COLOR_ORDER.filter((c) => merged.colorsSelected.map(String).map((x) => x.toUpperCase()).includes(c))
      : DEFAULTS.colorsSelected.slice();

    const colorsPolicy = ["auto", "pick"].includes(merged.colorsPolicy) ? merged.colorsPolicy : (merged.lockColors ? "pick" : "auto");
    const colorLegality = ["strict", "soft"].includes(merged.colorLegality) ? merged.colorLegality : (merged.lockColors ? "strict" : "soft");
    const landsInput = clamp(Math.round(toFiniteNumber(merged.lands, DEFAULTS.lands)), 0, deckSize);

    return {
      ...merged,
      deckSize,
      lands: landsInput,
      targetValueSum: Math.round(toFiniteNumber(merged.targetValueSum, 0)),
      powerLevel: clamp(Math.round(toFiniteNumber(merged.powerLevel, 50)), 0, 100),
      avgCmcTarget: clamp(toFiniteNumber(merged.avgCmcTarget, 2.6), 1.5, 4.5),
      curvePreset,
      enforceCurve: merged.enforceCurve !== false,
      lockColors: colorLegality === "strict",
      colorsPolicy,
      colorLegality,
      allowDuplicates: !!merged.allowDuplicates,
      colorsSelected,
      seed: merged.seed == null ? "1337" : String(merged.seed),
      overviewMode: ["grid", "curve", "list"].includes(merged.overviewMode) ? merged.overviewMode : "grid",
      listSort: ["name", "value", "cmc"].includes(merged.listSort) ? merged.listSort : "name",
      buildMode,
      buildIntent,
      consistencyVsExplosiveness: clamp(Math.round(toFiniteNumber(merged.consistencyVsExplosiveness, 50)), 0, 100),
      autoLandCount: merged.autoLandCount !== false,
      autoLandMix: merged.autoLandMix !== false,
      roleTargets: normalizeRoleTargets(merged.roleTargets, buildIntent),
      multiCandidate: !!merged.multiCandidate,
      remixAction: merged.remixAction || "make_faster",
      playstyleIntent: merged.playstyleIntent || "midrange",
      strictSingleton: !!merged.strictSingleton,
      minimumEarlyPlays: clamp(Math.round(toFiniteNumber(merged.minimumEarlyPlays, 0)), 0, deckSize),
      maximumClunk: clamp(Math.round(toFiniteNumber(merged.maximumClunk, 99)), 0, deckSize),
      avoidDuplicatesSoft: clamp(Math.round(toFiniteNumber(merged.avoidDuplicatesSoft, 30)), 0, 100),
      debugDiagnostics: !!merged.debugDiagnostics
    };
  }

  function normalizeState(state) {
    return {
      settings: normalizeSettings(state?.settings || {}),
      lastDeck: state?.lastDeck || null,
      savedDecks: Array.isArray(state?.savedDecks) ? state.savedDecks : [],
      lastSelectedDeckId: state?.lastSelectedDeckId || "",
      inspectCardId: state?.inspectCardId || "",
      guidedStep: clamp(Math.round(toFiniteNumber(state?.guidedStep, 1)), 1, 6),
      explainExpanded: !!state?.explainExpanded,
      diagnosticsExpanded: !!state?.diagnosticsExpanded
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

  function deriveAutoColors(pool) {
    const scores = { W: 0, U: 0, B: 0, R: 0, G: 0 };
    pool.forEach((card) => {
      card.colors.forEach((c) => { if (scores[c] != null) scores[c] += 1 + card.value * 0.1; });
    });
    const best = Object.entries(scores).sort((a, b) => b[1] - a[1]).slice(0, 2).filter(([, score]) => score > 0).map(([c]) => c);
    return best.length ? best : ["W", "U", "B", "R", "G"];
  }

  function computeManaDemand(deck, poolById) {
    const demand = { W: 0, U: 0, B: 0, R: 0, G: 0, C: 0, totalPips: 0, totalCmc: 0, cardCount: 0 };
    const ids = Array.isArray(deck?.nonlandIds) ? deck.nonlandIds : [];
    ids.forEach((id) => {
      const card = poolById[String(id)];
      if (!card) return;
      demand.cardCount += 1;
      demand.totalCmc += card.cmc || 0;
      let pipOnCard = 0;
      ["W", "U", "B", "R", "G"].forEach((c) => {
        const pips = toFiniteNumber(card?.pipCount?.[c], 0);
        demand[c] += pips;
        pipOnCard += pips;
      });
      if (!pipOnCard) demand.C += 1;
      demand.totalPips += pipOnCard;
    });
    return demand;
  }

  function recommendLands(settings, manaDemand) {
    const diagnostics = [];
    const nonlandCount = Math.max(0, settings.deckSize - settings.lands);
    const avgCmcProxy = nonlandCount > 0 ? manaDemand.totalCmc / nonlandCount : settings.avgCmcTarget;
    let recommended = settings.lands;

    if (settings.autoLandCount) {
      const base = Math.round(settings.deckSize * (0.37 + (avgCmcProxy - 2.2) * 0.06));
      const intentBias = getIntentWeights(settings.buildIntent).landBias || 0;
      recommended = clamp(base + intentBias, Math.floor(settings.deckSize * 0.25), Math.floor(settings.deckSize * 0.55));
      diagnostics.push(`autoLandCount chose ${recommended} lands from curve demand`);
    }

    const selected = settings.colorsSelected.filter((c) => c !== "C");
    const mix = {};
    const colorsForMix = selected.length ? selected : ["W", "U", "B", "R", "G"];
    if (settings.autoLandMix) {
      const smoothing = 0.8;
      const denom = colorsForMix.reduce((sum, c) => sum + (toFiniteNumber(manaDemand[c], 0) + smoothing), 0) || colorsForMix.length;
      let assigned = 0;
      colorsForMix.forEach((c, i) => {
        const share = i === colorsForMix.length - 1
          ? recommended - assigned
          : Math.max(0, Math.round(recommended * ((toFiniteNumber(manaDemand[c], 0) + smoothing) / denom)));
        mix[c] = share;
        assigned += share;
      });
      if (assigned !== recommended) {
        mix[colorsForMix[0]] = Math.max(0, (mix[colorsForMix[0]] || 0) + (recommended - assigned));
      }
      diagnostics.push("autoLandMix allocated basics by pip demand");
    } else {
      const each = colorsForMix.length ? Math.floor(recommended / colorsForMix.length) : recommended;
      colorsForMix.forEach((c) => { mix[c] = each; });
      if (colorsForMix.length) mix[colorsForMix[0]] += recommended - each * colorsForMix.length;
    }

    return { landCount: recommended, landMix: mix, diagnostics };
  }

  function generateLandIds(landMix, seedInput, landCount) {
    const ids = [];
    Object.entries(landMix || {}).forEach(([color, count]) => {
      const landId = BASIC_LAND_BY_COLOR[color] || BASIC_LAND_BY_COLOR.C;
      for (let i = 0; i < count; i += 1) ids.push(landId);
    });
    while (ids.length < landCount) ids.push(BASIC_LAND_BY_COLOR.C);
    if (ids.length > landCount) ids.length = landCount;
    const rng = makeRng(`${seedInput}|landmix`);
    for (let i = ids.length - 1; i > 0; i -= 1) {
      const j = Math.floor(rng() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    return ids;
  }

  function rolePenalty(stats, roleTargets) {
    const nonlands = Math.max(1, stats.nonlands);
    return ROLE_KEYS.reduce((sum, role) => {
      const target = toFiniteNumber(roleTargets?.[role], 0);
      const actual = toFiniteNumber(stats.roleCounts?.[role], 0) / nonlands;
      return sum + Math.abs(actual - target) * 35;
    }, 0);
  }

  function buildDeck(settingsInput, allCards) {
    const startedAt = (typeof performance !== "undefined" ? performance.now() : Date.now());
    const safe = normalizeSettings(settingsInput);
    const cardsSource = allCards ?? window.CARD_REPO ?? window.CARD_DB ?? window.CARDS ?? null;
    const inspected = analyzeCardPool(cardsSource);
    const pool = inspected.pool.filter((c) => c.type !== "land");
    const poolById = Object.fromEntries(pool.map((c) => [c.id, c]));

    const selectedColors = safe.colorsPolicy === "auto" ? deriveAutoColors(pool) : safe.colorsSelected.filter((c) => c !== "C");
    const selectedSet = new Set(selectedColors);
    const diagnostics = { poolSize: pool.length, legalPoolSize: 0, droppedMalformed: inspected.droppedMalformed, recognizedLandIds: inspected.landCount, relaxed: [], warning: "", status: "", feasibleRange: [0, 0], iterations: 0, buildMs: 0, explain: [], mana: {} };

    if (!pool.length) {
      diagnostics.status = "Pool: 0 cards. No deck can be built.";
      return { nonlandIds: [], lands: safe.lands, landIds: [], settings: safe, diagnostics, error: "No cards available.", stats: computeDeckStats({ nonlandIds: [], lands: safe.lands }, poolById), builtAt: Date.now(), explain: ["Card pool is empty, build cannot proceed."] };
    }

    const seedTag = `${safe.seed}|${safe.deckSize}|${safe.buildMode}|${safe.buildIntent}|${safe.avgCmcTarget}|${safe.curvePreset}|${selectedColors.join("")}|${safe.colorLegality}|${safe.allowDuplicates}|${safe.consistencyVsExplosiveness}`;
    const rng = makeRng(seedTag);

    let legalPool = pool.filter((c) => colorEligibility(c, selectedSet, safe.colorLegality === "strict"));
    diagnostics.legalPoolSize = legalPool.length;

    const weight = getIntentWeights(safe.buildIntent);
    let nonlandTarget = Math.max(0, safe.deckSize - safe.lands);

    let allowDuplicates = safe.allowDuplicates || safe.strictSingleton === false;
    if (safe.strictSingleton) allowDuplicates = false;
    if (legalPool.length < nonlandTarget && !allowDuplicates) {
      allowDuplicates = true;
      diagnostics.relaxed.push("duplicates:on");
      diagnostics.warning = `Only ${legalPool.length} legal cards; duplicates enabled.`;
    }
    if (!legalPool.length && safe.colorLegality === "strict") {
      legalPool = pool.filter((c) => colorEligibility(c, selectedSet, false));
      diagnostics.relaxed.push("color:soft");
    }
    if (!legalPool.length) {
      legalPool = pool.slice();
      diagnostics.relaxed.push("pool:any");
    }

    const valueList = pool.map((c) => c.value);
    const minValue = Math.min(...valueList);
    const maxValue = Math.max(...valueList);
    diagnostics.feasibleRange = [Number((minValue * nonlandTarget).toFixed(1)), Number((maxValue * nonlandTarget).toFixed(1))];

    const targetCurve = CURVE_PRESETS[safe.curvePreset] || CURVE_PRESETS.midrange;

    function pickWeighted(candidates) {
      let total = 0;
      const weights = candidates.map((c) => {
        const valueFit = 1 / (1 + Math.abs(c.value - (safe.targetValueSum / Math.max(nonlandTarget, 1))));
        const cmcFit = 1 / (1 + Math.abs(c.cmc - safe.avgCmcTarget));
        const colorFit = 0.4 + colorPreference(c, selectedSet);
        const roleFit = (c.roles || []).reduce((sum, role) => sum + toFiniteNumber(safe.roleTargets?.[role], 0.08), 0);
        const interactionBoost = c.roles?.includes("interaction") ? weight.interactionBias : 1;
        const volatility = Math.abs(c.value - 3) * ((safe.consistencyVsExplosiveness - 50) / 50);
        const w = (valueFit * 0.4 * weight.valueBias) + (cmcFit * 0.25 * weight.curvePenalty) + (colorFit * 0.2) + (roleFit * 0.1) + (interactionBoost * 0.05) + volatility * 0.02;
        total += Math.max(0.0001, w);
        return Math.max(0.0001, w);
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
      if (!chosen) break;
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
      const landAdviceFirst = recommendLands(safe, computeManaDemand({ nonlandIds: ids }, poolById));
      const deck = { nonlandIds: ids, lands: safe.autoLandCount ? landAdviceFirst.landCount : safe.lands };
      const stats = computeDeckStats(deck, poolById);
      const valuePenalty = Math.abs(stats.sumValue - safe.targetValueSum);
      const avgPenalty = Math.abs(stats.avgCmc - safe.avgCmcTarget) * 8 * weight.curvePenalty;
      const curvePenalty = safe.enforceCurve
        ? CURVE_ORDER.reduce((sum, bucket) => {
          const actual = stats.nonlands ? (stats.curveHistogram[bucket] / stats.nonlands) : 0;
          const target = targetCurve[bucket] || 0;
          return sum + Math.abs(actual - target) * 40 * weight.curvePenalty;
        }, 0)
        : 0;
      const colorPenalty = ids.reduce((sum, id) => {
        const card = poolById[id];
        if (!card) return sum + 10;
        if (safe.colorLegality === "strict" && !colorEligibility(card, selectedSet, true)) return sum + 30 * weight.colorPenalty;
        return sum + (1 - colorPreference(card, selectedSet)) * weight.colorPenalty;
      }, 0);
      const duplicatePenalty = stats.duplicatesCount * (safe.allowDuplicates ? (safe.avoidDuplicatesSoft / 25) : 6);
      const clunkCount = (stats.curveHistogram["5"] || 0) + (stats.curveHistogram["6+"] || 0);
      const clunkPenalty = Math.max(0, clunkCount - safe.maximumClunk) * 6;
      const earlyPenalty = Math.max(0, safe.minimumEarlyPlays - ((stats.curveHistogram["0"] || 0) + (stats.curveHistogram["1"] || 0) + (stats.curveHistogram["2"] || 0))) * 7;
      const roleTargetPenalty = rolePenalty(stats, safe.roleTargets);
      const varianceProxy = Math.abs(stats.avgValue - 3.2) * 10;
      const variancePenalty = varianceProxy * (safe.consistencyVsExplosiveness / 100) * weight.variancePenalty;
      return {
        score: valuePenalty + avgPenalty + curvePenalty + colorPenalty + duplicatePenalty + clunkPenalty + earlyPenalty + roleTargetPenalty + variancePenalty - stats.sumPT * 0.02,
        stats,
        landAdvice: landAdviceFirst
      };
    }

    let bestIds = seedDeck.slice();
    let probe = objective(bestIds);
    let bestScore = probe.score;
    let bestStats = probe.stats;
    let bestLandAdvice = probe.landAdvice;

    const iterations = Math.max(180, Math.min(2600, Math.round((safe.optimizeIterations || 600) + safe.deckSize * 14)));
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
        bestLandAdvice = next.landAdvice;
      }
    }

    const manaDemand = computeManaDemand({ nonlandIds: bestIds }, poolById);
    const landAdvice = recommendLands(safe, manaDemand);
    const finalLands = safe.autoLandCount ? landAdvice.landCount : safe.lands;
    const landIds = generateLandIds(safe.autoLandMix ? landAdvice.landMix : {}, seedTag, finalLands);
    nonlandTarget = Math.max(0, safe.deckSize - finalLands);
    if (bestIds.length > nonlandTarget) bestIds = bestIds.slice(0, nonlandTarget);
    if (bestIds.length < nonlandTarget) diagnostics.relaxed.push("nonlandTarget:reduced");

    bestStats = computeDeckStats({ nonlandIds: bestIds, lands: finalLands }, poolById);
    const endedAt = (typeof performance !== "undefined" ? performance.now() : Date.now());
    diagnostics.buildMs = Math.round(Math.max(0, endedAt - startedAt));
    diagnostics.mana = { demand: manaDemand, recommendation: landAdvice };
    diagnostics.status = `Pool ${pool.length} (legal ${legalPool.length}) • ${diagnostics.buildMs}ms • ${iterations} iters`;
    diagnostics.explain = [
      `Asked: ${safe.deckSize} cards, ${safe.colorsPolicy === "auto" ? "auto colors" : `${safe.colorLegality} ${selectedColors.join("/") || "any"}`}, intent ${safe.buildIntent}.`,
      `Builder: ${finalLands} lands (${safe.autoLandCount ? "auto" : "manual"}), curve ${safe.curvePreset}, role-guided weighting enabled.`,
      `Tradeoff: consistency ${safe.consistencyVsExplosiveness}/100 vs explosiveness ${100 - safe.consistencyVsExplosiveness}/100.`
    ];
    if (diagnostics.relaxed.length) diagnostics.explain.push(`Relaxations applied: ${diagnostics.relaxed.join(" → ")}.`);

    return { nonlandIds: bestIds, lands: finalLands, landIds, settings: safe, diagnostics, stats: bestStats, builtAt: Date.now(), explain: diagnostics.explain, manaDemand, landMix: landAdvice.landMix, _landAdvice: bestLandAdvice };
  }

  function generateCandidates(settingsInput, k = 3, allCards) {
    const safe = normalizeSettings(settingsInput);
    const variants = [
      { name: "Most consistent", patch: { buildIntent: "consistency", consistencyVsExplosiveness: 80 } },
      { name: "Highest ceiling", patch: { buildIntent: "high_variance", consistencyVsExplosiveness: 15 } },
      { name: "Smoothest curve", patch: { buildIntent: "balanced", avgCmcTarget: Math.min(3, safe.avgCmcTarget), curvePreset: "midrange" } }
    ].slice(0, Math.max(1, k));

    return variants.map((variant, i) => {
      const built = buildDeck({ ...safe, ...variant.patch, seed: `${safe.seed}|candidate|${i}` }, allCards);
      return { id: `cand_${i}`, label: variant.name, deck: built, chips: [`Q ${built.stats.deckQuality.toFixed(0)}`, `CMC ${built.stats.avgCmc.toFixed(2)}`, `Lands ${built.lands}`] };
    });
  }

  function remixDeck(baseDeck, settingsInput, allCards, opts = {}) {
    const safe = normalizeSettings(settingsInput);
    const action = opts.action || safe.remixAction || "make_faster";
    const deterministic = opts.deterministic !== false;
    const stamp = deterministic ? "det" : String(Date.now());
    const seed = `${safe.seed}|remix|${action}|${stamp}`;
    const patch = {
      make_faster: { avgCmcTarget: Math.max(1.6, safe.avgCmcTarget - 0.4), buildIntent: "speed" },
      make_consistent: { buildIntent: "consistency", consistencyVsExplosiveness: Math.min(100, safe.consistencyVsExplosiveness + 20) },
      increase_interaction: { roleTargets: { ...safe.roleTargets, interaction: Math.min(0.4, safe.roleTargets.interaction + 0.08), removal: Math.min(0.3, safe.roleTargets.removal + 0.05) } },
      lower_curve: { avgCmcTarget: Math.max(1.5, safe.avgCmcTarget - 0.4), curvePreset: "aggro" },
      increase_threats: { roleTargets: { ...safe.roleTargets, threat: Math.min(0.6, safe.roleTargets.threat + 0.12) } },
      reduce_duplicates: { allowDuplicates: false, avoidDuplicatesSoft: 100 },
      fix_mana: { autoLandCount: true, autoLandMix: true, colorLegality: "soft" }
    };

    const remixed = buildDeck({ ...safe, ...(patch[action] || {}), seed }, allCards);
    const before = baseDeck?.stats || { avgCmc: 0, deckQuality: 0, duplicatesCount: 0 };
    const after = remixed.stats || { avgCmc: 0, deckQuality: 0, duplicatesCount: 0 };
    remixed.remixDiff = {
      action,
      deterministic,
      changedCards: Math.max(0, (baseDeck?.nonlandIds || []).filter((id, i) => remixed.nonlandIds[i] !== id).length),
      avgCmcDelta: Number((after.avgCmc - before.avgCmc).toFixed(2)),
      qualityDelta: Number((after.deckQuality - before.deckQuality).toFixed(2)),
      duplicatesDelta: Number((after.duplicatesCount - before.duplicatesCount).toFixed(0))
    };
    remixed.explain = [...(remixed.explain || []), `Remix action: ${action.replace(/_/g, " ")} (${deterministic ? "deterministic" : "fresh"}).`];
    return remixed;
  }

  function mapLandsToIds(deck) {
    if (Array.isArray(deck?.landIds) && deck.landIds.length) return deck.landIds.map(String);
    const lands = Math.max(0, Number(deck?.lands || 0));
    const rng = makeRng(`${deck?.settings?.seed || "lands"}|${lands}`);
    const out = [];
    for (let i = 0; i < lands; i += 1) out.push(LAND_IDS[Math.floor(rng() * LAND_IDS.length)]);
    return out;
  }

  function buildSavedDeckPayload(deck, poolById, name) {
    const nonlandIds = Array.isArray(deck?.nonlandIds) ? deck.nonlandIds.map(String).filter((id) => !!poolById[id]) : [];
    const landIds = mapLandsToIds(deck);
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
      deck: { size: nonlandIds.length + landIds.length, lands: landIds.length, cards: [...nonlandIds, ...landIds].map(String) },
      statsSnapshot
    };
  }

  function hydrateBuiltDeckFromSaved(savedDeck, poolById) {
    const cards = Array.isArray(savedDeck?.deck?.cards) ? savedDeck.deck.cards.map((id) => String(id)) : [];
    const lands = cards.filter((id) => isLandId(id)).length;
    const nonlandIds = cards.filter((id) => !isLandId(id) && poolById[id]);
    const settings = normalizeSettings(savedDeck?.settingsSnapshot || {});
    const stats = computeDeckStats({ nonlandIds, lands }, poolById);
    return { nonlandIds, lands, landIds: cards.filter((id) => isLandId(id)), settings, stats, builtAt: Date.now(), explain: ["Loaded from saved deck."] };
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
    const pt = document.createElement("div");
    pt.className = "miniPT";
    pt.textContent = isLand ? "-|-" : `${Number(cardData?.power || 0)}|${Number(cardData?.toughness || 0)}`;
    const valueBadge = document.createElement("div");
    valueBadge.className = "miniValue";
    valueBadge.textContent = `v:${Number(toFiniteNumber(cardData?.value, 0)).toFixed(1)}`;
    tile.append(cost, pt, valueBadge);
    const title = isLand ? "Basic Land" : (cardData?.name || `Card ${cardId}`);
    tile.title = `${title} (${cost.textContent}, ${pt.textContent})`;
    tile.onclick = () => {
      opts.onInspect?.({ id: String(cardId), isLand, name: title, cost: isLand ? "LAND" : String(cardData?.rawCost || cardData?.cmc || "0"), power: isLand ? null : Number(cardData?.power || 0), toughness: isLand ? null : Number(cardData?.toughness || 0), value: Number(cardData?.value || 0), roles: cardData?.roles || [], roleConfidence: cardData?.roleConfidence || "low" });
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
    const landIds = Array.isArray(deck?.landIds) && deck.landIds.length ? deck.landIds : mapLandsToIds(deck);
    landIds.forEach((landId, i) => cards.push({ key: `l_${i}`, id: landId, data: { name: "Basic Land", rawCost: "LAND", cmc: 0, power: 0, toughness: 0, value: 0 }, bucket: "LAND", isLand: true }));

    if (viewMode === "list") {
      const table = document.createElement("table");
      table.className = "dbListTable";
      table.innerHTML = "<tr><th>Name</th><th>Cost</th><th>PT</th><th>Value</th><th>Roles</th></tr>";
      cards.forEach((item) => {
        const row = document.createElement("tr");
        row.innerHTML = `<td>${item.data.name}</td><td>${item.isLand ? "LAND" : item.data.rawCost || item.data.cmc}</td><td>${item.isLand ? "-|-" : `${item.data.power}|${item.data.toughness}`}</td><td>${Number(item.data.value || 0).toFixed(2)}</td><td>${(item.data.roles || []).join(", ")}</td>`;
        row.onclick = () => opts.onInspect?.({ id: item.id, isLand: item.isLand, name: item.data.name, cost: item.data.rawCost || item.data.cmc, power: item.data.power, toughness: item.data.toughness, value: item.data.value, roles: item.data.roles || [] });
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
    if (settings.targetValueSum < minFeasible || settings.targetValueSum > maxFeasible) hints.push(`Target value is outside feasible range (${minFeasible}..${maxFeasible}).`);
    if (diagnostics.warning) hints.push(diagnostics.warning);
    if (settings.avgCmcTarget >= 3.4 && settings.lands < Math.floor(settings.deckSize * 0.42)) hints.push("High curve often wants more lands.");
    if (nonlandPoolStats.count === 0) hints.push("No nonland cards are currently available.");
    return hints;
  }

  function makeInputRow(labelText, inputEl) {
    const row = document.createElement("label");
    row.className = "dbInputRow";
    const span = document.createElement("span");
    span.textContent = labelText;
    row.append(span, inputEl);
    return row;
  }

  function renderDeckbuilder(rootNode, state, deps = {}) {
    const workingState = normalizeState(state);
    const cardsSource = deps.allCards ?? window.CARD_REPO ?? window.CARD_DB ?? window.CARDS ?? null;
    const pool = getDeckbuilderCardPool(cardsSource);
    const poolById = Object.fromEntries(pool.filter((c) => c.type !== "land").map((c) => [c.id, c]));

    if (Array.isArray(deps.savedDecks)) workingState.savedDecks = deps.savedDecks;
    if (typeof deps.lastSelectedDeckId === "string") workingState.lastSelectedDeckId = deps.lastSelectedDeckId;

    const commitState = () => { deps.onStateChange?.(workingState); deps.persist?.(); };
    const commitSavedDecks = () => { deps.onSavedDecksChange?.(workingState.savedDecks, workingState.lastSelectedDeckId); commitState(); };

    const wrap = document.createElement("div");
    wrap.className = "deckbuilderWrap";
    const controls = document.createElement("div");
    controls.className = "menuCard dbControl";

    const title = document.createElement("h3");
    title.textContent = "Deckbuilder";
    controls.appendChild(title);

    const modeRow = document.createElement("div");
    modeRow.className = "dbSegmented";
    const modeOptions = [
      ["quick", "Quick Build"],
      ["guided", "Guided Build"],
      ["advanced", "Advanced Build"],
      ["remix", "Smart Remix"]
    ];
    modeOptions.forEach(([mode, label]) => {
      const btn = document.createElement("button");
      btn.className = "menuBtn";
      btn.textContent = label;
      btn.dataset.active = String(workingState.settings.buildMode === mode);
      btn.onclick = () => {
        workingState.settings.buildMode = mode;
        workingState.guidedStep = 1;
        commitState();
        deps.render?.();
      };
      modeRow.appendChild(btn);
    });
    controls.appendChild(modeRow);

    const guidedSteps = [
      "Deck Size",
      "Build Mode",
      "Colors",
      "Playstyle",
      "Goals",
      "Format"
    ];

    const addGuidedMandatory = () => {
      const step = workingState.guidedStep;
      const badge = document.createElement("div");
      badge.className = "dbHint";
      badge.textContent = `Step ${step}/${guidedSteps.length}: ${guidedSteps[step - 1]}`;
      controls.appendChild(badge);

      if (step === 1) {
        const presets = document.createElement("div");
        presets.className = "dbInline";
        [40, 60, 100].forEach((n) => {
          const b = document.createElement("button");
          b.className = "menuBtn";
          b.textContent = String(n);
          b.onclick = () => { workingState.settings.deckSize = n; commitState(); deps.render?.(); };
          presets.appendChild(b);
        });
        const custom = document.createElement("input");
        custom.type = "number";
        custom.min = "20"; custom.max = "100"; custom.value = String(workingState.settings.deckSize);
        custom.onchange = () => { workingState.settings.deckSize = clamp(Number(custom.value), 20, 100); commitState(); };
        controls.append(makeInputRow("Common presets", presets), makeInputRow("Custom size", custom));
      }

      if (step === 2) {
        const text = document.createElement("div");
        text.className = "dbHint";
        text.textContent = "Choose exactly one mode for this build.";
        controls.appendChild(text);
        controls.appendChild(modeRow.cloneNode(true));
      }

      if (step === 3) {
        const policySel = document.createElement("select");
        policySel.className = "menuInput";
        ["auto", "pick"].forEach((v) => {
          const o = document.createElement("option"); o.value = v; o.textContent = v === "auto" ? "Auto colors" : "Pick colors"; o.selected = workingState.settings.colorsPolicy === v; policySel.appendChild(o);
        });
        policySel.onchange = () => { workingState.settings.colorsPolicy = policySel.value; commitState(); deps.render?.(); };
        controls.appendChild(makeInputRow("Colors policy", policySel));

        if (workingState.settings.colorsPolicy === "pick") {
          const chips = document.createElement("div");
          chips.className = "dbInline";
          COLOR_ORDER.forEach((c) => {
            const b = document.createElement("button");
            b.className = "menuBtn";
            b.textContent = c;
            b.dataset.active = String(workingState.settings.colorsSelected.includes(c));
            b.onclick = () => {
              const set = new Set(workingState.settings.colorsSelected);
              if (set.has(c)) set.delete(c); else set.add(c);
              workingState.settings.colorsSelected = [...set];
              commitState();
              deps.render?.();
            };
            chips.appendChild(b);
          });
          controls.appendChild(chips);

          const legal = document.createElement("select");
          legal.className = "menuInput";
          ["strict", "soft"].forEach((v) => {
            const o = document.createElement("option"); o.value = v; o.textContent = v === "strict" ? "Strict legality" : "Soft preference"; o.selected = workingState.settings.colorLegality === v; legal.appendChild(o);
          });
          legal.onchange = () => { workingState.settings.colorLegality = legal.value; workingState.settings.lockColors = legal.value === "strict"; commitState(); };
          controls.appendChild(makeInputRow("Color enforcement", legal));
        }
      }

      if (step >= 4) {
        const details = document.createElement("details");
        details.open = step === 4;
        details.className = "dbCollapse";
        details.innerHTML = "<summary>Optional Layer A • Simple knobs</summary>";
        const intentSel = document.createElement("select");
        intentSel.className = "menuInput";
        ["balanced", "speed", "late_game", "consistency", "synergy", "high_variance"].forEach((intent) => {
          const o = document.createElement("option"); o.value = intent; o.textContent = intent.replace(/_/g, " "); o.selected = workingState.settings.buildIntent === intent; intentSel.appendChild(o);
        });
        intentSel.onchange = () => { workingState.settings.buildIntent = intentSel.value; workingState.settings.roleTargets = normalizeRoleTargets(workingState.settings.roleTargets, intentSel.value); commitState(); };

        const powerSel = document.createElement("select");
        powerSel.className = "menuInput";
        [[35, "Casual"], [60, "Tuned"], [85, "Max"]].forEach(([v, label]) => {
          const o = document.createElement("option"); o.value = String(v); o.textContent = label; o.selected = Number(workingState.settings.powerLevel) === Number(v); powerSel.appendChild(o);
        });
        powerSel.onchange = () => { workingState.settings.powerLevel = Number(powerSel.value); commitState(); };

        const cx = document.createElement("input");
        cx.type = "range"; cx.min = "0"; cx.max = "100"; cx.value = String(workingState.settings.consistencyVsExplosiveness);
        cx.oninput = () => { workingState.settings.consistencyVsExplosiveness = Number(cx.value); commitState(); };

        const curveSel = document.createElement("select");
        curveSel.className = "menuInput";
        [["aggro", "Low curve"], ["midrange", "Balanced"], ["control", "High curve"]].forEach(([v, label]) => {
          const o = document.createElement("option"); o.value = v; o.textContent = label; o.selected = workingState.settings.curvePreset === v; curveSel.appendChild(o);
        });
        curveSel.onchange = () => { workingState.settings.curvePreset = curveSel.value; commitState(); };

        const dup = document.createElement("input"); dup.type = "checkbox"; dup.checked = !!workingState.settings.allowDuplicates;
        dup.onchange = () => { workingState.settings.allowDuplicates = dup.checked; commitState(); };

        details.append(
          makeInputRow("Build intent", intentSel),
          makeInputRow("Power level", powerSel),
          makeInputRow("Consistency ↔ Explosive", cx),
          makeInputRow("Curve focus", curveSel),
          makeInputRow("Allow duplicates", dup)
        );
        controls.appendChild(details);
      }

      if (step >= 5) {
        const details = document.createElement("details");
        details.className = "dbCollapse";
        details.innerHTML = "<summary>Optional Layer B • Role goals / quotas</summary>";
        ROLE_KEYS.forEach((role) => {
          const slider = document.createElement("input");
          slider.type = "range"; slider.min = "0"; slider.max = "100"; slider.value = String(Math.round((workingState.settings.roleTargets[role] || 0) * 100));
          slider.oninput = () => { workingState.settings.roleTargets[role] = Number(slider.value) / 100; commitState(); };
          details.appendChild(makeInputRow(role, slider));
        });
        const early = document.createElement("input"); early.type = "number"; early.min = "0"; early.max = String(workingState.settings.deckSize); early.value = String(workingState.settings.minimumEarlyPlays || 0);
        early.onchange = () => { workingState.settings.minimumEarlyPlays = clamp(Number(early.value || 0), 0, workingState.settings.deckSize); commitState(); };
        const clunk = document.createElement("input"); clunk.type = "number"; clunk.min = "0"; clunk.max = String(workingState.settings.deckSize); clunk.value = String(workingState.settings.maximumClunk || 99);
        clunk.onchange = () => { workingState.settings.maximumClunk = clamp(Number(clunk.value || 0), 0, workingState.settings.deckSize); commitState(); };
        details.append(makeInputRow("Minimum early plays (≤2)", early), makeInputRow("Maximum clunk (≥5)", clunk));
        controls.appendChild(details);
      }

      if (step >= 6) {
        const details = document.createElement("details");
        details.className = "dbCollapse";
        details.innerHTML = "<summary>Optional Layer C • Format / collection</summary>";
        const singleton = document.createElement("input"); singleton.type = "checkbox"; singleton.checked = !!workingState.settings.strictSingleton;
        singleton.onchange = () => { workingState.settings.strictSingleton = singleton.checked; if (singleton.checked) workingState.settings.allowDuplicates = false; commitState(); };
        const creaturesOnly = document.createElement("input"); creaturesOnly.type = "checkbox"; creaturesOnly.checked = !!workingState.settings.creaturesPlusLandsOnly;
        creaturesOnly.onchange = () => { workingState.settings.creaturesPlusLandsOnly = creaturesOnly.checked; commitState(); };
        details.append(
          makeInputRow("Singleton mode", singleton),
          makeInputRow("Only creatures + lands (placeholder)", creaturesOnly),
          (() => { const n = document.createElement("div"); n.className = "dbHint"; n.textContent = "Set/budget filters hidden until metadata exists."; return n; })()
        );
        controls.appendChild(details);
      }

      const nav = document.createElement("div");
      nav.className = "dbInline";
      const back = document.createElement("button"); back.className = "menuBtn"; back.textContent = "Back"; back.disabled = step <= 1;
      back.onclick = () => { workingState.guidedStep = Math.max(1, workingState.guidedStep - 1); commitState(); deps.render?.(); };
      const next = document.createElement("button"); next.className = "menuBtn"; next.textContent = step >= guidedSteps.length ? "Done" : "Next";
      next.onclick = () => { workingState.guidedStep = Math.min(guidedSteps.length, workingState.guidedStep + 1); commitState(); deps.render?.(); };
      nav.append(back, next);
      controls.appendChild(nav);
    };

    if (workingState.settings.buildMode === "guided") {
      addGuidedMandatory();
    } else if (workingState.settings.buildMode === "quick") {
      const note = document.createElement("div");
      note.className = "dbHint";
      note.textContent = "Quick mode uses mandatory settings only. Optional knobs are hidden.";
      controls.appendChild(note);
    } else if (workingState.settings.buildMode === "advanced" || workingState.settings.buildMode === "remix") {
      [
        ["Core", [
          ["Deck size", (() => { const n = document.createElement("input"); n.type = "number"; n.min = "20"; n.max = "100"; n.value = String(workingState.settings.deckSize); n.onchange = () => { workingState.settings.deckSize = clamp(Number(n.value), 20, 100); commitState(); }; return n; })()],
          ["Seed", (() => { const n = document.createElement("input"); n.className = "menuInput"; n.value = workingState.settings.seed; n.onchange = () => { workingState.settings.seed = n.value || "1337"; commitState(); }; return n; })()]
        ]],
        ["Colors", [
          ["Use auto colors", (() => { const n = document.createElement("input"); n.type = "checkbox"; n.checked = workingState.settings.colorsPolicy === "auto"; n.onchange = () => { workingState.settings.colorsPolicy = n.checked ? "auto" : "pick"; commitState(); deps.render?.(); }; return n; })()],
          ["Strict legality", (() => { const n = document.createElement("input"); n.type = "checkbox"; n.checked = workingState.settings.colorLegality === "strict"; n.onchange = () => { workingState.settings.colorLegality = n.checked ? "strict" : "soft"; commitState(); }; return n; })()]
        ]],
        ["Curve", [
          ["Average CMC target", (() => { const n = document.createElement("input"); n.type = "number"; n.step = "0.1"; n.min = "1.5"; n.max = "4.5"; n.value = String(workingState.settings.avgCmcTarget); n.onchange = () => { workingState.settings.avgCmcTarget = clamp(Number(n.value), 1.5, 4.5); commitState(); }; return n; })()],
          ["Curve preset", (() => { const n = document.createElement("select"); n.className = "menuInput"; ["aggro", "midrange", "control", "random"].forEach((v) => { const o = document.createElement("option"); o.value = v; o.textContent = v; o.selected = workingState.settings.curvePreset === v; n.appendChild(o); }); n.onchange = () => { workingState.settings.curvePreset = n.value; commitState(); }; return n; })()]
        ]],
        ["Roles", ROLE_KEYS.map((role) => [role, (() => { const n = document.createElement("input"); n.type = "range"; n.min = "0"; n.max = "100"; n.value = String(Math.round((workingState.settings.roleTargets[role] || 0) * 100)); n.oninput = () => { workingState.settings.roleTargets[role] = Number(n.value) / 100; commitState(); }; return n; })()])],
        ["Mana", [
          ["Auto land count", (() => { const n = document.createElement("input"); n.type = "checkbox"; n.checked = !!workingState.settings.autoLandCount; n.onchange = () => { workingState.settings.autoLandCount = n.checked; commitState(); }; return n; })()],
          ["Auto land mix", (() => { const n = document.createElement("input"); n.type = "checkbox"; n.checked = !!workingState.settings.autoLandMix; n.onchange = () => { workingState.settings.autoLandMix = n.checked; commitState(); }; return n; })()]
        ]],
        ["Diagnostics", [
          ["Debug diagnostics", (() => { const n = document.createElement("input"); n.type = "checkbox"; n.checked = !!workingState.settings.debugDiagnostics; n.onchange = () => { workingState.settings.debugDiagnostics = n.checked; commitState(); }; return n; })()],
          ["Multi-candidate output", (() => { const n = document.createElement("input"); n.type = "checkbox"; n.checked = !!workingState.settings.multiCandidate; n.onchange = () => { workingState.settings.multiCandidate = n.checked; commitState(); }; return n; })()]
        ]]
      ].forEach(([sectionTitle, rows]) => {
        const details = document.createElement("details");
        details.className = "dbCollapse";
        details.open = sectionTitle === "Core";
        const sum = document.createElement("summary"); sum.textContent = sectionTitle;
        details.appendChild(sum);
        rows.forEach(([label, control]) => details.appendChild(makeInputRow(label, control)));
        controls.appendChild(details);
      });
    }

    const buttonRow = document.createElement("div");
    buttonRow.className = "dbStickyCTA";
    const buildBtn = document.createElement("button");
    buildBtn.className = "menuBtn";
    buildBtn.textContent = "Build Deck";

    const runBuild = () => {
      buildBtn.disabled = true;
      buildBtn.textContent = "Optimizing…";
      setTimeout(() => {
        workingState.lastDeck = buildDeck(workingState.settings, deps.allCards);
        if (workingState.settings.multiCandidate) {
          workingState.lastCandidates = generateCandidates(workingState.settings, 3, deps.allCards);
        } else {
          workingState.lastCandidates = [];
        }
        commitState();
        buildBtn.disabled = false;
        buildBtn.textContent = "Build Deck";
        deps.render?.();
      }, 20);
    };
    buildBtn.onclick = runBuild;

    const rerollBtn = document.createElement("button");
    rerollBtn.className = "menuBtn";
    rerollBtn.textContent = "Reroll";
    rerollBtn.onclick = () => { workingState.settings.seed = `${workingState.settings.seed}_r`; runBuild(); };

    const optimizeBtn = document.createElement("button");
    optimizeBtn.className = "menuBtn";
    optimizeBtn.textContent = "Optimize";
    optimizeBtn.onclick = () => {
      workingState.lastDeck = buildDeck({ ...workingState.settings, optimizeIterations: 3500 }, deps.allCards);
      commitState();
      deps.render?.();
    };

    buttonRow.append(buildBtn, rerollBtn, optimizeBtn);
    controls.appendChild(buttonRow);

    if (workingState.settings.buildMode === "remix") {
      const remixWrap = document.createElement("div");
      remixWrap.className = "dbRemixBox";
      const remixSel = document.createElement("select");
      remixSel.className = "menuInput";
      [
        ["make_faster", "Make faster"],
        ["make_consistent", "Make more consistent"],
        ["increase_interaction", "Increase interaction"],
        ["lower_curve", "Lower curve by 0.4"],
        ["increase_threats", "Increase threats"],
        ["reduce_duplicates", "Reduce duplicates"],
        ["fix_mana", "Fix mana"]
      ].forEach(([v, text]) => { const o = document.createElement("option"); o.value = v; o.textContent = text; o.selected = workingState.settings.remixAction === v; remixSel.appendChild(o); });
      remixSel.onchange = () => { workingState.settings.remixAction = remixSel.value; commitState(); };

      const detBtn = document.createElement("button");
      detBtn.className = "menuBtn";
      detBtn.textContent = "Deterministic Remix";
      detBtn.onclick = () => {
        if (!workingState.lastDeck) return;
        workingState.lastDeck = remixDeck(workingState.lastDeck, workingState.settings, deps.allCards, { action: workingState.settings.remixAction, deterministic: true });
        commitState();
        deps.render?.();
      };
      const freshBtn = document.createElement("button");
      freshBtn.className = "menuBtn";
      freshBtn.textContent = "Fresh Remix";
      freshBtn.onclick = () => {
        if (!workingState.lastDeck) return;
        workingState.lastDeck = remixDeck(workingState.lastDeck, workingState.settings, deps.allCards, { action: workingState.settings.remixAction, deterministic: false });
        commitState();
        deps.render?.();
      };
      remixWrap.append(makeInputRow("Remix action", remixSel), detBtn, freshBtn);
      controls.appendChild(remixWrap);
    }

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
      out.innerHTML = `<h3>Deck Output</h3><div class="dbHint">Pool: ${pool.length} cards. Complete mandatory steps and click Build Deck.</div>`;
      wrap.appendChild(out);
      rootNode.replaceChildren(wrap);
      return;
    }

    const stats = deck.stats || computeDeckStats(deck, poolById);
    const diagnostics = deck.diagnostics || {};
    const hintLines = buildHintLines(workingState.settings, diagnostics, { count: pool.length });

    const chipRow = document.createElement("div");
    chipRow.className = "dbInline";
    [
      `Size ${stats.totalCards}`,
      `Lands ${stats.lands}`,
      `Avg CMC ${stats.avgCmc.toFixed(2)}`,
      `Value ${stats.sumValue.toFixed(1)}`,
      `Quality ${stats.deckQuality.toFixed(0)}`,
      `Intent ${workingState.settings.buildIntent}`
    ].forEach((text) => { const chip = document.createElement("span"); chip.className = "dbChip"; chip.textContent = text; chipRow.appendChild(chip); });

    const hist = document.createElement("div");
    hist.className = "dbCurveHistogram";
    CURVE_ORDER.forEach((bucket) => {
      const barWrap = document.createElement("div");
      const value = stats.curveHistogram[bucket] || 0;
      const pct = stats.nonlands ? Math.round((value / stats.nonlands) * 100) : 0;
      barWrap.innerHTML = `<div class="dbHint">${bucket}</div><div style="height:10px;background:#444;position:relative"><div style="width:${pct}%;height:100%;background:#7aa2f7"></div></div><div class="dbHint">${value}</div>`;
      hist.appendChild(barWrap);
    });

    const explain = document.createElement("details");
    explain.className = "dbExplain";
    explain.open = !!workingState.explainExpanded;
    explain.ontoggle = () => { workingState.explainExpanded = explain.open; commitState(); };
    explain.innerHTML = "<summary>Explain details</summary>";
    const explainList = document.createElement("ul");
    (deck.explain || diagnostics.explain || []).forEach((line) => { const li = document.createElement("li"); li.textContent = line; explainList.appendChild(li); });

    const fixRow = document.createElement("div");
    fixRow.className = "dbInline";
    [
      ["Increase lands", () => { workingState.settings.autoLandCount = true; workingState.settings.avgCmcTarget += 0.1; runBuild(); }],
      ["Loosen colors", () => { workingState.settings.colorLegality = "soft"; runBuild(); }],
      ["Allow duplicates", () => { workingState.settings.allowDuplicates = true; runBuild(); }],
      ["Lower curve", () => { workingState.settings.avgCmcTarget = Math.max(1.5, workingState.settings.avgCmcTarget - 0.3); runBuild(); }]
    ].forEach(([label, fn]) => { const b = document.createElement("button"); b.className = "menuBtn"; b.textContent = label; b.onclick = fn; fixRow.appendChild(b); });

    explain.append(explainList, fixRow);

    const status = document.createElement("div");
    status.className = "dbHint";
    status.textContent = diagnostics.status || "Built.";

    const hintWrap = document.createElement("div");
    hintLines.forEach((line) => { const hint = document.createElement("div"); hint.className = "dbWarning"; hint.textContent = line; hintWrap.appendChild(hint); });

    const debugPanel = document.createElement("details");
    debugPanel.className = "dbExplain";
    debugPanel.open = !!workingState.diagnosticsExpanded && !!workingState.settings.debugDiagnostics;
    debugPanel.ontoggle = () => { workingState.diagnosticsExpanded = debugPanel.open; commitState(); };
    debugPanel.innerHTML = "<summary>Debug diagnostics</summary>";
    const pre = document.createElement("pre");
    pre.className = "dbDebug";
    pre.textContent = JSON.stringify(diagnostics, null, 2);
    debugPanel.appendChild(pre);

    const inspector = document.createElement("div");
    inspector.className = "zoneMeta";
    inspector.textContent = "Inspect: click a card to pin details.";

    const overviewModeRow = document.createElement("div");
    overviewModeRow.className = "dbInline";
    ["grid", "curve", "list"].forEach((mode) => {
      const b = document.createElement("button");
      b.className = "menuBtn";
      b.textContent = `${mode[0].toUpperCase()}${mode.slice(1)} view`;
      b.disabled = workingState.settings.overviewMode === mode;
      b.onclick = () => { workingState.settings.overviewMode = mode; commitState(); deps.render?.(); };
      overviewModeRow.appendChild(b);
    });

    const overview = renderDeckOverview(deck, poolById, {
      viewMode: workingState.settings.overviewMode,
      onInspect: (card) => {
        inspector.textContent = `${card.name} • cost ${card.cost} • ${card.isLand ? "LAND" : `${card.power}|${card.toughness}`} • value ${Number(card.value || 0).toFixed(2)}${card.roles?.length ? ` • roles ${card.roles.join(", ")} (${card.roleConfidence || "low"})` : ""}`;
      }
    });

    const candidatesWrap = document.createElement("div");
    const candidates = Array.isArray(workingState.lastCandidates) ? workingState.lastCandidates : [];
    if (candidates.length) {
      const heading = document.createElement("h4");
      heading.textContent = "Candidates";
      candidatesWrap.appendChild(heading);
      const row = document.createElement("div");
      row.className = "dbCandidateRow";
      candidates.forEach((cand) => {
        const card = document.createElement("button");
        card.className = "dbCandidateCard";
        const chips = cand.chips.map((ch) => `<span class="dbChip">${ch}</span>`).join(" ");
        card.innerHTML = `<strong>${cand.label}</strong><div class="dbHint">${chips}</div>`;
        card.onclick = () => { workingState.lastDeck = cand.deck; commitState(); deps.render?.(); };
        row.appendChild(card);
      });
      candidatesWrap.appendChild(row);
    }

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
      const empty = document.createElement("div"); empty.className = "dbHint"; empty.textContent = "No saved decks yet."; savedWrap.appendChild(empty);
    } else {
      savedDecks.forEach((saved) => {
        const row = document.createElement("div"); row.className = "dbSavedDeckRow";
        const meta = document.createElement("div"); meta.className = "dbHint";
        const snap = saved.statsSnapshot || {};
        meta.textContent = `${saved.name} • quality ${Number(snap.deckQuality || 0).toFixed(0)} • size ${Number(saved?.deck?.size || 0)}`;
        const loadBtn = document.createElement("button"); loadBtn.className = "menuBtn"; loadBtn.textContent = "Load";
        loadBtn.onclick = () => { workingState.lastDeck = hydrateBuiltDeckFromSaved(saved, poolById); workingState.lastSelectedDeckId = saved.deckId; commitSavedDecks(); deps.render?.(); };
        const renameBtn = document.createElement("button"); renameBtn.className = "menuBtn"; renameBtn.textContent = "Rename";
        renameBtn.onclick = () => { const nextName = window.prompt("Rename deck", saved.name); if (nextName == null) return; saved.name = String(nextName || "").trim() || saved.name; saved.updatedAt = Date.now(); commitSavedDecks(); deps.render?.(); };
        const dupBtn = document.createElement("button"); dupBtn.className = "menuBtn"; dupBtn.textContent = "Duplicate";
        dupBtn.onclick = () => { const now = Date.now(); const clone = JSON.parse(JSON.stringify(saved)); clone.deckId = `dk_${now}_${Math.random().toString(16).slice(2, 8)}`; clone.name = `${saved.name} Copy`; clone.createdAt = now; clone.updatedAt = now; workingState.savedDecks = [clone, ...savedDecks]; commitSavedDecks(); deps.render?.(); };
        const delBtn = document.createElement("button"); delBtn.className = "menuBtn"; delBtn.textContent = "Delete";
        delBtn.onclick = () => { workingState.savedDecks = savedDecks.filter((d) => d.deckId !== saved.deckId); if (workingState.lastSelectedDeckId === saved.deckId) workingState.lastSelectedDeckId = ""; commitSavedDecks(); deps.render?.(); };
        row.append(meta, loadBtn, renameBtn, dupBtn, delBtn);
        savedWrap.appendChild(row);
      });
    }

    out.append(chipRow, hist, status, hintWrap, explain, overviewModeRow, overview, inspector, candidatesWrap);
    if (workingState.settings.debugDiagnostics) out.append(debugPanel);
    if (deck.remixDiff) {
      const remixInfo = document.createElement("div"); remixInfo.className = "dbHint";
      remixInfo.textContent = `Remix diff • changed ${deck.remixDiff.changedCards} cards • avg cmc ${deck.remixDiff.avgCmcDelta >= 0 ? "+" : ""}${deck.remixDiff.avgCmcDelta} • quality ${deck.remixDiff.qualityDelta >= 0 ? "+" : ""}${deck.remixDiff.qualityDelta}`;
      out.appendChild(remixInfo);
    }
    out.append(saveBtn, savedWrap);

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
    getDeckbuilderCardPool,
    getIntentWeights,
    inferRoles,
    computeManaDemand,
    recommendLands,
    generateCandidates,
    remixDeck
  };
})();

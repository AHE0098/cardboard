(() => {
  const DEFAULTS = {
    deckSize: 40,
    lands: 17,
    targetValueSum: 0,
    targetDeckScore: 0,
    includeLands: true,
    seed: 1337,
    overviewMode: "grid"
  };

  const CONSTS = {
    K_PENALTY: 60,
    PSTAR_A: 0.25,
    PSTAR_B: 0.05,
    PSTAR_MIN: 0.2,
    PSTAR_MAX: 0.6
  };

  const CURVE_ORDER = ["0", "1", "2", "3", "4", "5", "6+"];
  const LAND_IDS = [101, 102, 103, 104, 105, 106];
  const LAND_ID_SET = new Set(LAND_IDS.map((id) => String(id)));

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  function toFiniteNumber(x, fallback = 0) {
    const n = Number(x);
    return Number.isFinite(n) ? n : fallback;
  }

  function isLandId(id) {
    return LAND_ID_SET.has(String(id));
  }

  function analyzeCardPool(allCards) {
    const entries = Array.isArray(allCards)
      ? allCards.map((c) => [c?.id, c])
      : (allCards && typeof allCards === "object")
        ? Object.entries(allCards)
        : [];

    let droppedMalformed = 0;
    let landCount = 0;
    const pool = [];

    entries.forEach(([idRaw, card]) => {
      if (idRaw == null || idRaw === "") {
        droppedMalformed += 1;
        return;
      }
      const id = String(idRaw);
      const land = isLandId(id);
      if (land) landCount += 1;
      pool.push({
        id,
        name: String(card?.name || `Card ${idRaw ?? "?"}`),
        cost: toFiniteNumber(card?.cost, 0),
        power: toFiniteNumber(card?.power, 0),
        toughness: toFiniteNumber(card?.toughness, 0),
        value: toFiniteNumber(card?.value, 0),
        isLand: land
      });
    });

    return {
      pool,
      droppedMalformed,
      landCount
    };
  }

  function getDeckbuilderCardPool(allCards) {
    return analyzeCardPool(allCards).pool;
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

  function computeDeckScore(stats) {
    const pStar = clamp(CONSTS.PSTAR_A + CONSTS.PSTAR_B * stats.avgCost, CONSTS.PSTAR_MIN, CONSTS.PSTAR_MAX);
    const consistency = Math.exp(-CONSTS.K_PENALTY * ((stats.landFraction - pStar) ** 2));
    return {
      pStar,
      consistency,
      deckScore: stats.baseValue * consistency
    };
  }

  function computeDeckStats(deck, poolById) {
    const ids = Array.isArray(deck?.nonlandIds) ? deck.nonlandIds : [];
    const lands = Math.max(0, Number(deck?.lands || 0));
    const nonlands = ids.map((id) => poolById[id]).filter(Boolean);
    const X = ids.length + lands;
    const N = ids.length;
    const Y = nonlands.reduce((sum, c) => sum + (Number.isFinite(c.value) ? c.value : 0), 0);
    const ptSum = nonlands.reduce((sum, c) => sum + c.power + c.toughness, 0);
    const costSum = nonlands.reduce((sum, c) => sum + c.cost, 0);
    const avgCost = N ? costSum / N : 0;
    const baseValue = N ? Y / N : 0;
    const landFraction = X ? lands / X : 0;

    const histogram = { "0": 0, "1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "6+": 0 };
    nonlands.forEach((c) => {
      if (c.cost >= 6) histogram["6+"] += 1;
      else histogram[String(c.cost)] = (histogram[String(c.cost)] || 0) + 1;
    });

    const scoreBits = computeDeckScore({ avgCost, landFraction, baseValue });
    return {
      totalCards: X,
      lands,
      nonlands: N,
      sumValue: Y,
      sumPT: ptSum,
      avgCost,
      baseValue,
      landFraction,
      curveHistogram: histogram,
      pStar: scoreBits.pStar,
      consistency: scoreBits.consistency,
      deckScore: scoreBits.deckScore
    };
  }

  function buildDeck(settings, allCards) {
    const requestedDeckSize = clamp(Math.round(Number(settings?.deckSize ?? DEFAULTS.deckSize)), 20, 100);
    const requestedLands = clamp(Math.round(Number(settings?.lands ?? DEFAULTS.lands)), 0, requestedDeckSize);
    const safe = {
      deckSize: requestedDeckSize,
      lands: requestedLands,
      targetValueSum: Math.round(Number(settings?.targetValueSum ?? DEFAULTS.targetValueSum)),
      targetDeckScore: Number(settings?.targetDeckScore ?? DEFAULTS.targetDeckScore),
      includeLands: settings?.includeLands !== false,
      seed: settings?.seed ?? DEFAULTS.seed,
      overviewMode: settings?.overviewMode === "curve" ? "curve" : "grid"
    };

    const inspected = analyzeCardPool(allCards);
    const pool = inspected.pool.filter((c) => !c.isLand);
    const poolById = Object.fromEntries(pool.map((c) => [c.id, c]));
    const nonlandTarget = Math.max(0, safe.deckSize - safe.lands);
    const diagnostics = {
      poolSize: pool.length,
      recognizedLandIds: inspected.landCount,
      droppedMalformed: inspected.droppedMalformed,
      usedReplacement: false,
      feasibleRange: [0, 0],
      targetOutOfRange: false,
      hint: ""
    };

    if (!pool.length) {
      const error = "No nonland cards available in CARD_REPO. Showing safe empty deck.";
      const emptyDeck = { nonlandIds: [], lands: safe.lands };
      return {
        ...emptyDeck,
        settings: safe,
        diagnostics,
        error,
        stats: computeDeckStats(emptyDeck, poolById),
        builtAt: Date.now()
      };
    }

    const rng = makeRng(`${safe.seed}|${safe.deckSize}|${safe.lands}|${safe.targetValueSum}`);
    const sortedValues = pool.map((c) => c.value).sort((a, b) => a - b);
    if (nonlandTarget > 0) {
      if (pool.length < nonlandTarget) diagnostics.usedReplacement = true;
      if (pool.length < nonlandTarget) {
        diagnostics.feasibleRange = [sortedValues[0] * nonlandTarget, sortedValues[sortedValues.length - 1] * nonlandTarget];
      } else {
        const minSum = sortedValues.slice(0, nonlandTarget).reduce((sum, v) => sum + v, 0);
        const maxSum = sortedValues.slice(Math.max(0, sortedValues.length - nonlandTarget)).reduce((sum, v) => sum + v, 0);
        diagnostics.feasibleRange = [minSum, maxSum];
      }
      diagnostics.targetOutOfRange = safe.targetValueSum < diagnostics.feasibleRange[0] || safe.targetValueSum > diagnostics.feasibleRange[1];
      if (diagnostics.targetOutOfRange) diagnostics.hint = "Target Y is outside feasible range; closest deck shown.";
    }

    const pickAt = () => pool[Math.floor(rng() * pool.length)].id;
    const seedIds = [];
    for (let i = 0; i < nonlandTarget; i += 1) {
      seedIds.push(pickAt());
    }

    const costVariance = (ids) => {
      if (!ids.length) return 0;
      const costs = ids.map((id) => poolById[id]?.cost || 0);
      const mean = costs.reduce((s, c) => s + c, 0) / costs.length;
      return costs.reduce((s, c) => s + ((c - mean) ** 2), 0) / costs.length;
    };

    const objective = (stats, ids) => {
      const valueDelta = Math.abs(stats.sumValue - safe.targetValueSum);
      const smoothness = costVariance(ids);
      return valueDelta + smoothness * 0.01 - stats.sumPT * 0.001;
    };

    let bestDeck = { nonlandIds: seedIds.slice(), lands: safe.lands };
    let bestStats = computeDeckStats(bestDeck, poolById);
    let bestObj = objective(bestStats, bestDeck.nonlandIds);

    const swapRounds = clamp(nonlandTarget * 20, 300, 1000);
    for (let i = 0; i < swapRounds; i += 1) {
      if (!bestDeck.nonlandIds.length) break;
      const testIds = bestDeck.nonlandIds.slice();
      const slot = Math.floor(rng() * testIds.length);
      testIds[slot] = pickAt();
      const probe = { nonlandIds: testIds, lands: safe.lands };
      const probeStats = computeDeckStats(probe, poolById);
      const probeObj = objective(probeStats, probe.nonlandIds);
      if (probeObj < bestObj) {
        bestObj = probeObj;
        bestDeck = probe;
        bestStats = probeStats;
      }
    }

    return { ...bestDeck, settings: safe, stats: bestStats, diagnostics, builtAt: Date.now() };
  }

  function normalizeState(state) {
    const input = { ...DEFAULTS, ...(state?.settings || {}) };
    const deckSize = clamp(Math.round(Number(input.deckSize ?? DEFAULTS.deckSize)), 20, 100);
    const lands = clamp(Math.round(Number(input.lands ?? DEFAULTS.lands)), 0, deckSize);
    return {
      settings: {
        ...input,
        deckSize,
        lands,
        targetValueSum: Math.round(Number(input.targetValueSum ?? DEFAULTS.targetValueSum)),
        seed: Number(input.seed ?? DEFAULTS.seed),
        overviewMode: input.overviewMode === "curve" ? "curve" : "grid"
      },
      lastDeck: state?.lastDeck || null,
      savedDecks: Array.isArray(state?.savedDecks) ? state.savedDecks : [],
      lastSelectedDeckId: state?.lastSelectedDeckId || ""
    };
  }

  function getCurveBucket(cost) {
    if (!Number.isFinite(cost)) return "0";
    return cost >= 6 ? "6+" : String(Math.max(0, Math.floor(cost)));
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
    const nonlandIds = Array.isArray(deck?.nonlandIds) ? deck.nonlandIds.filter((id) => !!poolById[id]) : [];
    const landIds = mapLandsToIds(deck?.lands || 0, `${Date.now()}|${name || "deck"}`);
    const stats = deck?.stats || computeDeckStats(deck, poolById);
    const now = Date.now();
    return {
      deckId: `dk_${now}_${Math.random().toString(16).slice(2, 8)}`,
      name: (name || "Untitled Deck").trim(),
      createdAt: now,
      updatedAt: now,
      settingsSnapshot: deck?.settings || null,
      deck: {
        size: nonlandIds.length + landIds.length,
        lands: landIds.length,
        cards: [...nonlandIds, ...landIds]
      },
      stats
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
      settings: savedDeck?.settingsSnapshot || null,
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
    cost.textContent = isLand ? "LAND" : String(cardData?.cost ?? "0");
    tile.appendChild(cost);

    const pt = document.createElement("div");
    pt.className = "miniPT";
    pt.textContent = isLand ? "-|-" : `${Number(cardData?.power || 0)}|${Number(cardData?.toughness || 0)}`;
    tile.appendChild(pt);

    const valueBadge = document.createElement("div");
    valueBadge.className = "miniValue";
    valueBadge.textContent = Number.isFinite(cardData?.value) ? `v:${Number(cardData.value).toFixed(1)}` : "v:0.0";
    tile.appendChild(valueBadge);

    const title = isLand ? "Basic Land" : (cardData?.name || `Card ${cardId}`);
    tile.title = `${title} (${cost.textContent}, ${pt.textContent})`;

    tile.onclick = () => {
      opts.onInspect?.({
        id: cardId,
        isLand,
        name: title,
        cost: isLand ? "LAND" : String(cardData?.cost ?? "0"),
        power: isLand ? null : Number(cardData?.power || 0),
        toughness: isLand ? null : Number(cardData?.toughness || 0),
        value: Number(cardData?.value || 0)
      });
    };

    return tile;
  }

  function renderDeckOverview(deck, poolById, opts = {}) {
    const viewMode = opts.viewMode === "curve" ? "curve" : "grid";
    const host = document.createElement("div");
    host.className = "deckOverviewWrap";

    const cards = [];
    const nonlandIds = Array.isArray(deck?.nonlandIds) ? deck.nonlandIds : [];
    nonlandIds.forEach((id, index) => {
      const data = poolById[id];
      if (!data) return;
      cards.push({ key: `c_${id}_${index}`, id, data, bucket: getCurveBucket(data.cost), isLand: false });
    });

    const lands = Math.max(0, Number(deck?.lands || 0));
    for (let i = 0; i < lands; i += 1) {
      cards.push({ key: `l_${i}`, id: LAND_IDS[i % LAND_IDS.length], data: { name: "Basic Land", cost: "LAND", power: 0, toughness: 0, value: 0 }, bucket: "LAND", isLand: true });
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

  function renderDeckbuilder(rootNode, state, deps = {}) {
    const workingState = normalizeState(state);
    const pool = getDeckbuilderCardPool(deps.allCards);
    const poolById = Object.fromEntries(pool.map((c) => [c.id, c]));
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

    const wrap = document.createElement("div");
    wrap.className = "deckbuilderWrap";

    const controls = document.createElement("div");
    controls.className = "menuCard";
    controls.innerHTML = "<h2>Deck Builder v1.1</h2>";

    const makeControl = (label, key, min, max, step = 1) => {
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
      const apply = (v) => {
        const next = clamp(Number(v), min, max);
        workingState.settings[key] = step === 1 ? Math.round(next) : Number(next.toFixed(2));
        slider.value = String(workingState.settings[key]);
        num.value = String(workingState.settings[key]);
        commitState();
      };
      slider.oninput = () => apply(slider.value);
      num.onchange = () => apply(num.value);
      inputRow.append(slider, num);
      row.append(title, inputRow);
      return row;
    };

    controls.append(
      makeControl("Deck size (X)", "deckSize", 20, 100, 1),
      makeControl("Lands (Z)", "lands", 0, workingState.settings.deckSize, 1),
      makeControl("Target sum value (Y)", "targetValueSum", -2000, 2000, 1)
    );

    const [deckSizeControl, landsControl, targetControl] = controls.querySelectorAll(".dbControl");
    const deckSizeSlider = deckSizeControl?.querySelector('input[type="range"]');
    const landsSlider = landsControl?.querySelector('input[type="range"]');
    const landsNumber = landsControl?.querySelector('input[type="number"]');
    const setLandLimit = (maxLands) => {
      if (!landsSlider || !landsNumber) return;
      const clamped = clamp(Number(workingState.settings.lands || 0), 0, maxLands);
      workingState.settings.lands = clamped;
      landsSlider.max = String(maxLands);
      landsNumber.max = String(maxLands);
      landsSlider.value = String(clamped);
      landsNumber.value = String(clamped);
    };
    setLandLimit(workingState.settings.deckSize);
    if (deckSizeSlider) {
      deckSizeSlider.addEventListener("input", () => {
        setLandLimit(clamp(Number(deckSizeSlider.value), 20, 100));
      });
      deckSizeSlider.addEventListener("change", () => {
        setLandLimit(workingState.settings.deckSize);
        commitState();
      });
    }

    if (targetControl) {
      const title = targetControl.querySelector("span");
      if (title) title.textContent = "Target sum value (Y)";
    }

    const advancedLabel = document.createElement("div");
    advancedLabel.className = "zoneMeta";
    advancedLabel.textContent = "Advanced";

    const seedInput = document.createElement("input");
    seedInput.className = "menuInput";
    seedInput.type = "number";
    seedInput.value = String(workingState.settings.seed ?? 1337);
    seedInput.placeholder = "Seed";
    seedInput.onchange = () => {
      workingState.settings.seed = Number(seedInput.value || 1337);
      commitState();
    };

    const buildBtn = document.createElement("button");
    buildBtn.className = "menuBtn";
    buildBtn.textContent = "Build Deck";
    buildBtn.onclick = () => {
      workingState.lastDeck = buildDeck(workingState.settings, deps.allCards);
      commitState();
      deps.render?.();
    };

    controls.append(advancedLabel, seedInput, buildBtn);
    wrap.appendChild(controls);

    const out = document.createElement("div");
    out.className = "menuCard";
    const deck = workingState.lastDeck;
    if (!deck) {
      out.innerHTML = `<h3>No deck yet</h3><div class="zoneMeta">Pool size: ${pool.length}. Pick settings and build.</div>`;
    } else {
      const stats = deck.stats || computeDeckStats(deck, poolById);
      const diagnostics = deck.diagnostics || {};
      const inspector = document.createElement("div");
      inspector.className = "zoneMeta";
      inspector.textContent = "Tap a tile to inspect a card.";

      const health = document.createElement("div");
      health.className = "zoneMeta";
      const feasible = Array.isArray(diagnostics.feasibleRange) ? diagnostics.feasibleRange : [0, 0];
      health.textContent = `Pool nonlands: ${Number(diagnostics.poolSize || 0)} • Land IDs recognized: ${Number(diagnostics.recognizedLandIds || 0)} • Dropped malformed: ${Number(diagnostics.droppedMalformed || 0)} • Repeated cards: ${diagnostics.usedReplacement ? "yes" : "no"} • Feasible Y: [${Number(feasible[0] || 0).toFixed(1)}, ${Number(feasible[1] || 0).toFixed(1)}]${diagnostics.hint ? ` • ${diagnostics.hint}` : ""}`;

      const errorPanel = document.createElement("div");
      errorPanel.className = "zoneMeta";
      if (deck.error) errorPanel.textContent = `Error: ${deck.error}`;

      const overviewToolbar = document.createElement("div");
      overviewToolbar.className = "dbInline";
      const gridBtn = document.createElement("button");
      gridBtn.className = "menuBtn";
      gridBtn.textContent = "Grid view";
      const curveBtn = document.createElement("button");
      curveBtn.className = "menuBtn";
      curveBtn.textContent = "Curve view";

      const setMode = (mode) => {
        workingState.settings.overviewMode = mode;
        commitState();
        deps.render?.();
      };
      gridBtn.onclick = () => setMode("grid");
      curveBtn.onclick = () => setMode("curve");
      gridBtn.disabled = workingState.settings.overviewMode === "grid";
      curveBtn.disabled = workingState.settings.overviewMode === "curve";
      overviewToolbar.append(gridBtn, curveBtn);

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
        empty.className = "zoneMeta";
        empty.textContent = "No saved decks yet.";
        savedWrap.appendChild(empty);
      } else {
        savedDecks.forEach((saved) => {
          const row = document.createElement("div");
          row.className = "dbSavedDeckRow";
          const score = Number(saved?.stats?.deckScore || 0).toFixed(3);
          const size = Number(saved?.deck?.size || saved?.deck?.cards?.length || 0);
          const landsCount = Number(saved?.deck?.lands || 0);
          const meta = document.createElement("div");
          meta.className = "zoneMeta";
          meta.textContent = `${saved.name} • score ${score} • size ${size} • lands ${landsCount}`;

          const loadBtn = document.createElement("button");
          loadBtn.className = "menuBtn";
          loadBtn.textContent = "Load";
          loadBtn.onclick = () => {
            workingState.lastDeck = hydrateBuiltDeckFromSaved(saved, poolById);
            workingState.lastSelectedDeckId = saved.deckId;
            commitSavedDecks();
            deps.render?.();
          };

          const deleteBtn = document.createElement("button");
          deleteBtn.className = "menuBtn";
          deleteBtn.textContent = "Delete";
          deleteBtn.onclick = () => {
            workingState.savedDecks = savedDecks.filter((d) => d.deckId !== saved.deckId);
            if (workingState.lastSelectedDeckId === saved.deckId) workingState.lastSelectedDeckId = "";
            commitSavedDecks();
            deps.render?.();
          };

          row.append(meta, loadBtn, deleteBtn);
          savedWrap.appendChild(row);
        });
      }

      out.innerHTML = `
        <h3>Summary</h3>
        <div class="dbSummaryGrid">
          <div>Total cards X: <b>${stats.totalCards}</b></div>
          <div>Lands Z: <b>${stats.lands}</b></div>
          <div>Creatures N: <b>${stats.nonlands}</b></div>
          <div>Sum PT: <b>${stats.sumPT}</b></div>
          <div>Sum value Y: <b>${stats.sumValue.toFixed(2)}</b></div>
          <div>Base Y/N: <b>${stats.baseValue.toFixed(4)}</b></div>
          <div>Avg cost: <b>${stats.avgCost.toFixed(3)}</b></div>
          <div>p = Z/X: <b>${stats.landFraction.toFixed(3)}</b></div>
          <div>p*: <b>${stats.pStar.toFixed(3)}</b></div>
          <div>Consistency: <b>${stats.consistency.toFixed(4)}</b></div>
          <div>DeckScore: <b>${stats.deckScore.toFixed(4)}</b></div>
          <div>Curve [0/1/2/3/4/5/6+]: <b>${stats.curveHistogram["0"]}/${stats.curveHistogram["1"]}/${stats.curveHistogram["2"]}/${stats.curveHistogram["3"]}/${stats.curveHistogram["4"]}/${stats.curveHistogram["5"]}/${stats.curveHistogram["6+"]}</b></div>
        </div>
      `;
      out.append(overviewToolbar, overview, inspector, health);
      if (deck.error) out.append(errorPanel);
      out.append(saveBtn, savedWrap);
    }

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

(() => {
  const DEFAULTS = {
    deckSize: 40,
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

  function clamp(n, lo, hi) {
    return Math.max(lo, Math.min(hi, n));
  }

  function getDeckbuilderCardPool(allCards) {
    return (Array.isArray(allCards) ? allCards : [])
      .map((card) => ({
        id: Number(card?.id),
        name: String(card?.name || `Card ${card?.id ?? "?"}`),
        cost: Number(card?.cost),
        power: Number(card?.power),
        toughness: Number(card?.toughness),
        value: Number(card?.value ?? 0)
      }))
      .filter((card) => /^\d+$/.test(String(card.id)) && /^\d+$/.test(String(card.cost)) && Number.isFinite(card.power) && Number.isFinite(card.toughness) && Number.isFinite(card.value));
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
    const safe = {
      deckSize: clamp(Math.round(Number(settings?.deckSize ?? DEFAULTS.deckSize)), 20, 100),
      targetValueSum: Math.round(Number(settings?.targetValueSum ?? DEFAULTS.targetValueSum)),
      targetDeckScore: Number(settings?.targetDeckScore ?? DEFAULTS.targetDeckScore),
      includeLands: settings?.includeLands !== false,
      seed: settings?.seed ?? DEFAULTS.seed,
      overviewMode: settings?.overviewMode === "curve" ? "curve" : "grid"
    };

    const pool = getDeckbuilderCardPool(allCards);
    const poolById = Object.fromEntries(pool.map((c) => [c.id, c]));
    if (!pool.length) {
      return { nonlandIds: [], lands: 0, settings: safe, stats: computeDeckStats({ nonlandIds: [], lands: 0 }, poolById), builtAt: Date.now() };
    }

    const rng = makeRng(`${safe.seed}|${safe.deckSize}|${safe.targetValueSum}|${safe.targetDeckScore}|${safe.includeLands ? 1 : 0}`);
    const desiredMeanValue = safe.deckSize ? safe.targetValueSum / safe.deckSize : 0;
    const desiredCost = clamp(2.5 + safe.targetDeckScore * 0.8, 0, 8);
    const picked = [];

    for (let i = 0; i < safe.deckSize; i += 1) {
      const candidate = pool
        .map((card) => {
          const fit = Math.abs(card.value - desiredMeanValue) * 1.3 + Math.abs(card.cost - desiredCost) * 0.55;
          return { card, rank: fit + rng() * 0.35 };
        })
        .sort((a, b) => a.rank - b.rank)[Math.floor(rng() * Math.min(18, pool.length))]?.card || pool[Math.floor(rng() * pool.length)];
      picked.push(candidate.id);
    }

    const objective = (stats) => {
      const deckScoreWeight = 2.2;
      const dScore = Math.abs(stats.deckScore - safe.targetDeckScore);
      const dValue = Math.abs(stats.sumValue - safe.targetValueSum) / Math.max(1, safe.deckSize);
      return (Number.isFinite(safe.targetDeckScore) ? dScore * deckScoreWeight : 0) + dValue;
    };

    let bestDeck = { nonlandIds: picked.slice(), lands: 0 };
    let bestStats = computeDeckStats(bestDeck, poolById);
    let bestObj = Infinity;

    const minL = safe.includeLands ? Math.floor(safe.deckSize * CONSTS.PSTAR_MIN) : 0;
    const maxL = safe.includeLands ? Math.ceil(safe.deckSize * CONSTS.PSTAR_MAX) : 0;
    for (let lands = minL; lands <= maxL; lands += 1) {
      const n = Math.max(0, safe.deckSize - lands);
      if (n <= 0) continue;
      const probe = { nonlandIds: picked.slice(0, n), lands };
      const probeStats = computeDeckStats(probe, poolById);
      const score = objective(probeStats);
      if (score < bestObj) {
        bestObj = score;
        bestDeck = probe;
        bestStats = probeStats;
      }
    }

    const swapRounds = Math.min(250, safe.deckSize * 6);
    for (let i = 0; i < swapRounds; i += 1) {
      if (!bestDeck.nonlandIds.length) break;
      const testIds = bestDeck.nonlandIds.slice();
      const slot = Math.floor(rng() * testIds.length);
      testIds[slot] = pool[Math.floor(rng() * pool.length)].id;
      const probe = { nonlandIds: testIds, lands: bestDeck.lands };
      const probeStats = computeDeckStats(probe, poolById);
      const probeObj = objective(probeStats);
      if (probeObj < bestObj) {
        bestObj = probeObj;
        bestDeck = probe;
        bestStats = probeStats;
      }
    }

    return { ...bestDeck, settings: safe, stats: bestStats, builtAt: Date.now() };
  }

  function normalizeState(state) {
    return {
      settings: { ...DEFAULTS, ...(state?.settings || {}) },
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
    const cards = Array.isArray(savedDeck?.deck?.cards) ? savedDeck.deck.cards.map((id) => Number(id)).filter((id) => Number.isFinite(id)) : [];
    const lands = cards.filter((id) => LAND_IDS.includes(id)).length;
    const nonlandIds = cards.filter((id) => !LAND_IDS.includes(id) && poolById[id]);
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
      makeControl("Target sum value (Y)", "targetValueSum", -200, 200, 1),
      makeControl("Target DeckScore", "targetDeckScore", -10, 10, 0.1)
    );

    const includeRow = document.createElement("label");
    includeRow.className = "dbInline";
    const includeLands = document.createElement("input");
    includeLands.type = "checkbox";
    includeLands.checked = !!workingState.settings.includeLands;
    includeLands.onchange = () => {
      workingState.settings.includeLands = includeLands.checked;
      commitState();
    };
    includeRow.append(includeLands, document.createTextNode(" Include virtual lands"));

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

    controls.append(includeRow, seedInput, buildBtn);
    wrap.appendChild(controls);

    const out = document.createElement("div");
    out.className = "menuCard";
    const deck = workingState.lastDeck;
    if (!deck) {
      out.innerHTML = `<h3>No deck yet</h3><div class="zoneMeta">Pool size: ${pool.length}. Pick settings and build.</div>`;
    } else {
      const stats = deck.stats || computeDeckStats(deck, poolById);
      const inspector = document.createElement("div");
      inspector.className = "zoneMeta";
      inspector.textContent = "Tap a tile to inspect a card.";

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
      out.append(overviewToolbar, overview, inspector, saveBtn, savedWrap);
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

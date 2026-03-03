(function initSimController(global) {
  const SimUI = (global.SimUI = global.SimUI || {});
  function isDevParityEnabled() {
    try { return new URLSearchParams(global.location.search || "").get("dev") === "1"; } catch { return false; }
  }

  function isSimReportDebugEnabled() {
    if (global.__SIM_REPORT_DEBUG__ === true) return true;
    try {
      return new URLSearchParams(global.location.search || "").get("simReportDebug") === "1";
    } catch {
      return false;
    }
  }

  function reportEventBadge(kind) {
    if (kind === "attack") return "⚔ ATTACK";
    if (kind === "block") return "🛡 BLOCK";
    if (kind === "damage") return "✦ DMG";
    return "•";
  }

  function renderSimulatorMode(rootNode, ctx) {
    const { subtitle, session, savedDecks, simulatorState, persistPlayerSaveDebounced, renderApp, getDeckById, uid, parseManaCost, getCardDef, getAbortController, setAbortController } = ctx;
    subtitle.textContent = `${session.playerName} • simulator`;
    const { wrap, panel } = SimUI.createSimulatorShell();

    const allDecks = typeof global.getAllAvailableDecks === "function"
      ? global.getAllAvailableDecks()
      : (global.CardboardDeckStorage?.getSavedDecks?.() || savedDecks || []);

    const controls = document.createElement("div");
    controls.className = "simControls";

    function mkDeckSelect(labelText, key) {
      const row = document.createElement("div");
      row.className = "simField";
      const label = document.createElement("label");
      label.className = "zoneMeta";
      label.textContent = labelText;
      const select = document.createElement("select");
      select.className = "menuInput";
      select.dataset.stickyMenu = "1";
      const ph = document.createElement("option");
      ph.value = "";
      ph.textContent = "Select deck";
      select.appendChild(ph);
      allDecks.forEach((deck) => {
        const opt = document.createElement("option");
        const id = String(deck.id || deck.deckId || "");
        opt.value = id;
        const n = typeof global.expandDeckCardIds === "function" ? global.expandDeckCardIds(deck).length : (Array.isArray(deck?.cards) ? deck.cards.length : 0);
        opt.textContent = `${deck.name || id} • ${n}`;
        if (simulatorState[key] === id) opt.selected = true;
        select.appendChild(opt);
      });
      select.onchange = () => { simulatorState[key] = select.value; simulatorState.lastError = ""; persistPlayerSaveDebounced(); };
      row.append(label, select);
      return row;
    }

    controls.append(mkDeckSelect("Deck A", "deckAId"), mkDeckSelect("Deck B", "deckBId"));

    const numericRow = document.createElement("div");
    numericRow.className = "simGrid";
    [["Iterations", "iterations", 1, 5000], ["Seed", "seed", 0, 0xffffffff], ["Max turns", "maxTurns", 1, 1000], ["Starting life", "startingLife", 1, 200]].forEach(([labelText, key, min, max]) => {
      const field = document.createElement("div");
      field.className = "simField";
      const label = document.createElement("label");
      label.className = "zoneMeta";
      label.textContent = labelText;
      const input = document.createElement("input");
      input.className = "menuInput";
      input.type = "number";
      input.min = String(min);
      input.max = String(max);
      input.value = String(simulatorState[key]);
      input.onchange = () => {
        const v = Number(input.value);
        if (Number.isFinite(v)) simulatorState[key] = Math.max(min, Math.min(max, Math.floor(v)));
        input.value = String(simulatorState[key]);
        persistPlayerSaveDebounced();
      };
      field.append(label, input);
      numericRow.appendChild(field);
    });

    const logField = document.createElement("div");
    logField.className = "simField";
    const logLabel = document.createElement("label");
    logLabel.className = "zoneMeta";
    logLabel.textContent = "Batch log mode";
    const logSelect = document.createElement("select");
    logSelect.className = "menuInput";
    ["none", "summary", "full"].forEach((mode) => {
      const opt = document.createElement("option");
      opt.value = mode;
      opt.textContent = mode;
      if (simulatorState.logMode === mode) opt.selected = true;
      logSelect.appendChild(opt);
    });
    logSelect.onchange = () => { simulatorState.logMode = logSelect.value; persistPlayerSaveDebounced(); };
    logField.append(logLabel, logSelect);
    numericRow.appendChild(logField);

    function appendRuleToggle(labelText, key) {
      const field = document.createElement("div");
      field.className = "simField";
      const label = document.createElement("label");
      label.className = "zoneMeta";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = !!simulatorState[key];
      input.onchange = () => {
        simulatorState[key] = !!input.checked;
        persistPlayerSaveDebounced();
      };
      label.append(input, document.createTextNode(` ${labelText}`));
      field.appendChild(label);
      numericRow.appendChild(field);
    }

    function appendCertaintySlider(labelText, key) {
      const field = document.createElement("div");
      field.className = "simField";
      const label = document.createElement("label");
      label.className = "zoneMeta";
      label.textContent = `${labelText} certainty (${simulatorState[key]}%)`;
      const input = document.createElement("input");
      input.className = "menuInput";
      input.type = "range";
      input.min = "0";
      input.max = "100";
      input.step = "1";
      input.value = String(simulatorState[key]);
      input.oninput = () => {
        const v = Math.max(0, Math.min(100, Math.floor(Number(input.value) || 0)));
        simulatorState[key] = v;
        label.textContent = `${labelText} certainty (${v}%)`;
        persistPlayerSaveDebounced();
      };
      field.append(label, input);
      numericRow.appendChild(field);
    }

    appendRuleToggle("Summoning Sickness", "summoningSickness");
    appendRuleToggle("No block after attacking (1-turn)", "noBlockAfterAttacking");
    appendRuleToggle("SMART BLOCKING", "smartBlocking");
    appendRuleToggle("SMART ATTACKING", "smartAttacking");
    appendRuleToggle("AI Debug Decisions", "aiDebugDecisions");
    appendCertaintySlider("Attack", "attackCertainty");
    appendCertaintySlider("Defend", "defendCertainty");

    const sweepEnabledField = document.createElement("div");
    sweepEnabledField.className = "simField";
    const sweepEnabledLabel = document.createElement("label");
    sweepEnabledLabel.className = "zoneMeta";
    const sweepEnabledInput = document.createElement("input");
    sweepEnabledInput.type = "checkbox";
    sweepEnabledInput.checked = !!simulatorState.sweepEnabled;
    sweepEnabledInput.onchange = () => {
      simulatorState.sweepEnabled = !!sweepEnabledInput.checked;
      persistPlayerSaveDebounced();
    };
    sweepEnabledLabel.append(sweepEnabledInput, document.createTextNode(" Enable sweep"));
    sweepEnabledField.appendChild(sweepEnabledLabel);
    numericRow.appendChild(sweepEnabledField);

    const sweepFeaturesField = document.createElement("div");
    sweepFeaturesField.className = "simField";
    const sweepFeaturesLabel = document.createElement("label");
    sweepFeaturesLabel.className = "zoneMeta";
    sweepFeaturesLabel.textContent = "Sweep strategies";
    const sweepFeaturesWrap = document.createElement("div");
    sweepFeaturesWrap.className = "simStack";
    const sweepFeatures = [
      ["summoningSickness", "Summoning Sickness"],
      ["noBlockAfterAttacking", "No block after attacking"],
      ["smartBlocking", "Smart Blocking"],
      ["smartAttacking", "Smart Attacking"]
    ];
    const selectedSweepFeatures = new Set(Array.isArray(simulatorState.sweepFeatureKeys) ? simulatorState.sweepFeatureKeys : []);
    sweepFeatures.forEach(([value, text]) => {
      const row = document.createElement("label");
      row.className = "zoneMeta";
      const input = document.createElement("input");
      input.type = "checkbox";
      input.checked = selectedSweepFeatures.has(value);
      input.onchange = () => {
        const nextSet = new Set(Array.isArray(simulatorState.sweepFeatureKeys) ? simulatorState.sweepFeatureKeys : []);
        if (input.checked) nextSet.add(value);
        else nextSet.delete(value);
        simulatorState.sweepFeatureKeys = Array.from(nextSet);
        persistPlayerSaveDebounced();
      };
      row.append(input, document.createTextNode(` ${text}`));
      sweepFeaturesWrap.appendChild(row);
    });
    const combineRow = document.createElement("label");
    combineRow.className = "zoneMeta";
    const combineInput = document.createElement("input");
    combineInput.type = "checkbox";
    combineInput.checked = !!simulatorState.sweepIncludeCombined;
    combineInput.onchange = () => {
      simulatorState.sweepIncludeCombined = !!combineInput.checked;
      persistPlayerSaveDebounced();
    };
    combineRow.append(combineInput, document.createTextNode(" Combine selected toggles into single strategy"));
    sweepFeaturesWrap.appendChild(combineRow);
    sweepFeaturesField.append(sweepFeaturesLabel, sweepFeaturesWrap);
    numericRow.appendChild(sweepFeaturesField);

    const sweepCertaintyField = document.createElement("div");
    sweepCertaintyField.className = "simField";
    const sweepCertaintyLabel = document.createElement("label");
    sweepCertaintyLabel.className = "zoneMeta";
    sweepCertaintyLabel.textContent = "Apply certainty to";
    const sweepCertaintySelect = document.createElement("select");
    sweepCertaintySelect.className = "menuInput";
    [["attack", "Attack"], ["defend", "Defend"], ["both", "Both"]].forEach(([value, text]) => {
      const opt = document.createElement("option");
      opt.value = value;
      opt.textContent = text;
      if (simulatorState.sweepCertaintyKey === value) opt.selected = true;
      sweepCertaintySelect.appendChild(opt);
    });
    sweepCertaintySelect.onchange = () => {
      simulatorState.sweepCertaintyKey = sweepCertaintySelect.value;
      persistPlayerSaveDebounced();
    };
    sweepCertaintyField.append(sweepCertaintyLabel, sweepCertaintySelect);
    numericRow.appendChild(sweepCertaintyField);

    [["Iterations / lane", "sweepIterationsPerLane", 1, 5000], ["Sweep concurrency", "sweepConcurrency", 1, 4]].forEach(([labelText, key, min, max]) => {
      const field = document.createElement("div");
      field.className = "simField";
      const label = document.createElement("label");
      label.className = "zoneMeta";
      label.textContent = String(labelText);
      const input = document.createElement("input");
      input.className = "menuInput";
      input.type = "number";
      input.min = String(min);
      input.max = String(max);
      input.value = String(simulatorState[key]);
      input.onchange = () => {
        const v = Number(input.value);
        if (Number.isFinite(v)) simulatorState[key] = Math.max(min, Math.min(max, Math.floor(v)));
        input.value = String(simulatorState[key]);
        persistPlayerSaveDebounced();
      };
      field.append(label, input);
      numericRow.appendChild(field);
    });

    const sweepNote = document.createElement("div");
    sweepNote.className = "zoneMeta";
    sweepNote.textContent = "Sweep uses fixed certainty lanes: 0% to 100% by 10%.";
    numericRow.appendChild(sweepNote);

    controls.appendChild(numericRow);
    panel.appendChild(controls);

    const btnRow = document.createElement("div");
    btnRow.className = "simButtons";
    const runBtn = document.createElement("button");
    runBtn.className = "menuBtn";
    runBtn.textContent = simulatorState.isRunning ? "Running..." : "Run Simulation";
    runBtn.disabled = simulatorState.isRunning;
    const stopBtn = document.createElement("button");
    stopBtn.className = "menuBtn";
    stopBtn.textContent = "Cancel";
    stopBtn.disabled = !simulatorState.isRunning;

    const runSweepBtn = document.createElement("button");
    runSweepBtn.className = "menuBtn";
    runSweepBtn.textContent = simulatorState.isRunning ? "Running..." : "Run sweep";
    runSweepBtn.disabled = simulatorState.isRunning;

    function buildBaseRunQuery() {
      return {
        iterations: String(simulatorState.iterations),
        seed: String(simulatorState.seed),
        maxTurns: String(simulatorState.maxTurns),
        startingLife: String(simulatorState.startingLife),
        log: simulatorState.logMode,
        includeSampleLog: "1",
        summoningSickness: simulatorState.summoningSickness ? "1" : "0",
        noBlockAfterAttacking: simulatorState.noBlockAfterAttacking ? "1" : "0",
        smartBlocking: simulatorState.smartBlocking ? "1" : "0",
        smartAttacking: simulatorState.smartAttacking ? "1" : "0",
        attackCertainty: String(simulatorState.attackCertainty),
        defendCertainty: String(simulatorState.defendCertainty),
        aiDebugDecisions: simulatorState.aiDebugDecisions ? "1" : "0"
      };
    }

    async function executeSimulationRun({ isSweep }) {
      const qs = new URLSearchParams({
        ...buildBaseRunQuery(),
        sweepEnabled: isSweep ? "1" : "0",
        sweepToggleKey: String(simulatorState.sweepToggleKey || "smartBlocking"),
        sweepCertaintyKey: String(simulatorState.sweepCertaintyKey || "both"),
        sweepIterationsPerLane: String(simulatorState.sweepIterationsPerLane || simulatorState.iterations),
        sweepConcurrency: String(simulatorState.sweepConcurrency || 2),
        sweepToggleValues: "0,1",
        sweepFeatureKeys: Array.isArray(simulatorState.sweepFeatureKeys) ? simulatorState.sweepFeatureKeys.join(",") : "",
        sweepIncludeCombined: simulatorState.sweepIncludeCombined ? "1" : "0"
      });
      const resp = await fetch(`/api/sim/run?${qs.toString()}`, { signal: getAbortController().signal });
      const data = await resp.json();
      if (!resp.ok || !data?.ok) throw new Error(data?.error || `HTTP ${resp.status}`);
      return data;
    }

    runBtn.onclick = async () => {
      const deckA = getDeckById(simulatorState.deckAId);
      const deckB = getDeckById(simulatorState.deckBId);
      if (!deckA || !deckB) { simulatorState.lastError = "Please select both Deck A and Deck B."; renderApp(); return; }
      const mappedA = SimUI.resolveDeckToSimCards(deckA, "A", { parseManaCost, getCardDef });
      const mappedB = SimUI.resolveDeckToSimCards(deckB, "B", { parseManaCost, getCardDef });
      const unsupported = [...mappedA.unsupported, ...mappedB.unsupported];
      if (unsupported.length) { simulatorState.lastError = `Unsupported cards for sim: ${unsupported.slice(0, 12).join(", ")}${unsupported.length > 12 ? " ..." : ""}`; renderApp(); return; }
      if (!mappedA.cards.length || !mappedB.cards.length) { simulatorState.lastError = "Selected decks could not be resolved into simulator cards."; renderApp(); return; }

      simulatorState.isRunning = true;
      simulatorState.lastError = "";
      simulatorState.selectedReportText = "";
      simulatorState.runId = uid();
      simulatorState.startedAt = Date.now();
      renderApp();

      if (getAbortController()) getAbortController().abort();
      setAbortController(new AbortController());

      try {
        const data = await executeSimulationRun({ isSweep: false });

        simulatorState.finishedAt = Date.now();
        simulatorState.elapsedMs = simulatorState.finishedAt - simulatorState.startedAt;
        simulatorState.summary = data.summary || null;
        simulatorState.sampleGame = data.sampleGame || null;
        simulatorState.runsMeta = Array.isArray(data.runsMeta) ? data.runsMeta : [];
        simulatorState.lastRawResult = data;
        simulatorState.sweepSummary = data.sweepSummary || null;
        simulatorState.selectedRunSeed = simulatorState.runsMeta[0]?.seed ?? simulatorState.seed;
        simulatorState.selectedReportText = SimUI.formatSimGameReport(data.sampleGame, { deckAName: deckA.name || simulatorState.deckAId, deckBName: deckB.name || simulatorState.deckBId });
        if (isSimReportDebugEnabled()) {
          const turnVM = SimUI.buildTurnReportViewModel ? SimUI.buildTurnReportViewModel(simulatorState.sampleGame) : [];
          console.info("[sim-report-debug] finalized", {
            turns: turnVM.length,
            perTurn: turnVM.map((turn) => ({
              turn: turn.turnNumber,
              events: (turn.players || []).map((player) => ({ player: player.id, count: (player.actions || []).length })),
              snapshots: (turn.players || []).map((player) => ({ player: player.id, hasEot: !!player.eot })),
              hasCombat: (turn.players || []).some((player) => (player.actions || []).some((evt) => evt.kind === "attack" || evt.kind === "block" || evt.kind === "damage"))
            }))
          });
        }
        if (isDevParityEnabled()) {
          const hashBefore = SimUI.buildParityHash(SimUI.normalizeSimResult({ summary: data.summary, sampleGame: data.sampleGame, runsMeta: data.runsMeta }, simulatorState.iterations));
          const hashAfter = SimUI.buildParityHash(SimUI.normalizeSimResult(data, simulatorState.iterations));
          console.info("[SIM_PARITY]", hashBefore, hashAfter);
        }
      } catch (err) {
        if (err?.name === "AbortError") simulatorState.lastError = "Simulation cancelled.";
        else simulatorState.lastError = String(err?.message || err || "simulation failed");
      } finally {
        simulatorState.isRunning = false;
        setAbortController(null);
        persistPlayerSaveDebounced();
        renderApp();
      }
    };

    runSweepBtn.onclick = async () => {
      const deckA = getDeckById(simulatorState.deckAId);
      const deckB = getDeckById(simulatorState.deckBId);
      if (!deckA || !deckB) { simulatorState.lastError = "Please select both Deck A and Deck B."; renderApp(); return; }
      const strategyCount = (Array.isArray(simulatorState.sweepFeatureKeys) ? simulatorState.sweepFeatureKeys.length : 0)
        + ((simulatorState.sweepIncludeCombined && Array.isArray(simulatorState.sweepFeatureKeys) && simulatorState.sweepFeatureKeys.length > 1) ? 1 : 0);
      if (!strategyCount) { simulatorState.lastError = "Select at least one sweep strategy feature."; renderApp(); return; }
      if (simulatorState.sweepIterationsPerLane > 2000 || (strategyCount * 11 * simulatorState.sweepIterationsPerLane) > 30000) simulatorState.lastError = "Warning: selected sweep workload may be slow.";

      simulatorState.isRunning = true;
      simulatorState.selectedReportText = "";
      simulatorState.runId = uid();
      simulatorState.startedAt = Date.now();
      renderApp();

      if (getAbortController()) getAbortController().abort();
      setAbortController(new AbortController());

      try {
        const data = await executeSimulationRun({ isSweep: true });
        simulatorState.finishedAt = Date.now();
        simulatorState.elapsedMs = simulatorState.finishedAt - simulatorState.startedAt;
        simulatorState.summary = data.summary || null;
        simulatorState.sampleGame = data.sampleGame || null;
        simulatorState.runsMeta = Array.isArray(data.runsMeta) ? data.runsMeta : [];
        simulatorState.lastRawResult = data;
        simulatorState.sweepSummary = data.sweepSummary || null;
        simulatorState.selectedRunSeed = simulatorState.runsMeta[0]?.seed ?? simulatorState.seed;
        simulatorState.selectedReportText = SimUI.formatSimGameReport(data.sampleGame, { deckAName: deckA.name || simulatorState.deckAId, deckBName: deckB.name || simulatorState.deckBId });
      } catch (err) {
        if (err?.name === "AbortError") simulatorState.lastError = "Simulation cancelled.";
        else simulatorState.lastError = String(err?.message || err || "simulation failed");
      } finally {
        simulatorState.isRunning = false;
        setAbortController(null);
        persistPlayerSaveDebounced();
        renderApp();
      }
    };

    stopBtn.onclick = () => { if (getAbortController()) getAbortController().abort(); simulatorState.isRunning = false; simulatorState.lastError = "Simulation cancelled."; renderApp(); };
    btnRow.append(runBtn, runSweepBtn, stopBtn);

    const copyJsonBtn = document.createElement("button");
    copyJsonBtn.className = "menuBtn";
    copyJsonBtn.textContent = "Copy JSON";
    copyJsonBtn.onclick = async () => { if (!simulatorState.lastRawResult) return; try { await navigator.clipboard.writeText(JSON.stringify(simulatorState.lastRawResult, null, 2)); } catch {} };
    const copyReportBtn = document.createElement("button");
    copyReportBtn.className = "menuBtn";
    copyReportBtn.textContent = "Copy Report";
    copyReportBtn.onclick = async () => { if (!simulatorState.selectedReportText) return; try { await navigator.clipboard.writeText(simulatorState.selectedReportText); } catch {} };
    btnRow.append(copyJsonBtn, copyReportBtn);
    panel.appendChild(btnRow);

    if (global.DEBUG_SCROLL) {
      const debugRow = document.createElement("div");
      debugRow.className = "simButtons";
      const jumpBtn = document.createElement("button");
      jumpBtn.className = "menuBtn";
      jumpBtn.textContent = "DEBUG: scroll down 200px";
      jumpBtn.onclick = () => {
        panel.scrollTop += 200;
        console.info("[scroll-debug:simulator] jump", { scrollTop: panel.scrollTop });
      };
      const probeBtn = document.createElement("button");
      probeBtn.className = "menuBtn";
      probeBtn.textContent = "DEBUG: probe center overlay";
      probeBtn.onclick = () => {
        const r = panel.getBoundingClientRect();
        const x = Math.round(r.left + r.width / 2);
        const y = Math.round(r.top + r.height / 2);
        const el = document.elementFromPoint(x, y);
        const inside = !!el && panel.contains(el);
        const cs = el ? window.getComputedStyle(el) : null;
        console.info("[scroll-debug:simulator] overlay-probe", {
          point: { x, y },
          insideScrollRoot: inside,
          hit: el ? `${el.tagName.toLowerCase()}#${el.id || ""}.${(el.className || "").toString().replace(/\s+/g, ".")}` : null,
          zIndex: cs?.zIndex || null,
          pointerEvents: cs?.pointerEvents || null
        });
      };
      debugRow.append(jumpBtn, probeBtn);
      panel.appendChild(debugRow);
    }

    if (simulatorState.isRunning) {
      const running = document.createElement("div");
      running.className = "zoneMeta";
      running.textContent = `Running job ${simulatorState.runId}...`;
      panel.appendChild(running);
    }

    if (simulatorState.lastError) {
      const err = document.createElement("div");
      err.className = "dbWarning";
      err.textContent = simulatorState.lastError;
      panel.appendChild(err);
    }

    if (simulatorState.summary) {
      const sum = simulatorState.summary;
      const winRateA = sum.games ? ((sum.winsA / sum.games) * 100).toFixed(2) : "0.00";
      const winRateB = sum.games ? ((sum.winsB / sum.games) * 100).toFixed(2) : "0.00";
      const kpis = document.createElement("div");
      kpis.className = "simKpis";
      const turn1Avg = sum?.eotAveragesByTurn?.["1"];
      [`Games: ${sum.games}`, `A wins: ${sum.winsA} (${winRateA}%)`, `B wins: ${sum.winsB} (${winRateB}%)`, `Draws: ${sum.draws}`, `Avg turns: ${Number(sum.avgTurns || 0).toFixed(2)}`, `Median turns: ${sum.medianTurns}`, `T1 EoT hand avg: ${turn1Avg ? Number(turn1Avg.avgHandSize || 0).toFixed(2) : "n/a"}`, `T1 dead-turn rate: ${sum?.deadTurnRateByTurn?.["1"] != null ? `${(Number(sum.deadTurnRateByTurn["1"]) * 100).toFixed(1)}%` : "n/a"}`, `Elapsed: ${simulatorState.elapsedMs}ms`].forEach((txt) => {
        const chip = document.createElement("div"); chip.className = "dbChip"; chip.textContent = txt; kpis.appendChild(chip);
      });
      panel.appendChild(kpis);

      const winPoints = SimUI.computeWinrateSeries(simulatorState.runsMeta, simulatorState.iterations);
      if (winPoints.length >= 2) {
        const chartWrap = document.createElement("div");
        chartWrap.className = "simChartWrap";
        chartWrap.innerHTML = `<div class="simChartHead"><strong>Winrate by iteration count</strong><div class="simLegend"><span class="simLegendA">A</span><span class="simLegendB">B</span></div></div>${SimUI.renderWinrateSvg(winPoints)}`;
        panel.appendChild(chartWrap);
      }

      const sweepLanes = Array.isArray(simulatorState.sweepSummary?.lanes) ? simulatorState.sweepSummary.lanes : [];
      const sweepSeries = SimUI.computeSweepSeries ? SimUI.computeSweepSeries(sweepLanes) : [];
      if (sweepSeries.length) {
        const strategyList = sweepSeries.map((s) => `<div>- ${s.label}</div>`).join("");
        const chartWrap = document.createElement("div");
        chartWrap.className = "simChartWrap";
        chartWrap.innerHTML = `<div class="simChartHead"><strong>Deck A success rate vs certainty (strategy sweep)</strong><div class="zoneMeta">Strategies:${strategyList}</div><div class="simLegend">${sweepSeries.map((s) => `<span style="color:${s.color}">${s.label}</span>`).join("")}</div></div>${SimUI.renderSweepWinrateSvg(sweepSeries)}`;
        panel.appendChild(chartWrap);
      }

      const tableWrap = document.createElement("div");
      tableWrap.className = "simTableWrap";
      const table = document.createElement("table");
      table.className = "simTable";
      table.innerHTML = `<thead><tr><th>Side</th><th>Card</th><th>Drawn</th><th>Played</th><th>Died</th><th>Kills</th><th>Damage</th></tr></thead>`;
      const tbody = document.createElement("tbody");
      [["A", sum.cardStats?.A || {}], ["B", sum.cardStats?.B || {}]].forEach(([side, map]) => {
        Object.entries(map).forEach(([name, stat]) => {
          const tr = document.createElement("tr");
          tr.innerHTML = `<td>${side}</td><td>${name}</td><td>${stat.timesDrawn || 0}</td><td>${stat.timesPlayed || 0}</td><td>${stat.timesDied || 0}</td><td>${stat.killsMade || 0}</td><td>${stat.damageToPlayer || 0}</td>`;
          tbody.appendChild(tr);
        });
      });
      table.appendChild(tbody);
      tableWrap.appendChild(table);
      panel.appendChild(tableWrap);

      if (Array.isArray(simulatorState.runsMeta) && simulatorState.runsMeta.length) {
        const runSelWrap = document.createElement("div");
        runSelWrap.className = "simField";
        const lbl = document.createElement("label");
        lbl.className = "zoneMeta";
        lbl.textContent = "Single game report";
        const select = document.createElement("select");
        select.className = "menuInput";
        simulatorState.runsMeta.slice(0, 200).forEach((run) => {
          const opt = document.createElement("option");
          opt.value = String(run.seed);
          opt.textContent = `#${run.index} seed=${run.seed} winner=${run.winner} turns=${run.turns}`;
          if (Number(simulatorState.selectedRunSeed) === Number(run.seed)) opt.selected = true;
          select.appendChild(opt);
        });
        const loadBtn = document.createElement("button");
        loadBtn.className = "menuBtn";
        loadBtn.textContent = "Load report";
        loadBtn.onclick = async () => {
          const seedVal = Number(select.value);
          simulatorState.selectedRunSeed = seedVal;
          const deckA = getDeckById(simulatorState.deckAId);
          const deckB = getDeckById(simulatorState.deckBId);
          const qs = new URLSearchParams({ ...buildBaseRunQuery(), iterations: "1", seed: String(seedVal), sweepEnabled: "0" });
          const resp = await fetch(`/api/sim/run?${qs.toString()}`);
          const data = await resp.json();
          if (!resp.ok || !data?.ok) simulatorState.lastError = data?.error || `HTTP ${resp.status}`;
          else {
            simulatorState.sampleGame = data.sampleGame || null;
            simulatorState.selectedReportText = SimUI.formatSimGameReport(data.sampleGame, { deckAName: deckA?.name || simulatorState.deckAId, deckBName: deckB?.name || simulatorState.deckBId });
            simulatorState.lastError = "";
            if (isSimReportDebugEnabled()) {
              const turnVM = SimUI.buildTurnReportViewModel ? SimUI.buildTurnReportViewModel(simulatorState.sampleGame) : [];
              console.info("[sim-report-debug] load-report", { turns: turnVM.length, firstTurnKeys: Object.keys(turnVM[0] || {}) });
            }
          }
          renderApp();
        };
        runSelWrap.append(lbl, select, loadBtn);
        panel.appendChild(runSelWrap);
      }

      const reportTools = document.createElement("div");
      reportTools.className = "simReportTools";
      const search = document.createElement("input");
      search.className = "menuInput";
      search.placeholder = "Search actions/status";
      search.value = simulatorState.reportSearch || "";
      search.oninput = () => SimUI.simControls.updateSearch(simulatorState, search.value, renderApp);
      const deadOnly = document.createElement("label");
      deadOnly.className = "zoneMeta";
      const deadChk = document.createElement("input");
      deadChk.type = "checkbox";
      deadChk.checked = !!simulatorState.reportShowOnlyDeadTurns;
      deadChk.onchange = () => SimUI.simControls.updateToggle(simulatorState, "reportShowOnlyDeadTurns", deadChk.checked, renderApp);
      deadOnly.append(deadChk, document.createTextNode(" Dead turns only"));
      const compactOnly = document.createElement("label");
      compactOnly.className = "zoneMeta";
      const compactChk = document.createElement("input");
      compactChk.type = "checkbox";
      compactChk.checked = !!simulatorState.reportCompactActions;
      compactChk.onchange = () => SimUI.simControls.updateToggle(simulatorState, "reportCompactActions", compactChk.checked, renderApp);
      compactOnly.append(compactChk, document.createTextNode(" Compact actions"));
      const debugOnly = document.createElement("label");
      debugOnly.className = "zoneMeta";
      const debugChk = document.createElement("input");
      debugChk.type = "checkbox";
      debugChk.checked = !!simulatorState.reportDebugEnabled;
      debugChk.setAttribute("aria-label", "Toggle simulator report debug panel");
      debugChk.onchange = () => {
        simulatorState.reportDebugEnabled = !!debugChk.checked;
        global.__SIM_REPORT_DEBUG__ = !!debugChk.checked;
        renderApp();
      };
      debugOnly.append(debugChk, document.createTextNode(" Debug panel"));
      reportTools.append(search, deadOnly, compactOnly, debugOnly);
      panel.appendChild(reportTools);

      const report = document.createElement("div");
      report.className = "simStatusReport";
      const vm = SimUI.normalizeSimResult({ sampleGame: simulatorState.sampleGame, runsMeta: simulatorState.runsMeta, summary: simulatorState.summary }, simulatorState.iterations);
      const turnVM = SimUI.buildTurnReportViewModel ? SimUI.buildTurnReportViewModel(simulatorState.sampleGame) : [];
      const searchNeedle = String(simulatorState.reportSearch || "").trim().toLowerCase();
      const filteredTurns = turnVM.filter((turn) => {
        if (!simulatorState.reportShowOnlyDeadTurns) return !searchNeedle || JSON.stringify(turn).toLowerCase().includes(searchNeedle);
        const hasDead = (turn.players || []).some((player) => player?.eot?.deadTurn);
        if (!hasDead) return false;
        if (!searchNeedle) return true;
        return JSON.stringify(turn).toLowerCase().includes(searchNeedle);
      });

      if (isSimReportDebugEnabled()) {
        const debugTurns = filteredTurns.map((turn) => ({
          turn: turn.turnNumber,
          players: turn.players.length,
          eventCount: turn.players.reduce((acc, p) => acc + ((p.actions || []).length), 0),
          snapshots: turn.players.map((p) => ({ player: p.id, hasEot: !!p.eot })),
          combat: turn.players.some((p) => (p.actions || []).some((evt) => evt.kind === "attack" || evt.kind === "block" || evt.kind === "damage"))
        }));
        console.info("[sim-report-debug] ui-received", {
          turnCount: filteredTurns.length,
          firstTurnKeys: Object.keys(filteredTurns[0] || {}),
          turns: debugTurns
        });
      }

      if (!filteredTurns.length) {
        const empty = document.createElement("div");
        empty.className = "zoneMeta";
        empty.textContent = "No turns match current filters.";
        report.appendChild(empty);
      } else {
        filteredTurns.forEach((turn, turnIdx) => {
          const row = document.createElement("section");
          row.className = "simTurnCard";
          if (turnIdx % 2 === 1) row.classList.add("simTurnCardAlt");

          const title = document.createElement("h2");
          title.className = "simTurnTitle";
          title.textContent = `Turn ${turn.turnNumber} — Active: ${turn.activePlayer}`;
          row.appendChild(title);

          const grid = document.createElement("div");
          grid.className = "simTurnColumns";

          (turn.players || []).forEach((player) => {
            const col = document.createElement("article");
            col.className = "simTurnPlayerCol";
            const h3 = document.createElement("h3");
            h3.className = "simPlayerTitle";
            h3.textContent = player.id;
            col.appendChild(h3);

            const actionSection = document.createElement("section");
            actionSection.className = "simActionSection";
            actionSection.innerHTML = "<h4>Actions this turn</h4>";
            const ul = document.createElement("ul");
            ul.className = "simActionList";
            (player.actions || []).forEach((evt, evtIdx) => {
              const li = document.createElement("li");
              li.className = `simActionItem simAction-${evt.kind || "misc"}`;
              li.dataset.key = `${turn.turnNumber}:${player.id}:${evtIdx}`;
              const badge = document.createElement("span");
              badge.className = "simEventBadge";
              badge.textContent = reportEventBadge(evt.kind);
              const txt = document.createElement("span");
              txt.className = "simEventText";
              txt.textContent = evt.text || evt.raw?.type || "event";
              li.append(badge, txt);
              ul.appendChild(li);
            });
            if (!ul.childElementCount) {
              const emptyEvt = document.createElement("li");
              emptyEvt.className = "simActionItem simAction-muted";
              emptyEvt.textContent = "No actions";
              ul.appendChild(emptyEvt);
            }
            actionSection.appendChild(ul);
            col.appendChild(actionSection);

            const eot = document.createElement("section");
            eot.className = "simSnapshotSection";
            eot.innerHTML = "<h4>EoT Snapshot</h4>";
            if (!player.eot) {
              const miss = document.createElement("div");
              miss.className = "dbWarning";
              miss.textContent = "Snapshot missing";
              eot.appendChild(miss);
            } else {
              const life = document.createElement("div");
              life.className = "simLifePill";
              life.textContent = `Life ${player.eot.life}`;
              eot.appendChild(life);

              const chips = document.createElement("div");
              chips.className = "simSnapshotChips";
              [`Hand ${player.eot.hand}`, `Deck ${player.eot.deck}`, `GY ${player.eot.graveyard}`, `Board ${player.eot.battlefield}`, `Trees ${player.eot.lands}`, `Animals ${player.eot.creatures}`].forEach((txt) => {
                const chip = document.createElement("span");
                chip.className = "dbChip";
                chip.textContent = txt;
                chips.appendChild(chip);
              });
              eot.appendChild(chips);
            }
            col.appendChild(eot);

            if (isSimReportDebugEnabled()) {
              const d = document.createElement("details");
              d.className = "simDebugTurn";
              const s = document.createElement("summary");
              s.setAttribute("aria-label", `Toggle debug JSON for turn ${turn.turnNumber} ${player.id}`);
              s.textContent = "Debug JSON";
              const pre = document.createElement("pre");
              pre.className = "simReport";
              pre.textContent = JSON.stringify(player.summary || {}, null, 2);
              d.append(s, pre);
              col.appendChild(d);
            }

            grid.appendChild(col);
          });

          row.appendChild(grid);
          report.appendChild(row);
        });
      }

      if (isSimReportDebugEnabled()) {
        console.info("[sim-report-debug] sim-output", {
          metrics: vm.metrics,
          turns: (turnVM || []).map((turn) => ({
            turn: turn.turnNumber,
            events: (turn.players || []).map((player) => ({ player: player.id, events: (player.actions || []).length })),
            snapshots: (turn.players || []).map((player) => ({ player: player.id, hasEot: !!player.eot })),
            hasCombat: (turn.players || []).some((player) => (player.actions || []).some((evt) => evt.kind === "attack" || evt.kind === "block" || evt.kind === "damage"))
          }))
        });
      }
      panel.appendChild(report);
    }

    wrap.appendChild(panel);
    rootNode.replaceChildren(wrap);
    SimUI.assertScrollRoot();
    SimUI.installScrollDebug?.("simulator", panel);
  }

  SimUI.mountSimulator = ({ containerEl, apiBaseUrl, initialDeckId, devFlags, context }) => {
    void apiBaseUrl; void initialDeckId; void devFlags;
    return renderSimulatorMode(containerEl, context);
  };
  SimUI.unmountSimulator = () => {};
})(window);

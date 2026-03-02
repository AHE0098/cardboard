(function initSimController(global) {
  const SimUI = (global.SimUI = global.SimUI || {});
  function isDevParityEnabled() {
    try { return new URLSearchParams(global.location.search || "").get("dev") === "1"; } catch { return false; }
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
        const qs = new URLSearchParams({ iterations: String(simulatorState.iterations), seed: String(simulatorState.seed), maxTurns: String(simulatorState.maxTurns), startingLife: String(simulatorState.startingLife), log: simulatorState.logMode, includeSampleLog: "1" });
        const resp = await fetch(`/api/sim/run?${qs.toString()}`, { signal: getAbortController().signal });
        const data = await resp.json();
        if (!resp.ok || !data?.ok) throw new Error(data?.error || `HTTP ${resp.status}`);

        simulatorState.finishedAt = Date.now();
        simulatorState.elapsedMs = simulatorState.finishedAt - simulatorState.startedAt;
        simulatorState.summary = data.summary || null;
        simulatorState.sampleGame = data.sampleGame || null;
        simulatorState.runsMeta = Array.isArray(data.runsMeta) ? data.runsMeta : [];
        simulatorState.lastRawResult = data;
        simulatorState.selectedRunSeed = simulatorState.runsMeta[0]?.seed ?? simulatorState.seed;
        simulatorState.selectedReportText = SimUI.formatSimGameReport(data.sampleGame, { deckAName: deckA.name || simulatorState.deckAId, deckBName: deckB.name || simulatorState.deckBId });
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

    stopBtn.onclick = () => { if (getAbortController()) getAbortController().abort(); simulatorState.isRunning = false; simulatorState.lastError = "Simulation cancelled."; renderApp(); };
    btnRow.append(runBtn, stopBtn);

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
          const qs = new URLSearchParams({ iterations: "1", seed: String(seedVal), maxTurns: String(simulatorState.maxTurns), startingLife: String(simulatorState.startingLife), log: simulatorState.logMode, includeSampleLog: "1" });
          const resp = await fetch(`/api/sim/run?${qs.toString()}`);
          const data = await resp.json();
          if (!resp.ok || !data?.ok) simulatorState.lastError = data?.error || `HTTP ${resp.status}`;
          else {
            simulatorState.sampleGame = data.sampleGame || null;
            simulatorState.selectedReportText = SimUI.formatSimGameReport(data.sampleGame, { deckAName: deckA?.name || simulatorState.deckAId, deckBName: deckB?.name || simulatorState.deckBId });
            simulatorState.lastError = "";
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
      reportTools.append(search, deadOnly, compactOnly);
      panel.appendChild(reportTools);

      const report = document.createElement("div");
      report.className = "simStatusReport";
      const vm = SimUI.normalizeSimResult({ sampleGame: simulatorState.sampleGame, runsMeta: simulatorState.runsMeta, summary: simulatorState.summary }, simulatorState.iterations);
      const searchNeedle = String(simulatorState.reportSearch || "").trim().toLowerCase();
      const filteredPairs = vm.turnRows.filter((pair) => {
        const snap = pair.summary?.eotSnapshot;
        if (simulatorState.reportShowOnlyDeadTurns && !snap?.flags?.deadTurn) return false;
        if (!searchNeedle) return true;
        const hay = JSON.stringify(pair.summary || {}).toLowerCase();
        return hay.includes(searchNeedle);
      });

      if (!filteredPairs.length) {
        const empty = document.createElement("div");
        empty.className = "zoneMeta";
        empty.textContent = "No turn rows match current filters.";
        report.appendChild(empty);
      } else {
        filteredPairs.forEach((pair) => {
          const key = `${pair.turn}:${pair.player}`;
          const row = document.createElement("section");
          row.className = "simTurnRow";
          const head = document.createElement("button");
          head.className = "simTurnHead";
          head.type = "button";
          const snap = pair.summary?.eotSnapshot;
          head.textContent = `Turn ${pair.turn} • ${pair.player} • ${snap?.flags?.deadTurn ? "dead turn" : "active"}`;
          head.onclick = () => { simulatorState.reportExpandedTurns[key] = !simulatorState.reportExpandedTurns[key]; renderApp(); };
          row.appendChild(head);

          const grid = document.createElement("div");
          grid.className = "simTurnGrid";
          const left = document.createElement("div");
          left.className = "simTurnCol";
          left.innerHTML = '<h4>New Actions</h4>';
          ["DRAW_STEP", "MAIN_PHASE", "COMBAT_STEP", "END_STEP"].forEach((phase) => {
            const actions = pair.summary?.actionsByPhase?.[phase] || [];
            if (!actions.length) return;
            const phaseEl = document.createElement("div");
            phaseEl.className = "simPhaseGroup";
            const title = document.createElement("div");
            title.className = "zoneMeta";
            title.textContent = phase.replace("_", " ");
            phaseEl.appendChild(title);
            const ul = document.createElement("ul");
            actions.forEach((evt) => { const li = document.createElement("li"); li.textContent = SimUI.simEventLabel(evt, !!simulatorState.reportCompactActions); ul.appendChild(li); });
            phaseEl.appendChild(ul);
            left.appendChild(phaseEl);
          });

          const right = document.createElement("div");
          right.className = "simTurnCol";
          right.innerHTML = '<h4>End-of-Turn Status</h4>';
          if (!snap) {
            const miss = document.createElement("div");
            miss.className = "dbWarning";
            miss.textContent = "Snapshot missing";
            right.appendChild(miss);
          } else {
            const chips = document.createElement("div");
            chips.className = "simKpis";
            [`Life ${snap.life}`, `Hand ${snap.zones.handSize}`, `Deck ${snap.zones.deckSize}`, `Grave ${snap.zones.graveyardSize}`, `Board ${snap.zones.battlefieldCount}`, `Power ${snap.combat.totalCreaturePower}`, `Mana ${snap.tempo.manaSpent}/${snap.tempo.manaAvailable}`].forEach((txt) => {
              const chip = document.createElement("div"); chip.className = "dbChip"; chip.textContent = txt; chips.appendChild(chip);
            });
            right.appendChild(chips);

            const details = document.createElement("details");
            details.open = !!simulatorState.reportExpandedTurns[key];
            const summary = document.createElement("summary");
            summary.textContent = "Show details";
            const pre = document.createElement("pre");
            pre.className = "simReport";
            pre.textContent = JSON.stringify(snap, null, 2);
            details.append(summary, pre);
            right.appendChild(details);
          }

          grid.append(left, right);
          row.appendChild(grid);
          report.appendChild(row);
        });
      }
      panel.appendChild(report);
    }

    wrap.appendChild(panel);
    rootNode.replaceChildren(wrap);
    SimUI.assertScrollRoot();
  }

  SimUI.mountSimulator = ({ containerEl, apiBaseUrl, initialDeckId, devFlags, context }) => {
    void apiBaseUrl; void initialDeckId; void devFlags;
    return renderSimulatorMode(containerEl, context);
  };
  SimUI.unmountSimulator = () => {};
})(window);

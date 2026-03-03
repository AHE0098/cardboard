(function initSimWinrateGraph(global) {
  const SimUI = (global.SimUI = global.SimUI || {});

  function computeWinrateSeries(runsMeta, iterations) {
    if (!Array.isArray(runsMeta) || !runsMeta.length) return [];
    const totalRuns = Math.max(1, Math.min(Number(iterations) || runsMeta.length, runsMeta.length));
    const checkpoints = new Set([1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, totalRuns].filter((n) => n <= totalRuns));
    let winsA = 0;
    let winsB = 0;
    const series = [];
    for (let i = 0; i < totalRuns; i += 1) {
      const winner = runsMeta[i]?.winner;
      if (winner === "A") winsA += 1;
      else if (winner === "B") winsB += 1;
      const n = i + 1;
      if (checkpoints.has(n)) {
        series.push({ n, a: Number(((winsA / n) * 100).toFixed(2)), b: Number(((winsB / n) * 100).toFixed(2)) });
      }
    }
    return series;
  }

  function renderWinrateSvg(series) {
    if (!Array.isArray(series) || series.length < 2) return "";
    const width = 620;
    const height = 240;
    const pad = { left: 48, right: 16, top: 18, bottom: 28 };
    const xMin = series[0].n;
    const xMax = series[series.length - 1].n;
    const innerWidth = width - pad.left - pad.right;
    const innerHeight = height - pad.top - pad.bottom;
    const xAt = (n) => pad.left + (((n - xMin) / Math.max(1, xMax - xMin)) * innerWidth);
    const yAt = (pct) => pad.top + ((100 - pct) / 100) * innerHeight;
    const pathFor = (key) => series.map((p, idx) => `${idx === 0 ? "M" : "L"}${xAt(p.n).toFixed(2)},${yAt(p[key]).toFixed(2)}`).join(" ");
    const yTicks = [0, 25, 50, 75, 100];
    const xTicks = Array.from(new Set([xMin, ...series.slice(1, -1).map((p) => p.n), xMax])).slice(0, 7);
    return `<svg viewBox="0 0 ${width} ${height}" class="simChart" role="img" aria-label="Winrate chart">
      ${yTicks.map((v) => `<line x1="${pad.left}" x2="${width - pad.right}" y1="${yAt(v)}" y2="${yAt(v)}" stroke="rgba(255,255,255,0.08)" />`).join("")}
      ${xTicks.map((n) => `<line x1="${xAt(n)}" x2="${xAt(n)}" y1="${pad.top}" y2="${height - pad.bottom}" stroke="rgba(255,255,255,0.05)" />`).join("")}
      <path d="${pathFor("a")}" fill="none" stroke="#56d1ff" stroke-width="2.5" />
      <path d="${pathFor("b")}" fill="none" stroke="#ff7c8f" stroke-width="2.5" />
      ${yTicks.map((v) => `<text x="${pad.left - 8}" y="${yAt(v) + 4}" text-anchor="end" fill="rgba(255,255,255,0.7)" font-size="11">${v}%</text>`).join("")}
      ${xTicks.map((n) => `<text x="${xAt(n)}" y="${height - 8}" text-anchor="middle" fill="rgba(255,255,255,0.7)" font-size="11">${n}</text>`).join("")}
    </svg>`;
  }

  function computeSweepSeries(lanes) {
    if (!Array.isArray(lanes) || !lanes.length) return [];
    const grouped = new Map();
    lanes.forEach((lane) => {
      const strategyIndex = Number.isFinite(Number(lane?.strategyIndex)) ? Number(lane.strategyIndex) : null;
      const key = strategyIndex == null ? (lane?.toggleValue ? "on" : "off") : `strategy:${strategyIndex}`;
      const label = lane?.strategyName || (lane?.toggleValue ? "Toggle ON" : "Toggle OFF");
      if (!grouped.has(key)) grouped.set(key, { key, label, points: [] });
      grouped.get(key).points.push({
        certaintyPct: Number(lane?.certaintyPct || 0),
        winRatePct: Number(lane?.deckA_winRate || 0) * 100
      });
    });
    const palette = ["#67d17e", "#f4af55", "#56d1ff", "#ff7c8f", "#c59bff", "#ffd166", "#8bd3dd"];
    return Array.from(grouped.values()).map((series, idx) => ({
      key: series.key,
      label: series.label,
      color: palette[idx % palette.length],
      points: series.points.sort((a, b) => a.certaintyPct - b.certaintyPct)
    }));
  }

  function renderSweepWinrateSvg(series) {
    if (!Array.isArray(series) || !series.length) return "";
    const width = 620;
    const height = 260;
    const pad = { left: 48, right: 16, top: 18, bottom: 34 };
    const innerWidth = width - pad.left - pad.right;
    const innerHeight = height - pad.top - pad.bottom;
    const xAt = (pct) => pad.left + ((Math.max(0, Math.min(100, pct)) / 100) * innerWidth);
    const yAt = (pct) => pad.top + ((100 - Math.max(0, Math.min(100, pct))) / 100) * innerHeight;
    const yTicks = [0, 25, 50, 75, 100];
    const xTicks = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    const pathFor = (points) => points.map((p, idx) => `${idx === 0 ? "M" : "L"}${xAt(p.certaintyPct).toFixed(2)},${yAt(p.winRatePct).toFixed(2)}`).join(" ");
    return `<svg viewBox="0 0 ${width} ${height}" class="simChart" role="img" aria-label="Deck A success rate by certainty sweep">
      ${yTicks.map((v) => `<line x1="${pad.left}" x2="${width - pad.right}" y1="${yAt(v)}" y2="${yAt(v)}" stroke="rgba(255,255,255,0.08)" />`).join("")}
      ${xTicks.map((v) => `<line x1="${xAt(v)}" x2="${xAt(v)}" y1="${pad.top}" y2="${height - pad.bottom}" stroke="rgba(255,255,255,0.05)" />`).join("")}
      ${series.map((s) => `<path d="${pathFor(s.points)}" fill="none" stroke="${s.color}" stroke-width="2.5" />`).join("")}
      ${series.map((s) => s.points.map((p) => `<circle cx="${xAt(p.certaintyPct)}" cy="${yAt(p.winRatePct)}" r="3" fill="${s.color}" />`).join("")).join("")}
      ${yTicks.map((v) => `<text x="${pad.left - 8}" y="${yAt(v) + 4}" text-anchor="end" fill="rgba(255,255,255,0.7)" font-size="11">${v}%</text>`).join("")}
      ${xTicks.map((v) => `<text x="${xAt(v)}" y="${height - 8}" text-anchor="middle" fill="rgba(255,255,255,0.7)" font-size="11">${v}</text>`).join("")}
    </svg>`;
  }

  SimUI.computeWinrateSeries = computeWinrateSeries;
  SimUI.renderWinrateSvg = renderWinrateSvg;
  SimUI.computeSweepSeries = computeSweepSeries;
  SimUI.renderSweepWinrateSvg = renderSweepWinrateSvg;
})(window);

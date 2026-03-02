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

  SimUI.computeWinrateSeries = computeWinrateSeries;
  SimUI.renderWinrateSvg = renderWinrateSvg;
})(window);

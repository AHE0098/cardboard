(function initSimReportRenderer(global) {
  const SimUI = (global.SimUI = global.SimUI || {});

  function formatSimGameReport(game, meta) {
    if (!game) return "No game selected.";
    const lines = ["Simulation Report", `Seed: ${game.seed} | Winner: ${game.winner} | Turns: ${game.turns} | End: ${game.endedReason}`, `Deck A: ${meta.deckAName || "A"} | Deck B: ${meta.deckBName || "B"}`, `Final Life: A=${game?.finalLife?.A ?? "?"} B=${game?.finalLife?.B ?? "?"}`, ""];
    const byTurn = game.turnSummaries || {};
    Object.keys(byTurn).sort((a, b) => Number(a) - Number(b)).forEach((turnKey) => {
      lines.push(`Turn ${turnKey}`);
      const perPlayer = byTurn[turnKey] || {};
      Object.keys(perPlayer).sort().forEach((player) => {
        const row = perPlayer[player] || {};
        lines.push(`  ${player}`);
        ["DRAW_STEP", "MAIN_PHASE", "COMBAT_STEP", "END_STEP"].forEach((phase) => {
          const actions = row?.actionsByPhase?.[phase] || [];
          if (!actions.length) return;
          lines.push(`    ${phase}:`);
          actions.forEach((evt) => lines.push(`      - ${evt.type}`));
        });
        const snap = row.eotSnapshot;
        if (!snap) lines.push("    Snapshot missing");
        else lines.push(`    EoT hand=${snap.zones.handSize} deck=${snap.zones.deckSize} grave=${snap.zones.graveyardSize} board=${snap.zones.battlefieldCount} life=${snap.life}`);
      });
      lines.push("");
    });
    return lines.join("\n");
  }

  function simEventLabel(evt, compact) {
    if (!evt) return "";
    if (compact) return evt.type || "event";
    if (evt.type === "draw") return `${evt.player} draws ${evt.card}`;
    if (evt.type === "play_land") return `${evt.player} plays ${evt.card}`;
    if (evt.type === "cast_creature") return `${evt.player} casts ${evt.card} (cost ${evt.cost})`;
    if (evt.type === "combat_start") return `${evt.attacker} attacks (${evt.attackers?.length || 0})`;
    if (evt.type === "blocked_combat") return `Block ${evt.attacker} vs ${evt.defender}`;
    if (evt.type === "unblocked_damage") return `${evt.attacker} -> ${evt.playerDamaged} for ${evt.amount}`;
    if (evt.type === "turn_end") return `${evt.player} end step snapshot`;
    return evt.type || "event";
  }

  SimUI.formatSimGameReport = formatSimGameReport;
  SimUI.simEventLabel = simEventLabel;
})(window);

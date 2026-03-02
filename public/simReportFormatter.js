(() => {
  const PHASE_LABELS = {
    DRAW_STEP: 'Draw Step',
    MAIN_PHASE: 'Main Phase',
    COMBAT_STEP: 'Combat Step',
    END_STEP: 'End Step',
    TURN_START: 'Turn Start'
  };

  function fmtEvent(evt) {
    switch (evt.eventType) {
      case 'draw':
        return `- ${evt.source === 'BASE_DRAW' ? 'Base Draw' : 'Extra Draw'}: ${evt.player} draws ${evt.card}`;
      case 'play_land':
        return `- Play Land: ${evt.player} plays ${evt.card}`;
      case 'cast_creature':
        return `- Cast Creature: ${evt.player} casts ${evt.card} (cost ${evt.cost})`;
      case 'combat_start':
        return `- Combat Start: ${evt.attacker} attacks with ${evt.attackers?.length || 0} creature(s)`;
      case 'blocked_combat':
        return `- Blocked: ${evt.attacker} vs ${evt.defender} (${evt.attackerDies ? 'attacker dies' : 'attacker lives'}, ${evt.defenderDies ? 'defender dies' : 'defender lives'})`;
      case 'unblocked_damage':
        return `- Unblocked Damage: ${evt.attacker} -> ${evt.playerDamaged} for ${evt.amount} (life ${evt.lifeAfter})`;
      case 'turn_end':
        return `- End Snapshot: hand=${evt.handSize}, lands=${evt.landsInPlay}, creatures=${evt.creaturesInPlay}`;
      case 'game_end_life_zero':
        return `- Game End: ${evt.winner} wins, ${evt.loser} at 0 life`;
      case 'game_end_max_turns':
        return '- Game End: draw by max turns';
      case 'deck_out':
        return `- Deck Out: ${evt.player}`;
      case 'violation':
        return `- VIOLATION: ${evt.message}`;
      default:
        return null;
    }
  }

  function formatSimulationReport(game, meta = {}) {
    if (!game) return 'No game selected.';
    const lines = [];
    lines.push('=== Simulation Report ===');
    lines.push(`Rules: ${meta.rulePath || 'rules/SIMULATION_RULES.md'} (${meta.ruleHash || 'n/a'})`);
    lines.push(`Seed=${game.seed} Winner=${game.winner} Turns=${game.turns} End=${game.endedReason}`);
    lines.push(`Deck A=${meta.deckAName || 'A'} | Deck B=${meta.deckBName || 'B'}`);
    lines.push(`Final Life A=${game?.finalLife?.A ?? '?'} B=${game?.finalLife?.B ?? '?'}`);
    lines.push('');

    const byTurn = new Map();
    (game.log || []).forEach((evt) => {
      const t = Number(evt.turn || 0);
      if (!byTurn.has(t)) byTurn.set(t, []);
      byTurn.get(t).push(evt);
    });

    [...byTurn.keys()].sort((a, b) => a - b).forEach((turn) => {
      lines.push(`Turn ${turn}`);
      const events = byTurn.get(turn) || [];
      const phases = { DRAW_STEP: [], MAIN_PHASE: [], COMBAT_STEP: [], END_STEP: [] };
      events.forEach((evt) => {
        const line = fmtEvent(evt);
        if (!line) return;
        const phase = evt.phase || 'END_STEP';
        if (!phases[phase]) phases[phase] = [];
        phases[phase].push(line);
      });

      ['DRAW_STEP', 'MAIN_PHASE', 'COMBAT_STEP', 'END_STEP'].forEach((phaseKey) => {
        lines.push(`  ${PHASE_LABELS[phaseKey] || phaseKey}`);
        const sub = phases[phaseKey] || [];
        if (!sub.length) lines.push('    - (no events)');
        else sub.forEach((entry) => lines.push(`    ${entry}`));
      });
      lines.push('');
    });

    if (Array.isArray(game.violations) && game.violations.length) {
      lines.push('Violations');
      game.violations.forEach((v) => lines.push(`  - Turn ${v.turn}: ${v.message}`));
      lines.push('');
    }

    return lines.join('\n');
  }

  window.formatSimulationReport = formatSimulationReport;
})();

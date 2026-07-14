import { createInitialState, advanceTurn } from '../src/engine/gameState';
import { resolveEventChoice } from '../src/engine/events';

function autoResolveEvents(state: ReturnType<typeof createInitialState>): void {
  // Cap to avoid infinite loops if resolved events are never pruned
  for (let guard = 0; guard < 20; guard++) {
    const pending = state.activeEvents.find(e => !e.resolved);
    if (!pending) break;
    resolveEventChoice(state, pending.eventId, 0);
  }
}

const nation = process.argv[2] ?? 'usa';
let s = createInitialState(nation);
console.log('start', nation);

for (let i = 0; i < 60; i++) {
  autoResolveEvents(s);
  if (s.gameOver || s.playerWon) {
    console.log('END', {
      turn: s.turn,
      reason: s.gameOverReason ?? s.winReason,
      decline: s.declineMode,
      morale: s.countries[nation]?.stats.moraleBase,
      regime: s.countries[nation]?.stats.regimeSecurity,
      exhaust: s.countries[nation]?.stats.warExhaustion,
      defenseBudget: s.countries[nation]?.stats.defenseBudget,
      tp: s.countries[nation]?.stats.treasuryPoints,
    });
    console.log('history:', s.history.slice(-10));
    process.exit(0);
  }
  s = advanceTurn(s);
  if ((i + 1) % 10 === 0) {
    console.log(`t${s.turn} tp=${s.countries[nation]?.stats.treasuryPoints.toFixed(0)} morale=${s.countries[nation]?.stats.moraleBase.toFixed(2)} decline=${s.declineMode} wars=${s.wars.length} unresolved=${s.activeEvents.filter(e => !e.resolved).length}`);
  }
}
console.log('survived', s.turn, 'tp', s.countries[nation]?.stats.treasuryPoints.toFixed(0));

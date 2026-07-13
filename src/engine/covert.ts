import type { GameState } from '../types/game';
import { modifyRelation } from '../data/relations';
import { getRegionsForCountry } from '../data/regions';
import {
  getCounterIntelDiscoveryBonus,
  getPlayerCovertDiscoveryReduction,
} from './propaganda';
import { tryExposeFromCounterIntel, resolveProbePactsOp } from './covertAlliances';

export function resolveCovertOps(state: GameState): void {
  const remaining = [];

  for (const op of state.activeCovertOps) {
    const turnsActive = state.turn - op.turnStarted;
    if (turnsActive < 1) {
      remaining.push(op);
      continue;
    }

    // Adjust discovery risk
    let discoveryChance = op.discoveryRiskPercent;
    if (op.targetNation === state.playerCountryId) {
      discoveryChance += getCounterIntelDiscoveryBonus(state);
    }
    if (op.sourceNation === state.playerCountryId) {
      const target = state.countries[op.targetNation];
      const targetCI = (target?.stats.regimeSecurity ?? 0.5) * 25;
      discoveryChance += targetCI - getPlayerCovertDiscoveryReduction(state);
    }

    const discovered = op.discovered || Math.random() * 100 < discoveryChance;
    const target = state.countries[op.targetNation];
    if (!target) continue;

    if (discovered) {
      op.discovered = true;
      applyCovertEffects(state, op, op.effectIfDiscovered, true);

      if (op.opKind === 'probe_pacts') {
        resolveProbePactsOp(state, op.sourceNation, op.targetNation);
      }

      if (op.targetNation === state.playerCountryId) {
        // Player counter-intel exposed enemy op — diplomatic win
        tryExposeFromCounterIntel(state, op.sourceNation, op.targetNation);
        state.history.push(
          `Turn ${state.turn}: Counter-intelligence EXPOSED ${state.countries[op.sourceNation]?.name}'s covert op!`
        );
        for (const allyId of Object.keys(state.countries)) {
          if (allyId === state.playerCountryId || allyId === op.sourceNation) continue;
          const rel = state.relations[[allyId, state.playerCountryId].sort().join('|')] ?? 0;
          if (rel > 30) {
            modifyRelation(state.relations, allyId, op.sourceNation, -12);
            modifyRelation(state.relations, allyId, state.playerCountryId, 5);
          }
        }
      } else {
        state.history.push(
          `Turn ${state.turn}: Covert op against ${target.name} was DISCOVERED!`
        );
      }
      if (op.effectIfDiscovered.relationsPenalty) {
        for (const countryId of Object.keys(state.countries)) {
          if (countryId === op.sourceNation) continue;
          const rel = state.relations[[countryId, op.targetNation].sort().join('|')] ?? 0;
          if (rel > 20) {
            modifyRelation(state.relations, countryId, op.sourceNation, op.effectIfDiscovered.relationsPenalty * 0.3);
          }
        }
      }
    } else {
      applyCovertEffects(state, op, op.effectIfHidden, false);
      if (op.opKind === 'probe_pacts') {
        resolveProbePactsOp(state, op.sourceNation, op.targetNation);
      } else {
        state.history.push(`Turn ${state.turn}: Covert op against ${target.name} succeeded (hidden).`);
      }
    }
  }

  state.activeCovertOps = remaining;
}

/** Occasional NPC covert ops against player (at war or hostile) */
export function runNpcCovertOps(state: GameState): void {
  if (Math.random() > 0.15) return;

  const playerId = state.playerCountryId;
  const hostiles = Object.keys(state.countries).filter(id => {
    if (id === playerId) return false;
    const rel = state.relations[[id, playerId].sort().join('|')] ?? 0;
    const atWar = state.wars.some(w => w.belligerents.includes(id) && w.belligerents.includes(playerId));
    return atWar || rel < -30;
  });

  if (hostiles.length === 0) return;

  const sourceId = hostiles[Math.floor(Math.random() * hostiles.length)];
  state.activeCovertOps.push({
    id: `npc_covert_${state.turn}_${sourceId}`,
    sourceNation: sourceId,
    targetNation: playerId,
    cost: 10,
    discoveryRiskPercent: 30,
    effectIfHidden: { targetMorale: -0.03, targetUnrest: 5 },
    effectIfDiscovered: { targetMorale: -0.01, relationsPenalty: -10 },
    turnStarted: state.turn,
    discovered: false,
  });
}

function applyCovertEffects(
  state: GameState,
  op: typeof state.activeCovertOps[0],
  effects: Record<string, number>,
  discovered: boolean
): void {
  const target = state.countries[op.targetNation];
  if (!target) return;

  const scale = discovered ? 0.5 : 1;

  if (effects.targetMorale) {
    target.stats.moraleBase = Math.max(0, target.stats.moraleBase + effects.targetMorale * scale);
  }
  if (effects.targetTechGrowth) {
    target.stats.gdpGrowth = Math.max(-0.05, target.stats.gdpGrowth + effects.targetTechGrowth * scale);
  }
  if (effects.targetUnrest) {
    for (const region of getRegionsForCountry(op.targetNation)) {
      region.unrest = Math.min(100, region.unrest + effects.targetUnrest * scale);
    }
  }
}

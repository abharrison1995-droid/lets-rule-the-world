import type { GameState } from '../types/game';
import { modifyRelation } from '../data/relations';
import { deductCost } from './actions';
import { computeIntelAgreementBonus } from './talks';
import { computeCovertIntelBonus } from './covertAlliances';

export function tickCounterIntel(state: GameState): void {
  const player = state.countries[state.playerCountryId];
  if (!player) return;

  const domestic = state.budget.domestic;
  const ciShare = state.domesticSplit.counterIntel;
  const boost = domestic * ciShare * 0.08
    + computeIntelAgreementBonus(state, state.playerCountryId)
    + computeCovertIntelBonus(state, state.playerCountryId);

  state.counterIntelLevel = Math.min(1, state.counterIntelLevel + boost);
  state.counterIntelLevel = Math.max(0, state.counterIntelLevel - 0.01);

  // Services slice maintains morale
  const servicesBoost = domestic * state.domesticSplit.services * 0.03;
  player.stats.moraleBase = Math.min(1, player.stats.moraleBase + servicesBoost * 0.02);
}

export function applyDomesticPropagandaTick(state: GameState): void {
  const player = state.countries[state.playerCountryId];
  if (!player) return;

  const domestic = state.budget.domestic;
  const propShare = state.domesticSplit.propaganda;
  if (domestic * propShare < 0.1) return;

  const effectiveness = 1 - player.stats.propagandaSaturation;
  const effect = domestic * propShare * 0.05 * effectiveness;

  player.stats.warPopularity = Math.min(1, player.stats.warPopularity + effect * 0.15);
  player.stats.moraleBase = Math.min(1, player.stats.moraleBase + effect * 0.08);
  player.stats.propagandaSaturation = Math.min(1, player.stats.propagandaSaturation + domestic * propShare * 0.03);
}

export function playerDomesticPropaganda(state: GameState): string | null {
  const player = state.countries[state.playerCountryId];
  if (!player) return 'Invalid player.';

  const cost = 15;
  if (!deductCost(state, cost)) return `Insufficient funds (need $${cost}B).`;

  const saturation = player.stats.propagandaSaturation;
  const effectiveness = Math.max(0.1, 1 - saturation);

  player.stats.warPopularity = Math.min(1, player.stats.warPopularity + 0.1 * effectiveness);
  player.stats.moraleBase = Math.min(1, player.stats.moraleBase + 0.05 * effectiveness);
  player.stats.regimeSecurity = Math.min(1, player.stats.regimeSecurity + 0.02 * effectiveness);
  player.stats.propagandaSaturation = Math.min(1, saturation + 0.12);

  if (saturation > 0.6) {
    state.history.push(`Turn ${state.turn}: Heavy propaganda spend — diminishing returns.`);
  } else {
    state.history.push(`Turn ${state.turn}: Domestic propaganda campaign launched.`);
  }

  return null;
}

export function playerForeignInfluence(state: GameState, targetNationId: string): string | null {
  if (targetNationId === state.playerCountryId) return 'Cannot target yourself.';
  const target = state.countries[targetNationId];
  if (!target) return 'Invalid target.';

  const cost = 20;
  if (!deductCost(state, cost)) return `Insufficient funds (need $${cost}B).`;

  const covertBonus = state.budget.covert * 5;
  modifyRelation(state.relations, state.playerCountryId, targetNationId, 8 + covertBonus);
  target.stats.warPopularity = Math.max(0, target.stats.warPopularity - 0.03);

  state.history.push(
    `Turn ${state.turn}: Foreign influence campaign targeted ${target.name}.`
  );
  return null;
}

export function getCounterIntelDiscoveryBonus(state: GameState): number {
  return state.counterIntelLevel * 35;
}

export function getPlayerCovertDiscoveryReduction(state: GameState): number {
  return state.counterIntelLevel * 15;
}

export function normalizeDomesticSplit(split: { propaganda: number; counterIntel: number; services: number }) {
  const total = split.propaganda + split.counterIntel + split.services;
  if (total === 0) return { propaganda: 0.4, counterIntel: 0.3, services: 0.3 };
  if (Math.abs(total - 1) < 0.01) return split;
  return {
    propaganda: split.propaganda / total,
    counterIntel: split.counterIntel / total,
    services: split.services / total,
  };
}

export const DEFAULT_DOMESTIC_SPLIT = { propaganda: 0.4, counterIntel: 0.3, services: 0.3 };

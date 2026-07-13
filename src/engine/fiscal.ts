import type { Country, GameState } from '../types/game';

/** Spendable treasury after debt drag */
export function getFiscalHeadroom(country: Country): number {
  const debt = country.debtToGdp ?? 0;
  const penalty = Math.min(0.55, debt * 0.28);
  return country.stats.treasuryPoints * (1 - penalty);
}

export function getDebtServicePerTurn(country: Country): number {
  const debt = country.debtToGdp ?? 0;
  if (debt <= 0) return 0;
  return country.stats.treasuryPoints * debt * 0.0012;
}

/** Liquid treasury available this turn (TP) */
export function getSpendingPool(state: GameState): number {
  const country = state.countries[state.playerCountryId];
  if (!country) return 0;
  return getFiscalHeadroom(country);
}

/** Effective TP cost after debt drag when spending */
export function getEffectiveSpendCost(country: Country, costTp: number): number {
  const debt = country.debtToGdp ?? 0;
  return costTp * (1 + Math.min(0.5, debt * 0.12));
}

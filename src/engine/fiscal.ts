import type { Country, GameState } from '../types/game';

/** GDP not locked up by debt servicing — spending power for the player */
export function getFiscalHeadroom(country: Country): number {
  const debt = country.debtToGdp ?? 0;
  const penalty = Math.min(0.55, debt * 0.28);
  return country.stats.gdp * (1 - penalty);
}

export function getDebtServicePerTurn(country: Country): number {
  const debt = country.debtToGdp ?? 0;
  if (debt <= 0) return 0;
  return country.stats.gdp * debt * 0.00015;
}

export function getStartingReserve(country: Country): number {
  const headroom = getFiscalHeadroom(country);
  const debt = country.debtToGdp ?? 0;
  const base = Math.min(headroom * 0.012, 200);
  const debtAdjustment = Math.max(8, 55 - debt * 18);
  return Math.round(base + debtAdjustment);
}

/** Liquid + allocatable budget slice available this turn (billions) */
export function getSpendingPool(state: GameState): number {
  const country = state.countries[state.playerCountryId];
  if (!country) return state.reserveFunds;
  const headroom = getFiscalHeadroom(country);
  const budgetSlice =
    headroom * (state.budget.military * 0.35 + state.budget.reserve * 0.55) * 0.01;
  return state.reserveFunds + budgetSlice;
}

/** Effective cost after debt drag when spending beyond reserves */
export function getEffectiveSpendCost(country: Country, costBillions: number): number {
  const debt = country.debtToGdp ?? 0;
  return costBillions * (1 + Math.min(0.5, debt * 0.12));
}

export function formatDebtRatio(debtToGdp: number): string {
  return `${(debtToGdp * 100).toFixed(0)}% of GDP`;
}

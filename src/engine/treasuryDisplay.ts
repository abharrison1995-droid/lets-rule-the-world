/** Cosmetic only — never use in engine formulas */
export const TP_TO_DISPLAY_BILLIONS = 2.5;

export function getDisplayGDP(tp: number): number {
  return tp * TP_TO_DISPLAY_BILLIONS;
}

export function formatDisplayDebt(tp: number, debtRatio: number): string {
  return formatDisplayGDP(tp * debtRatio);
}

export function formatDisplayGDP(tp: number): string {
  const billions = getDisplayGDP(tp);
  if (billions >= 1000) return `$${(billions / 1000).toFixed(1)}T`;
  return `$${billions.toFixed(0)}B`;
}

export function formatDisplayCost(tpCost: number): string {
  return `$${getDisplayGDP(tpCost).toFixed(0)}B`;
}

export function formatDebtRatio(debtRatio: number): string {
  return `${(debtRatio * 100).toFixed(0)}% of GDP`;
}

/** Sqrt-compressed starting TP from legacy GDP billions (for data authoring) */
export function treasuryFromLegacyGdp(gdpBillions: number): number {
  const MIN_TP = 125;
  const MAX_TP = 1000;
  const sqrtMin = Math.sqrt(28);
  const sqrtMax = Math.sqrt(28780);
  const sqrtGdp = Math.sqrt(Math.max(1, gdpBillions));
  return Math.round(MIN_TP + ((sqrtGdp - sqrtMin) / (sqrtMax - sqrtMin)) * (MAX_TP - MIN_TP));
}

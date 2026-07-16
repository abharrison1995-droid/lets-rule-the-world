import type { Country, GameState } from '../types/game';
import { computeTurnIncome } from './taxation';
import { CAMPAIGN_DEFS } from './strikeCampaigns';

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

/** Effective TP cost after debt drag when spending */
export function getEffectiveSpendCost(country: Country, costTp: number): number {
  const debt = country.debtToGdp ?? 0;
  return costTp * (1 + Math.min(0.5, debt * 0.12));
}

function computeDebtDelta(
  state: GameState,
  countryId: string,
  country: Country,
  extraCampaignSustain = 0
): number {
  const treasury = country.stats.treasuryPoints;
  const income = computeTurnIncome(state, countryId);
  const debtService = getDebtServicePerTurn(country);
  const netFiscal = income - debtService;

  let delta = 0;
  const atWar = state.wars.some(w => w.belligerents.includes(countryId));
  const frontCount = state.fronts.filter(
    f => f.attackerCountryId === countryId || f.defenderCountryId === countryId
  ).length;
  const campaigns = (state.strikeCampaigns ?? []).filter(c => c.attackerCountryId === countryId);

  if (netFiscal < 0 && treasury > 0) {
    delta += Math.min(0.035, (-netFiscal / treasury) * 0.018);
  }
  if (atWar) {
    delta += 0.0018 + frontCount * 0.001;
    delta += (country.stats.warExhaustion ?? 0) * 0.0035;
  }
  for (const campaign of campaigns) {
    const def = CAMPAIGN_DEFS[campaign.strikeType];
    delta += (def.sustainCost / Math.max(40, treasury)) * 0.012;
  }
  if (extraCampaignSustain > 0) {
    delta += (extraCampaignSustain / Math.max(40, treasury)) * 0.012;
  }
  if (atWar && treasury < income * 1.5) {
    delta += 0.0012;
  }
  if (!atWar && campaigns.length === 0 && netFiscal > income * 0.12) {
    delta -= 0.0025;
  }

  return delta;
}

/** Projected change to debtToGdp next turn (before clamping). */
export function projectDebtDelta(state: GameState, countryId: string): number {
  const country = state.countries[countryId];
  if (!country) return 0;
  return computeDebtDelta(state, countryId, country);
}

export interface SpendFiscalPreview {
  effectiveCost: number;
  treasuryNow: number;
  treasuryAfter: number;
  debtDeltaNow: number;
  debtDeltaAfter: number;
}

/** Treasury and debt-trend impact of a one-time spend (and optional new campaign upkeep). */
export function previewSpendFiscalImpact(
  state: GameState,
  countryId: string,
  costTp: number,
  options?: { extraCampaignSustainCost?: number }
): SpendFiscalPreview | null {
  const country = state.countries[countryId];
  if (!country) return null;

  const effectiveCost = getEffectiveSpendCost(country, costTp);
  const treasuryNow = country.stats.treasuryPoints;
  const treasuryAfter = treasuryNow - effectiveCost;
  const extraSustain = options?.extraCampaignSustainCost ?? 0;

  const debtDeltaNow = computeDebtDelta(state, countryId, country, 0);
  const afterCountry: Country = {
    ...country,
    stats: { ...country.stats, treasuryPoints: treasuryAfter },
  };
  const debtDeltaAfter = computeDebtDelta(state, countryId, afterCountry, extraSustain);

  return {
    effectiveCost,
    treasuryNow,
    treasuryAfter,
    debtDeltaNow,
    debtDeltaAfter,
  };
}

/** War deficits, campaign upkeep, and fiscal shortfalls raise sovereign debt each turn. */
export function tickFiscalDebt(state: GameState): void {
  for (const [countryId, country] of Object.entries(state.countries)) {
    const debt = country.debtToGdp ?? 0;
    const delta = computeDebtDelta(state, countryId, country);
    country.debtToGdp = Math.min(3.5, Math.max(0, debt + delta));
  }
}

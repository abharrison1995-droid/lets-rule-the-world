import type { GameState, Country } from '../types/game';
import type { StrikeType } from '../types/game';

const STRIKE_READINESS_COST: Record<StrikeType, number> = {
  artillery: 0.018,
  drone: 0.024,
  cruise: 0.038,
  ballistic: 0.052,
  icbm: 0.075,
};

const CAMPAIGN_SUSTAIN_READINESS: Record<StrikeType, number> = {
  artillery: 0.012,
  drone: 0.016,
  cruise: 0.022,
  ballistic: 0.028,
  icbm: 0.035,
};

export const READINESS_STRIKE_BLOCK = 0.28;
export const READINESS_CAMPAIGN_HALT = 0.18;

export function getWarReadiness(country: Country): number {
  return country.stats.warReadiness ?? 1;
}

export function setWarReadiness(country: Country, value: number): void {
  country.stats.warReadiness = Math.max(0, Math.min(1, value));
}

export function onNationEntersWar(country: Country): void {
  const current = getWarReadiness(country);
  setWarReadiness(country, Math.min(1, current * 0.85 + 0.12));
}

export function drainReadinessForStrike(country: Country, strikeType: StrikeType): void {
  const cost = STRIKE_READINESS_COST[strikeType] ?? 0.03;
  const supportMod = country.stats.warPopularity < 0.4 ? 1.35 : 1;
  setWarReadiness(country, getWarReadiness(country) - cost * supportMod);
  country.stats.warPopularity = Math.max(0, country.stats.warPopularity - cost * 0.6);
}

export function drainReadinessForCampaignSustain(country: Country, strikeType: StrikeType): void {
  const cost = CAMPAIGN_SUSTAIN_READINESS[strikeType] ?? 0.02;
  const supportMod = country.stats.warPopularity < 0.4 ? 1.4 : 1;
  setWarReadiness(country, getWarReadiness(country) - cost * supportMod);
  country.stats.warPopularity = Math.max(0, country.stats.warPopularity - cost * 0.45);
}

export function getReadinessStrikeMultiplier(country: Country): number {
  const r = getWarReadiness(country);
  return 0.45 + r * 0.55;
}

export function getReadinessBlockReason(state: GameState, countryId: string): string | null {
  const country = state.countries[countryId];
  if (!country) return 'Invalid nation.';
  const r = getWarReadiness(country);
  if (r < READINESS_STRIKE_BLOCK) {
    return `War weariness too high (${Math.round(r * 100)}% readiness) — rally support via propaganda or stand down campaigns before more strikes.`;
  }
  return null;
}

export function tickWarReadiness(state: GameState): void {
  for (const country of Object.values(state.countries)) {
    let readiness = getWarReadiness(country);
    const atWar = state.wars.some(w => w.belligerents.includes(country.id));
    const activeCampaigns = (state.strikeCampaigns ?? []).filter(
      c => c.attackerCountryId === country.id
    ).length;

    if (atWar) {
      const supportGap = Math.max(0, 0.42 - country.stats.warPopularity);
      readiness -= 0.015 + supportGap * 0.06;
      readiness -= country.stats.warExhaustion * 0.025;
      readiness -= activeCampaigns * 0.012;

      if (country.stats.warPopularity > 0.58) {
        readiness += 0.02;
      }
      if (activeCampaigns > 2) {
        readiness -= 0.02;
      }
    } else {
      readiness = Math.min(1, readiness + 0.035);
      if (country.stats.warExhaustion < 0.15) {
        readiness = Math.min(1, readiness + 0.02);
      }
    }

    setWarReadiness(country, readiness);

    if (
      country.id === state.playerCountryId &&
      readiness < READINESS_CAMPAIGN_HALT &&
      activeCampaigns > 0
    ) {
      state.history.push(
        `Turn ${state.turn}: War weariness forces stand-down of sustained operations — public will not support further bombardment.`
      );
    }
  }
}

export function forceHaltCampaignsFromWeariness(state: GameState): void {
  const playerId = state.playerCountryId;
  const country = state.countries[playerId];
  if (!country || getWarReadiness(country) >= READINESS_CAMPAIGN_HALT) return;

  const before = (state.strikeCampaigns ?? []).length;
  state.strikeCampaigns = (state.strikeCampaigns ?? []).filter(
    c => c.attackerCountryId !== playerId
  );
  const halted = before - (state.strikeCampaigns ?? []).length;
  if (halted > 0 && !state.history.some(h => h.includes('War weariness forces stand-down'))) {
    state.history.push(
      `Turn ${state.turn}: ${halted} strike campaign(s) halted — war readiness collapsed.`
    );
  }
}

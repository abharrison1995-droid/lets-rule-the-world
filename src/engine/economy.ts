import type { GameState, Country, BudgetAllocation } from '../types/game';
import { computeTradeAgreementBonus } from './talks';
import { computeCovertTradeBonus } from './covertAlliances';

const TERRAIN_ATTACK_PENALTY: Record<string, number> = {
  urban: 0.15, mountain: 0.25, coastal: 0.10, desert: 0.05, plains: 0,
};
const TERRAIN_DEFENSE_BONUS: Record<string, number> = {
  urban: 0.10, mountain: 0.20, coastal: 0.08, desert: 0.05, plains: 0,
};

const HIGH_IS_BAD = new Set(['warExhaustion', 'propagandaSaturation']);

export function tickEconomy(state: GameState): void {
  for (const country of Object.values(state.countries)) {
    // Region industry contribution
    const ownedRegions = Object.values(state.regions).filter(r => r.controlledBy === country.id);
    const regionBonus = ownedRegions.reduce((sum, r) => {
      const penalty = r.controlledBy !== r.countryId && r.unrest > 20 ? 0.5 : 1;
      return sum + r.industryValue * penalty * 0.000002;
    }, 0);
    country.stats.treasuryPoints *= (1 + regionBonus);

    const modifiers = computeGrowthModifiers(state, country);
    const growth = country.stats.baseGrowthRate + modifiers;
    country.stats.treasuryPoints *= (1 + growth);

    const techInvestment = country.stats.treasuryPoints * country.stats.defenseBudget * 0.0002;
    const allianceTechBonus = computeAllianceTechSharing(state, country.id);
    country.stats.techLevel = Math.min(
      1,
      country.stats.techLevel + country.stats.baseGrowthRate * 0.002 + techInvestment + allianceTechBonus
    );

    // War exhaustion
    if (isAtWar(state, country.id)) {
      const frontCount = state.fronts.filter(
        f => f.attackerCountryId === country.id || f.defenderCountryId === country.id
      ).length;
      const war = state.wars.find(w => w.belligerents.includes(country.id));
      const turnsAtWar = war ? state.turn - war.startTurn : 0;
      const exhaustionRate =
        0.02 * Math.max(1, frontCount) * (1 - country.stats.warPopularity) * (1 + turnsAtWar * 0.05);
      country.stats.warExhaustion = Math.min(1, country.stats.warExhaustion + exhaustionRate);
      country.stats.moraleBase = Math.max(0.1, country.stats.moraleBase - exhaustionRate * 0.3);
    } else {
      country.stats.warExhaustion = Math.max(0, country.stats.warExhaustion - 0.02);
    }

    country.stats.propagandaSaturation = Math.max(0, country.stats.propagandaSaturation - 0.02);
  }
}

function computeGrowthModifiers(state: GameState, country: Country): number {
  let mod = 0;

  const positiveRelations = Object.keys(state.countries)
    .filter(id => id !== country.id)
    .filter(id => getRelationValue(state, country.id, id) > 40).length;
  mod += positiveRelations * 0.001;
  mod -= country.stats.warExhaustion * 0.03;

  const majorEconomies = ['usa', 'china', 'germany', 'japan', 'england', 'france'];
  const avgMajor =
    majorEconomies
      .filter(id => id !== country.id && state.countries[id])
      .reduce((sum, id) => sum + getRelationValue(state, country.id, id), 0) /
    majorEconomies.filter(id => id !== country.id && state.countries[id]).length;
  if (avgMajor < -30) mod -= 0.015;

  // Occupied foreign regions cause drag on occupier
  const occupied = Object.values(state.regions).filter(
    r => r.controlledBy === country.id && r.countryId !== country.id && r.unrest > 20
  );
  mod -= occupied.length * 0.003;

  if (state.playerCountryId === country.id) {
    mod += (state.budget.domestic * 0.5 + state.budget.military * 0.1) * 0.01;
  }

  mod += computeTradeAgreementBonus(state, country.id);
  mod += computeCovertTradeBonus(state, country.id);

  return mod;
}

function computeAllianceTechSharing(state: GameState, countryId: string): number {
  let bonus = 0;
  for (const alliance of state.alliances) {
    if (!alliance.members.includes(countryId)) continue;
    const tierMultiplier = { informal: 0.001, defensive_pact: 0.003, full_alliance: 0.005, bloc: 0.008 };
    for (const memberId of alliance.members) {
      if (memberId === countryId) continue;
      const member = state.countries[memberId];
      if (member) bonus += member.stats.techLevel * (tierMultiplier[alliance.tier] ?? 0.001);
    }
  }
  return bonus;
}

function getRelationValue(state: GameState, a: string, b: string): number {
  return state.relations[[a, b].sort().join('|')] ?? 0;
}

function isAtWar(state: GameState, countryId: string): boolean {
  return state.wars.some(w => w.belligerents.includes(countryId));
}

export function applyBudgetEffects(state: GameState): void {
  const country = state.countries[state.playerCountryId];
  if (!country) return;
  const b = state.budget;

  if (b.military > 0.3) {
    const devBoost = (b.military - 0.2) * 0.02;
    country.militaryDev.troopQuality = Math.min(5, country.militaryDev.troopQuality + devBoost);
  }

  if (b.domestic > 0.25) {
    const servicesEffect = b.domestic * (state.domesticSplit?.services ?? 0.3) * 0.05;
    country.stats.moraleBase = Math.min(1, country.stats.moraleBase + servicesEffect * 0.03);
  }

  if (b.diplomacy > 0.2) {
    for (const otherId of Object.keys(state.countries)) {
      if (otherId === state.playerCountryId) continue;
      const key = [state.playerCountryId, otherId].sort().join('|');
      state.relations[key] = Math.min(100, (state.relations[key] ?? 0) + b.diplomacy * 0.5);
    }
  }
}

export function getDefenseSystemRating(region: {
  garrison: { defenseSystems: { rating: number }[] };
}): number {
  return region.garrison.defenseSystems.reduce((sum, ds) => sum + ds.rating, 0);
}

export function computeAttackPower(
  troops: number,
  troopQuality: number,
  techLevel: number,
  terrain: string,
  defenseRating: number,
  reinforcement = 0
): number {
  const techMod = 1 + techLevel * 0.5;
  const terrainPenalty = TERRAIN_ATTACK_PENALTY[terrain] ?? 0;
  const defenseMit = defenseRating * 0.05;
  return troops * troopQuality * techMod + reinforcement - terrainPenalty * troops * 0.1 - defenseMit;
}

export function computeDefensePower(
  troops: number,
  troopQuality: number,
  techLevel: number,
  terrain: string,
  defenseRating: number,
  fortLevel: number
): number {
  const techMod = 1 + techLevel * 0.5;
  const terrainBonus = TERRAIN_DEFENSE_BONUS[terrain] ?? 0;
  const defenseMit = defenseRating * 0.08;
  const fortBonus = fortLevel * 0.1 * troops;
  return troops * troopQuality * techMod + defenseMit + fortBonus + terrainBonus * troops * 0.1;
}

export function defaultBudget(): BudgetAllocation {
  return { military: 0.30, diplomacy: 0.15, domestic: 0.25, covert: 0.10, reserve: 0.20 };
}

export function normalizeBudget(budget: BudgetAllocation): BudgetAllocation {
  const total =
    budget.military + budget.diplomacy + budget.domestic + budget.covert + budget.reserve;
  if (total === 0) return defaultBudget();
  if (Math.abs(total - 1) < 0.01) return budget;
  return {
    military: budget.military / total,
    diplomacy: budget.diplomacy / total,
    domestic: budget.domestic / total,
    covert: budget.covert / total,
    reserve: budget.reserve / total,
  };
}

export { HIGH_IS_BAD };

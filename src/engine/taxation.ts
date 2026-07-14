import type { GameState } from '../types/game';
import { getDebtServicePerTurn } from './fiscal';
import { getPariahIncomeDrag } from './diplomacy';
import { getRelation, modifyRelation } from '../data/relations';
import { getRegionsForCountry } from '../data/regions';
import { getFacilityIncomeBonus } from './facilities';
import { getSuezTransitDrag } from './npcMechanics';

const DEFAULT_CORPORATE_TAX = 0.20;
const DEFAULT_INCOME_TAX = 0.22;

export interface TaxBreakdown {
  corporateRevenue: number;
  incomeRevenue: number;
  organicGrowth: number;
  facilityBonus: number;
  reserveBoost: number;
  oilShockDrag: number;
  suezDrag: number;
  pariahDrag: number;
  total: number;
}

export function getDefaultCorporateTaxRate(): number {
  return DEFAULT_CORPORATE_TAX;
}

export function getDefaultIncomeTaxRate(): number {
  return DEFAULT_INCOME_TAX;
}

function getOilShockDrag(state: GameState, countryId: string): number {
  const shock = state.globalOilShock;
  if (!shock || shock.turnsRemaining <= 0) return 0;
  const country = state.countries[countryId];
  if (!country) return 0;
  const importers = new Set(['usa', 'england', 'germany', 'france', 'japan', 'south_korea', 'india', 'china', 'turkey', 'pakistan']);
  if (!importers.has(countryId)) return 0;
  return country.stats.treasuryPoints * shock.severity * 0.018;
}

/** Per-turn treasury income from taxation (billions / TP) */
export function computeTaxBreakdown(state: GameState, countryId: string): TaxBreakdown {
  const country = state.countries[countryId];
  if (!country) {
    return { corporateRevenue: 0, incomeRevenue: 0, organicGrowth: 0, facilityBonus: 0, reserveBoost: 0, oilShockDrag: 0, suezDrag: 0, pariahDrag: 0, total: 0 };
  }

  const corporate = state.corporateTaxRate ?? DEFAULT_CORPORATE_TAX;
  const income = state.incomeTaxRate ?? DEFAULT_INCOME_TAX;
  const treasury = country.stats.treasuryPoints;

  const corporateRevenue = treasury * corporate * 0.006;
  const incomeRevenue = treasury * income * 0.005;
  const organicGrowth = treasury * country.stats.baseGrowthRate * getGrowthMultiplier(corporate);
  const facilityBonus = countryId === state.playerCountryId ? getFacilityIncomeBonus(state) : 0;
  const reserveBoost = countryId === state.playerCountryId ? treasury * state.budget.reserve * 0.006 : 0;
  const oilShockDrag = getOilShockDrag(state, countryId);
  const suezDrag = getSuezTransitDrag(state, countryId);
  const pariahDrag = getPariahIncomeDrag(state, countryId);

  // organicGrowth is tracked for UI; treasury growth itself applies in tickEconomy — do not double-count here
  const total = corporateRevenue + incomeRevenue + facilityBonus + reserveBoost - oilShockDrag - suezDrag - pariahDrag;
  return { corporateRevenue, incomeRevenue, organicGrowth, facilityBonus, reserveBoost, oilShockDrag, suezDrag, pariahDrag, total };
}

export function computeTurnIncome(state: GameState, countryId: string): number {
  return computeTaxBreakdown(state, countryId).total;
}

function getGrowthMultiplier(corporateTax: number): number {
  if (corporateTax <= 0.18) return 1.08;
  if (corporateTax <= 0.28) return 1;
  const excess = corporateTax - 0.28;
  return Math.max(0.25, 1 - excess * 2.4);
}

export function applyTurnIncome(state: GameState): void {
  if (state.globalOilShock && state.globalOilShock.turnsRemaining > 0) {
    state.globalOilShock.turnsRemaining -= 1;
    if (state.globalOilShock.turnsRemaining <= 0) {
      state.history.push(`Turn ${state.turn}: Global oil shock eased — shipping lanes stabilizing.`);
      state.globalOilShock = null;
    }
  }

  for (const countryId of Object.keys(state.countries)) {
    const country = state.countries[countryId];
    if (!country) continue;

    const income = computeTurnIncome(state, countryId);
    const debtService = getDebtServicePerTurn(country);
    country.stats.treasuryPoints += Math.max(-debtService, income - debtService);
    country.stats.treasuryPoints = Math.max(5, country.stats.treasuryPoints);
  }
}

export function checkTaxPoliticalPressure(state: GameState): void {
  const playerId = state.playerCountryId;
  const country = state.countries[playerId];
  if (!country) return;

  const incomeTax = state.incomeTaxRate ?? DEFAULT_INCOME_TAX;
  const corporateTax = state.corporateTaxRate ?? DEFAULT_CORPORATE_TAX;
  const gov = country.governmentType ?? 'hybrid';

  const incomePressure = Math.max(0, incomeTax - 0.20);
  const corporatePressure = Math.max(0, corporateTax - 0.25);
  const totalPressure = incomePressure * 2.2 + corporatePressure * 0.7;

  if (totalPressure > 0.01) {
    state.taxPressureTurns = (state.taxPressureTurns ?? 0) + 1;
    const moraleHit = totalPressure * 0.14;
    country.stats.moraleBase = Math.max(0.1, country.stats.moraleBase - moraleHit);

    const playerRegions = getRegionsForCountry(playerId).map(r => state.regions[r.id]).filter(Boolean);
    const unrestBump = totalPressure * 10;
    for (const region of playerRegions) {
      region.unrest = Math.min(100, region.unrest + unrestBump);
    }

    if (incomeTax > 0.32) {
      for (const otherId of Object.keys(state.countries)) {
        if (otherId === playerId) continue;
        const rel = getRelation(state.relations, playerId, otherId);
        if (rel > 15) {
          const penalty = Math.round(-totalPressure * 12);
          if (penalty !== 0) modifyRelation(state.relations, playerId, otherId, penalty);
        }
      }
    }
  } else if ((state.taxPressureTurns ?? 0) > 0) {
    state.taxPressureTurns = Math.max(0, state.taxPressureTurns - 1);
  }

  const avgUnrest =
    getRegionsForCountry(playerId).reduce((s, r) => s + (state.regions[r.id]?.unrest ?? 0), 0) /
    Math.max(1, getRegionsForCountry(playerId).length);

  const crisisThreshold = incomeTax > 0.38 && avgUnrest > 48 && (state.taxPressureTurns ?? 0) >= 2;
  if (!crisisThreshold) {
    state.telegraphedTaxCrisis = false;
    return;
  }

  if (gov === 'democratic') {
    country.stats.regimeSecurity = Math.max(0, country.stats.regimeSecurity - 0.12);
    if (country.stats.regimeSecurity < 0.2 || avgUnrest > 75) {
      state.gameOver = true;
      state.gameOverReason =
        'Vote of no confidence — crushing income taxes and public unrest forced your government from office.';
      state.history.push(`Turn ${state.turn}: Government collapsed after vote of no confidence.`);
    } else if (!state.telegraphedTaxCrisis) {
      state.telegraphedTaxCrisis = true;
      state.history.push(`Turn ${state.turn}: Parliament threatens vote of no confidence over tax burden.`);
    }
  } else if (gov === 'autocratic') {
    country.stats.regimeSecurity = Math.max(0, country.stats.regimeSecurity - 0.15);
    if (country.stats.regimeSecurity < 0.15 || avgUnrest > 80) {
      state.gameOver = true;
      state.gameOverReason =
        'Peoples\' revolt — mass unrest over punitive taxes toppled the regime.';
      state.history.push(`Turn ${state.turn}: Regime overthrown by popular revolt.`);
    } else if (!state.telegraphedTaxCrisis) {
      state.telegraphedTaxCrisis = true;
      state.history.push(`Turn ${state.turn}: Street protests spread — regime stability at risk.`);
    }
  } else {
    country.stats.regimeSecurity = Math.max(0, country.stats.regimeSecurity - 0.1);
    if (country.stats.regimeSecurity < 0.25 || avgUnrest > 70) {
      state.gameOver = true;
      state.gameOverReason =
        'Coalition crisis — your government fell amid tax revolt and collapsing public trust.';
      state.history.push(`Turn ${state.turn}: Coalition collapsed under tax pressure.`);
    } else if (!state.telegraphedTaxCrisis) {
      state.telegraphedTaxCrisis = true;
      state.history.push(`Turn ${state.turn}: Coalition partners demand tax relief or face collapse.`);
    }
  }
}

export function getProjectedPlayerIncome(state: GameState): number {
  return computeTurnIncome(state, state.playerCountryId);
}

export function previewIncomeAtTaxRates(
  state: GameState,
  corporateTax: number,
  incomeTax: number
): TaxBreakdown {
  const snapshot = {
    ...state,
    corporateTaxRate: corporateTax,
    incomeTaxRate: incomeTax,
  };
  return computeTaxBreakdown(snapshot, state.playerCountryId);
}

import type { GameState, MilitaryDev, MilitaryUpgradeOrder } from '../types/game';
import { deductCost } from './actions';
import { formatDisplayCost } from './treasuryDisplay';
import {
  spendActionEnergy,
  actionEnergyBlockReason,
  ACTION_ENERGY_COSTS,
} from './actionEnergy';
import { getRegionsForCountry } from '../data/regions';

export const MIL_UPGRADE_TURNS = 4;
export const MIL_UPGRADE_COST = 7;

export const MIL_CATEGORY_LABELS: Record<keyof MilitaryDev, string> = {
  troopQuality: 'Troop Quality',
  missileDefense: 'Missile Defense',
  droneProgram: 'Drone Program',
  strikeCapability: 'Strike Capability',
  fortification: 'Fortification',
};

export function scaleStartingMilitaryDev(dev: MilitaryDev): MilitaryDev {
  return {
    troopQuality: Math.max(1, dev.troopQuality - 2),
    missileDefense: Math.max(1, dev.missileDefense - 1),
    droneProgram: Math.max(1, dev.droneProgram - 2),
    strikeCapability: Math.max(1, dev.strikeCapability - 2),
    fortification: Math.max(1, dev.fortification - 1),
  };
}

export function getPendingMilitaryUpgrade(state: GameState): MilitaryUpgradeOrder | null {
  const order = state.militaryUpgrade;
  if (!order || order.completeTurn <= state.turn) return null;
  return order;
}

export function getTurnsUntilMilitaryUpgrade(state: GameState): number {
  const order = state.militaryUpgrade;
  if (!order) return 0;
  return Math.max(0, order.completeTurn - state.turn);
}

export function playerStartMilitaryUpgrade(
  state: GameState,
  category: keyof MilitaryDev
): string | null {
  const country = state.countries[state.playerCountryId];
  if (!country) return 'Invalid player.';

  if (getPendingMilitaryUpgrade(state)) {
    return 'Another military upgrade is already in progress.';
  }

  const energyCost = ACTION_ENERGY_COSTS.military_invest;
  if (!spendActionEnergy(state, energyCost)) {
    return actionEnergyBlockReason(state, energyCost)!;
  }

  if (!deductCost(state, MIL_UPGRADE_COST)) {
    state.actionEnergy += energyCost;
    return `Insufficient funds (need ${formatDisplayCost(MIL_UPGRADE_COST)}).`;
  }

  const current = country.militaryDev[category];
  if (current >= 5) {
    state.actionEnergy += energyCost;
    return `${MIL_CATEGORY_LABELS[category]} is already maxed out.`;
  }

  state.militaryUpgrade = {
    id: `mil_${category}_${state.turn}`,
    category,
    startTurn: state.turn,
    completeTurn: state.turn + MIL_UPGRADE_TURNS,
    costPaid: MIL_UPGRADE_COST,
  };

  state.history.push(
    `Turn ${state.turn}: ${MIL_CATEGORY_LABELS[category]} upgrade started — completes turn ${state.militaryUpgrade.completeTurn}.`
  );
  return null;
}

function applyMilitaryUpgrade(state: GameState, category: keyof MilitaryDev): void {
  const country = state.countries[state.playerCountryId];
  if (!country) return;

  country.militaryDev[category] = Math.min(5, country.militaryDev[category] + 1);

  if (category === 'missileDefense') {
    for (const region of getRegionsForCountry(state.playerCountryId)) {
      if (region.garrison.defenseSystems.length > 0) {
        region.garrison.defenseSystems[0].rating += 1;
      } else {
        region.garrison.defenseSystems.push({ id: `${region.id}-ads`, type: 'generic', rating: 1 });
      }
    }
  }
  if (category === 'fortification') {
    for (const region of getRegionsForCountry(state.playerCountryId)) {
      region.fortificationLevel = Math.min(5, region.fortificationLevel + 1);
    }
  }
}

export function resolveMilitaryUpgrades(state: GameState): void {
  const order = state.militaryUpgrade;
  if (!order || order.completeTurn > state.turn) return;

  applyMilitaryUpgrade(state, order.category);
  const label = MIL_CATEGORY_LABELS[order.category];
  const level = state.countries[state.playerCountryId]?.militaryDev[order.category] ?? 0;
  state.history.push(`Turn ${state.turn}: ${label} upgrade complete (now level ${level}).`);
  state.militaryUpgrade = null;
}

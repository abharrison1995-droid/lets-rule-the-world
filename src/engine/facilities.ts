import type { FacilityBuildOrder, FacilityType, GameState } from '../types/game';
import { deductCost } from './actions';
import { formatDisplayCost } from './treasuryDisplay';
import { spendActionEnergy, actionEnergyBlockReason, ACTION_ENERGY_COSTS } from './actionEnergy';

export interface FacilityDefinition {
  type: FacilityType;
  label: string;
  description: string;
  buildTurns: number;
  cost: number;
  icon: string;
}

export const FACILITY_DEFINITIONS: Record<FacilityType, FacilityDefinition> = {
  drone_factory: {
    type: 'drone_factory',
    label: 'Drone Factory',
    description: 'Reduces drone strike costs by 25%.',
    buildTurns: 3,
    cost: 12,
    icon: '🛸',
  },
  missile_defense: {
    type: 'missile_defense',
    label: 'Missile Defence Site',
    description: '+2 regional air defence rating.',
    buildTurns: 4,
    cost: 15,
    icon: '🛡',
  },
  oil_gas: {
    type: 'oil_gas',
    label: 'Oil & Gas Complex',
    description: '+$3B treasury income per turn (nationwide).',
    buildTurns: 5,
    cost: 18,
    icon: '🛢',
  },
  arms_plant: {
    type: 'arms_plant',
    label: 'Arms Plant',
    description: '+15% garrison troops in this region.',
    buildTurns: 6,
    cost: 20,
    icon: '🏭',
  },
};

export function getFacilityDefs(): FacilityDefinition[] {
  return Object.values(FACILITY_DEFINITIONS);
}

export function hasFacilityInRegion(state: GameState, regionId: string, type: FacilityType): boolean {
  const region = state.regions[regionId];
  if (!region) return false;
  return (region.facilities ?? []).some(f => f.type === type);
}

export function hasPendingBuild(state: GameState, regionId: string, type?: FacilityType): boolean {
  return (state.facilityBuilds ?? []).some(
    b => b.regionId === regionId && (!type || b.type === type) && b.completeTurn > state.turn
  );
}

export function getPendingFacilityBuilds(state: GameState): FacilityBuildOrder[] {
  return (state.facilityBuilds ?? []).filter(b => b.completeTurn > state.turn);
}

export function getTurnsUntilFacilityComplete(state: GameState, order: FacilityBuildOrder): number {
  return Math.max(0, order.completeTurn - state.turn);
}

export function playerStartFacilityBuild(
  state: GameState,
  regionId: string,
  type: FacilityType
): string | null {
  const region = state.regions[regionId];
  if (!region) return 'Invalid region.';
  if (region.controlledBy !== state.playerCountryId) return 'You do not control this region.';
  if (hasFacilityInRegion(state, regionId, type)) return 'This facility already exists here.';
  if (hasPendingBuild(state, regionId, type)) return 'Already building this facility here.';

  const def = FACILITY_DEFINITIONS[type];
  const energyCost = ACTION_ENERGY_COSTS.facility_build ?? 1;
  if (!spendActionEnergy(state, energyCost)) {
    return actionEnergyBlockReason(state, energyCost)!;
  }

  if (!deductCost(state, def.cost)) {
    state.actionEnergy += energyCost;
    return `Insufficient funds (need ${formatDisplayCost(def.cost)}).`;
  }

  const order: FacilityBuildOrder = {
    id: `build_${type}_${regionId}_${state.turn}`,
    regionId,
    countryId: state.playerCountryId,
    type,
    startTurn: state.turn,
    completeTurn: state.turn + def.buildTurns,
    costPaid: def.cost,
  };

  if (!state.facilityBuilds) state.facilityBuilds = [];
  state.facilityBuilds.push(order);
  state.history.push(
    `Turn ${state.turn}: ${def.label} construction started in ${region.name} — completes turn ${order.completeTurn}.`
  );
  return null;
}

export function resolveFacilityBuilds(state: GameState): void {
  const due = (state.facilityBuilds ?? []).filter(b => b.completeTurn <= state.turn);
  if (due.length === 0) return;

  state.facilityBuilds = (state.facilityBuilds ?? []).filter(b => b.completeTurn > state.turn);

  for (const order of due) {
    const region = state.regions[order.regionId];
    const def = FACILITY_DEFINITIONS[order.type];
    if (!region) continue;

    if (!region.facilities) region.facilities = [];
    region.facilities.push({
      id: `${order.type}_${order.regionId}_${state.turn}`,
      type: order.type,
      builtTurn: state.turn,
    });

    if (order.type === 'missile_defense') {
      if (region.garrison.defenseSystems.length > 0) {
        region.garrison.defenseSystems[0].rating += 2;
      } else {
        region.garrison.defenseSystems.push({
          id: `${order.regionId}-mds`,
          type: 'generic',
          rating: 2,
        });
      }
    }

    if (order.type === 'arms_plant') {
      region.garrison.troops = Math.round(region.garrison.troops * 1.15);
    }

    state.history.push(
      `Turn ${state.turn}: ${def.label} completed in ${region.name}.`
    );
  }
}

export function getFacilityIncomeBonus(state: GameState): number {
  let bonus = 0;
  for (const region of Object.values(state.regions)) {
    if (region.controlledBy !== state.playerCountryId) continue;
    for (const f of region.facilities ?? []) {
      if (f.type === 'oil_gas') bonus += 3;
    }
  }
  return bonus;
}

export function getDroneStrikeDiscount(state: GameState): number {
  for (const region of Object.values(state.regions)) {
    if (region.controlledBy !== state.playerCountryId) continue;
    if ((region.facilities ?? []).some(f => f.type === 'drone_factory')) {
      return 0.25;
    }
  }
  return 0;
}

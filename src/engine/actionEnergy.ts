import type { GameState } from '../types/game';

const GREAT_POWERS = new Set(['usa', 'china', 'russia']);
const HARD_NATIONS = new Set(['north_korea', 'iran', 'pakistan']);

export const ACTION_ENERGY_COSTS = {
  declare_war: 2,
  diplomatic_mission_light: 1,
  diplomatic_mission_heavy: 2,
  covert_mission: 2,
  covert_op: 1,
  probe_pacts: 1,
  strike: 1,
  military_invest: 1,
  nation_mechanic: 1,
  propaganda: 1,
} as const;

export function getMaxActionEnergy(state: GameState): number {
  const id = state.playerCountryId;
  let max = 3;
  if (GREAT_POWERS.has(id)) max = 4;
  else if (HARD_NATIONS.has(id)) max = 2;

  if (state.internationalPariahTurns > 0) max = Math.max(1, max - 1);
  if ((state.countries[id]?.stats.warExhaustion ?? 0) > 0.6) max = Math.max(1, max - 1);

  return max;
}

export function getActionEnergy(state: GameState): { current: number; max: number } {
  return {
    current: state.actionEnergy,
    max: getMaxActionEnergy(state),
  };
}

export function canSpendActionEnergy(state: GameState, cost: number): boolean {
  return state.actionEnergy >= cost;
}

export function spendActionEnergy(state: GameState, cost: number): boolean {
  if (!canSpendActionEnergy(state, cost)) return false;
  state.actionEnergy -= cost;
  return true;
}

export function resetActionEnergy(state: GameState): void {
  state.actionEnergy = getMaxActionEnergy(state);
}

export function actionEnergyBlockReason(state: GameState, cost: number): string | undefined {
  if (canSpendActionEnergy(state, cost)) return undefined;
  return `Insufficient action energy (need ${cost}, have ${state.actionEnergy}).`;
}

import type { GameState, PressActionId, PressActionPreview } from '../types/game';
import { getRelation, modifyRelation } from '../data/relations';
import { spendActionEnergy, actionEnergyBlockReason } from './actionEnergy';
import { deductCost } from './actions';
import { hasPendingMission } from './diplomaticMissions';
import { getRegionsForCountry } from '../data/regions';

export const PRESS_COSTS: Record<PressActionId, number> = {
  condemn_aggression: 45,
  announce_summit: 35,
  social_media_flood: 60,
  info_ops_leak: 75,
};

export const PRESS_ENERGY: Record<PressActionId, number> = {
  condemn_aggression: 1,
  announce_summit: 1,
  social_media_flood: 1,
  info_ops_leak: 2,
};

export const PRESS_DURATIONS: Record<PressActionId, number> = {
  condemn_aggression: 0,
  announce_summit: 2,
  social_media_flood: 0,
  info_ops_leak: 0,
};

const PRESS_LABELS: Record<PressActionId, string> = {
  condemn_aggression: 'Condemn aggression',
  announce_summit: 'Announce bilateral summit',
  social_media_flood: 'Social media influence flood',
  info_ops_leak: 'Anonymous intel drop (XAnon)',
};

function isAtWarWith(state: GameState, a: string, b: string): boolean {
  return state.wars.some(w => w.belligerents.includes(a) && w.belligerents.includes(b));
}

function isNationAtWar(state: GameState, nationId: string): boolean {
  return state.wars.some(w => w.belligerents.includes(nationId));
}

function usaBonus(state: GameState): number {
  return state.playerCountryId === 'usa' ? 1.2 : 1;
}

export function getPressActionPreview(
  state: GameState,
  actionId: PressActionId,
  targetId: string
): PressActionPreview {
  const target = state.countries[targetId];
  let blockReason: string | undefined;
  const energyCost = PRESS_ENERGY[actionId];
  const cost = PRESS_COSTS[actionId];
  const durationTurns = PRESS_DURATIONS[actionId];
  const isInstant = durationTurns === 0;

  if (!target) {
    blockReason = 'Invalid target.';
  } else if (targetId === state.playerCountryId) {
    blockReason = 'Cannot target yourself.';
  } else {
    const energyReason = actionEnergyBlockReason(state, energyCost);
    if (energyReason) blockReason = energyReason;
  }

  if (!blockReason) {
    if (actionId === 'condemn_aggression' && !isNationAtWar(state, targetId)) {
      blockReason = 'Target must be engaged in an active war.';
    }
    if (actionId === 'announce_summit' && hasPendingMission(state, targetId, 'summit')) {
      blockReason = 'Summit already scheduled with this nation.';
    }
    if (actionId === 'announce_summit' && isAtWarWith(state, state.playerCountryId, targetId)) {
      blockReason = 'Cannot announce summit while at war with target.';
    }
  }

  const effects = getPressEffects(actionId, state.playerCountryId === 'usa');

  return {
    actionId,
    label: PRESS_LABELS[actionId],
    description: getPressDescription(actionId),
    canAttempt: !blockReason,
    blockReason,
    cost,
    energyCost,
    durationTurns,
    isInstant,
    effects,
  };
}

function getPressDescription(actionId: PressActionId): string {
  switch (actionId) {
    case 'condemn_aggression':
      return 'Publicly denounce a belligerent at the UN podium. Instant.';
    case 'announce_summit':
      return 'Schedule a high-profile summit. Convenes in 2 turns.';
    case 'social_media_flood':
      return 'Flood foreign feeds with coordinated messaging. Instant.';
    case 'info_ops_leak':
      return 'Release damaging leaks through anonymous channels. Instant.';
  }
}

function getPressEffects(actionId: PressActionId, isUsa: boolean): string[] {
  const bonus = isUsa ? ' (USA +20% effectiveness)' : '';
  switch (actionId) {
    case 'condemn_aggression':
      return ['+5 relations with critics of target', '−8 relations with target allies', 'Instant'];
    case 'announce_summit':
      return ['+10 relations on completion', 'Improves diplomatic standing', '2-turn summit prep'];
    case 'social_media_flood':
      return [`Target war popularity −8%${bonus}`, 'Target unrest +6', 'Instant'];
    case 'info_ops_leak':
      return [`Target regime security −6%${bonus}`, '−12 relations with target', 'Instant'];
  }
}

export interface PressActionResult {
  success: boolean;
  message: string;
}

export function dispatchSummitMission(
  state: GameState,
  targetId: string
): PressActionResult {
  const preview = getPressActionPreview(state, 'announce_summit', targetId);
  if (!preview.canAttempt) {
    return { success: false, message: preview.blockReason ?? 'Cannot announce summit.' };
  }

  if (!spendActionEnergy(state, preview.energyCost)) {
    return { success: false, message: actionEnergyBlockReason(state, preview.energyCost)! };
  }
  if (!deductCost(state, preview.cost)) {
    state.actionEnergy += preview.energyCost;
    return { success: false, message: `Insufficient funds (need $${preview.cost}B).` };
  }

  const targetName = state.countries[targetId]?.name ?? targetId;
  const duration = PRESS_DURATIONS.announce_summit;
  state.diplomaticMissions.push({
    id: `summit_${targetId}_${state.turn}`,
    type: 'summit',
    targetNationId: targetId,
    dispatchedTurn: state.turn,
    resolveTurn: state.turn + duration,
    energyCost: preview.energyCost,
    goldCost: preview.cost,
  });

  state.history.push(
    `Turn ${state.turn}: Summit with ${targetName} announced — convenes turn ${state.turn + duration}.`
  );
  return {
    success: true,
    message: `Summit with ${targetName} announced. Convenes in ${duration} turns.`,
  };
}

export function resolveSummitMission(state: GameState, targetId: string): PressActionResult {
  const targetName = state.countries[targetId]?.name ?? targetId;
  modifyRelation(state.relations, state.playerCountryId, targetId, 10);

  for (const countryId of Object.keys(state.countries)) {
    if (countryId === state.playerCountryId || countryId === targetId) continue;
    const rel = getRelation(state.relations, countryId, state.playerCountryId);
    if (rel > 20) modifyRelation(state.relations, countryId, state.playerCountryId, 2);
  }

  return { success: true, message: `Summit with ${targetName} concluded successfully.` };
}

function executeCondemnAggression(state: GameState, targetId: string): PressActionResult {
  const targetName = state.countries[targetId]?.name ?? targetId;
  const playerId = state.playerCountryId;

  for (const countryId of Object.keys(state.countries)) {
    if (countryId === playerId || countryId === targetId) continue;
    const relToTarget = getRelation(state.relations, countryId, targetId);
    if (relToTarget < -10) {
      modifyRelation(state.relations, countryId, playerId, 5);
    } else if (relToTarget > 30) {
      modifyRelation(state.relations, countryId, playerId, -8);
    }
  }
  modifyRelation(state.relations, playerId, targetId, -12);

  return { success: true, message: `Globally condemned ${targetName}'s aggression.` };
}

function executeSocialMediaFlood(state: GameState, targetId: string): PressActionResult {
  const target = state.countries[targetId]!;
  const bonus = usaBonus(state);
  const targetName = target.name;

  target.stats.warPopularity = Math.max(0, target.stats.warPopularity - 0.08 * bonus);
  for (const region of getRegionsForCountry(targetId)) {
    region.unrest = Math.min(100, region.unrest + 6 * bonus);
  }
  modifyRelation(state.relations, state.playerCountryId, targetId, -5);

  return { success: true, message: `Social media campaign targeted ${targetName}.` };
}

function executeInfoOpsLeak(state: GameState, targetId: string): PressActionResult {
  const target = state.countries[targetId]!;
  const bonus = usaBonus(state);
  const targetName = target.name;

  target.stats.regimeSecurity = Math.max(0, target.stats.regimeSecurity - 0.06 * bonus);
  target.stats.moraleBase = Math.max(0, target.stats.moraleBase - 0.04 * bonus);
  modifyRelation(state.relations, state.playerCountryId, targetId, -12);

  for (const countryId of Object.keys(state.countries)) {
    if (countryId === state.playerCountryId || countryId === targetId) continue;
    const rel = getRelation(state.relations, countryId, targetId);
    if (rel < -20) modifyRelation(state.relations, countryId, state.playerCountryId, 3);
  }

  return { success: true, message: `Anonymous intel drop damaged ${targetName}'s standing.` };
}

export function executePressAction(
  state: GameState,
  actionId: PressActionId,
  targetId: string
): PressActionResult {
  if (actionId === 'announce_summit') {
    return dispatchSummitMission(state, targetId);
  }

  const preview = getPressActionPreview(state, actionId, targetId);
  if (!preview.canAttempt) {
    return { success: false, message: preview.blockReason ?? 'Cannot execute.' };
  }

  if (!spendActionEnergy(state, preview.energyCost)) {
    return { success: false, message: actionEnergyBlockReason(state, preview.energyCost)! };
  }
  if (!deductCost(state, preview.cost)) {
    state.actionEnergy += preview.energyCost;
    return { success: false, message: `Insufficient funds (need $${preview.cost}B).` };
  }

  let result: PressActionResult;
  switch (actionId) {
    case 'condemn_aggression':
      result = executeCondemnAggression(state, targetId);
      break;
    case 'social_media_flood':
      result = executeSocialMediaFlood(state, targetId);
      break;
    case 'info_ops_leak':
      result = executeInfoOpsLeak(state, targetId);
      break;
    default:
      return { success: false, message: 'Unknown press action.' };
  }

  if (result.success) {
    state.history.push(`Turn ${state.turn}: Press conference — ${result.message}`);
  }
  return result;
}

export const PRESS_ACTION_ORDER: PressActionId[] = [
  'condemn_aggression',
  'announce_summit',
  'social_media_flood',
  'info_ops_leak',
];

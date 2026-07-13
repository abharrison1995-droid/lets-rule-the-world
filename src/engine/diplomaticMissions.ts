import type {
  GameState,
  DiplomaticMission,
  DiplomaticMissionType,
  TalkOptionId,
  CovertTalkOptionId,
  PeaceTermsType,
} from '../types/game';
import {
  spendActionEnergy,
  actionEnergyBlockReason,
  ACTION_ENERGY_COSTS,
} from './actionEnergy';
import { deductCost } from './actions';
import { formatDisplayCost } from './treasuryDisplay';
import {
  getNegotiationPreview,
  resolveNegotiationMission,
  TALK_COSTS,
  TALK_DURATIONS,
  TALK_ENERGY_COSTS,
} from './talks';
import {
  getCovertNegotiationPreview,
  resolveCovertNegotiationMission,
  COVERT_TALK_COSTS,
  COVERT_DURATIONS,
  COVERT_ENERGY_COSTS,
} from './covertAlliances';
import { declareWar } from './diplomacy';
import { getRelation, modifyRelation } from '../data/relations';
import { resolveSummitMission } from './pressActions';

export interface MissionDispatchResult {
  success: boolean;
  message: string;
}

function missionTypeFromTalk(option: TalkOptionId): DiplomaticMissionType {
  return option;
}

function missionTypeFromCovert(option: CovertTalkOptionId): DiplomaticMissionType {
  return option;
}

export function hasPendingMission(
  state: GameState,
  targetId: string,
  type: DiplomaticMissionType
): boolean {
  return state.diplomaticMissions.some(
    m => m.targetNationId === targetId && m.type === type && m.resolveTurn > state.turn
  );
}

export function getPendingMissions(state: GameState): DiplomaticMission[] {
  return state.diplomaticMissions.filter(m => m.resolveTurn > state.turn);
}

export function getTurnsUntilResolution(state: GameState, mission: DiplomaticMission): number {
  return Math.max(0, mission.resolveTurn - state.turn);
}

export function dispatchTalkMission(
  state: GameState,
  targetId: string,
  option: TalkOptionId,
  peaceTerms?: PeaceTermsType
): MissionDispatchResult {
  const preview = getNegotiationPreview(state, state.playerCountryId, targetId, option, peaceTerms);
  if (!preview.canAttempt) {
    return { success: false, message: preview.blockReason ?? 'Cannot dispatch envoy.' };
  }

  if (option === 'peace' && !peaceTerms) {
    return { success: false, message: 'Select peace terms first.' };
  }

  if (!spendActionEnergy(state, preview.energyCost)) {
    return { success: false, message: actionEnergyBlockReason(state, preview.energyCost)! };
  }

  if (preview.cost > 0 && !deductCost(state, preview.cost)) {
    state.actionEnergy += preview.energyCost;
    return { success: false, message: `Insufficient funds (need ${formatDisplayCost(preview.cost)}).` };
  }

  const duration = TALK_DURATIONS[option];
  const targetName = state.countries[targetId]?.name ?? targetId;
  const mission: DiplomaticMission = {
    id: `mission_${option}_${targetId}_${state.turn}`,
    type: missionTypeFromTalk(option),
    targetNationId: targetId,
    dispatchedTurn: state.turn,
    resolveTurn: state.turn + duration,
    energyCost: preview.energyCost,
    goldCost: preview.cost,
    peaceTerms: option === 'peace' ? peaceTerms : undefined,
  };

  state.diplomaticMissions.push(mission);
  const eventLabel = option === 'peace' ? 'peace envoy' : 'diplomatic summit';
  state.history.push(
    `Turn ${state.turn}: ${eventLabel} dispatched to ${targetName} (${preview.label}) — returns turn ${mission.resolveTurn}.`
  );

  return {
    success: true,
    message: `Envoy dispatched to ${targetName}. Returns in ${duration} turn${duration !== 1 ? 's' : ''} (turn ${mission.resolveTurn}).`,
  };
}

export function dispatchCovertMission(
  state: GameState,
  targetId: string,
  option: CovertTalkOptionId
): MissionDispatchResult {
  const preview = getCovertNegotiationPreview(state, state.playerCountryId, targetId, option);
  if (!preview.canAttempt) {
    return { success: false, message: preview.blockReason ?? 'Cannot open backchannel.' };
  }

  if (!spendActionEnergy(state, preview.energyCost)) {
    return { success: false, message: actionEnergyBlockReason(state, preview.energyCost)! };
  }

  if (!deductCost(state, preview.cost)) {
    state.actionEnergy += preview.energyCost;
    return { success: false, message: `Insufficient funds (need ${formatDisplayCost(preview.cost)}).` };
  }

  const duration = COVERT_DURATIONS[option];
  const targetName = state.countries[targetId]?.name ?? targetId;
  const mission: DiplomaticMission = {
    id: `covert_mission_${option}_${targetId}_${state.turn}`,
    type: missionTypeFromCovert(option),
    targetNationId: targetId,
    dispatchedTurn: state.turn,
    resolveTurn: state.turn + duration,
    energyCost: preview.energyCost,
    goldCost: preview.cost,
  };

  state.diplomaticMissions.push(mission);
  state.history.push(
    `Turn ${state.turn}: Covert backchannel opened with ${targetName} (${preview.label}) — returns turn ${mission.resolveTurn}. 🔒`
  );

  return {
    success: true,
    message: `Covert envoy sent to ${targetName}. Returns in ${duration} turns. 🔒`,
  };
}

export function resolveDiplomaticMissions(state: GameState): void {
  const due = state.diplomaticMissions.filter(m => m.resolveTurn <= state.turn);
  if (due.length === 0) return;

  state.diplomaticMissions = state.diplomaticMissions.filter(m => m.resolveTurn > state.turn);

  for (const mission of due) {
    const playerId = state.playerCountryId;
    const targetName = state.countries[mission.targetNationId]?.name ?? mission.targetNationId;

    if (mission.type === 'invoke_us_support') {
      const result = resolveInvokeUsSupportMission(state, playerId, mission.targetNationId);
      state.history.push(`Turn ${state.turn}: Operation Shield Bearer — ${result.message}`);
      continue;
    }

    if (mission.type === 'summit') {
      const result = resolveSummitMission(state, mission.targetNationId);
      state.history.push(`Turn ${state.turn}: Summit with ${targetName} — ${result.message}`);
      continue;
    }

    if (mission.type === 'covert_trade' || mission.type === 'covert_military' || mission.type === 'covert_intel') {
      const covertOption = mission.type as CovertTalkOptionId;
      const result = resolveCovertNegotiationMission(state, playerId, mission.targetNationId, covertOption);
      state.history.push(`Turn ${state.turn}: Covert mission to ${targetName} — ${result.message}`);
      continue;
    }

    const talkOption = mission.type as TalkOptionId;
    if (!['peace', 'military_pact', 'trade_deal', 'intel_sharing', 'ultimatum'].includes(mission.type)) {
      continue;
    }
    const result = resolveNegotiationMission(
      state,
      playerId,
      mission.targetNationId,
      talkOption,
      mission.peaceTerms
    );
    state.history.push(`Turn ${state.turn}: Envoy returns from ${targetName} — ${result.message}`);
  }
}

export { TALK_COSTS, COVERT_TALK_COSTS, TALK_ENERGY_COSTS, COVERT_ENERGY_COSTS, ACTION_ENERGY_COSTS };

function isAtWar(state: GameState, a: string, b: string): boolean {
  return state.wars.some(w => w.belligerents.includes(a) && w.belligerents.includes(b));
}

export function getInvokeUsSupportChance(state: GameState, targetId: string): number {
  const usIsrael = getRelation(state.relations, 'usa', 'israel');
  const usTarget = getRelation(state.relations, 'usa', targetId);

  if (usIsrael < 75) return 0;

  let chance = 0.68;
  if (usTarget >= 70) chance -= 0.38;
  else if (usTarget >= 50) chance -= 0.28;
  else if (usTarget >= 30) chance -= 0.18;
  else if (usTarget >= 10) chance -= 0.1;
  else if (usTarget < -20) chance += 0.08;

  return Math.max(0.05, Math.min(0.9, chance));
}

export function dispatchInvokeUsSupportMission(
  state: GameState,
  targetId: string,
  cost: number,
  energyCost: number,
  duration: number
): MissionDispatchResult {
  if (state.playerCountryId !== 'israel') {
    return { success: false, message: 'Only Israel can invoke US-led coalition wars.' };
  }
  if (!state.countries.usa) {
    return { success: false, message: 'United States not in play.' };
  }
  if (targetId === 'usa' || targetId === 'israel') {
    return { success: false, message: 'Invalid target for coalition war.' };
  }
  if (hasPendingMission(state, targetId, 'invoke_us_support')) {
    return { success: false, message: 'Mission already in progress against this target.' };
  }

  const usIsrael = getRelation(state.relations, 'usa', 'israel');
  if (usIsrael < 75) {
    return { success: false, message: `US–Israel relations too weak (${usIsrael}/100 need 75+).` };
  }

  const targetName = state.countries[targetId]?.name ?? targetId;
  const mission: DiplomaticMission = {
    id: `invoke_us_${targetId}_${state.turn}`,
    type: 'invoke_us_support',
    targetNationId: targetId,
    dispatchedTurn: state.turn,
    resolveTurn: state.turn + duration,
    energyCost,
    goldCost: cost,
  };

  state.diplomaticMissions.push(mission);
  const chance = getInvokeUsSupportChance(state, targetId);
  state.history.push(
    `Turn ${state.turn}: Operation Shield Bearer launched against ${targetName} — returns turn ${mission.resolveTurn} (~${Math.round(chance * 100)}% success).`
  );

  return {
    success: true,
    message: `Lobbying Washington to confront ${targetName}. Mission returns in ${duration} turns (~${Math.round(chance * 100)}% success).`,
  };
}

function resolveInvokeUsSupportMission(
  state: GameState,
  playerId: string,
  targetId: string
): { success: boolean; message: string } {
  const targetName = state.countries[targetId]?.name ?? targetId;
  const chance = getInvokeUsSupportChance(state, targetId);

  if (chance <= 0) {
    return { success: false, message: 'Washington refused — bilateral ties insufficient.' };
  }

  const roll = Math.random();
  if (roll > chance) {
    modifyRelation(state.relations, 'usa', 'israel', -10);
    modifyRelation(state.relations, 'usa', playerId, -5);
    return {
      success: false,
      message: `Mission failed (${Math.round(chance * 100)}% chance). The US would not confront ${targetName}.`,
    };
  }

  if (!isAtWar(state, 'usa', targetId)) {
    declareWar(state, 'usa', targetId);
  }
  if (!isAtWar(state, playerId, targetId)) {
    declareWar(state, playerId, targetId);
  }

  modifyRelation(state.relations, 'usa', targetId, -45);
  modifyRelation(state.relations, playerId, targetId, -35);
  modifyRelation(state.relations, 'usa', 'israel', 5);

  return {
    success: true,
    message: `Success! The United States declared war on ${targetName} and Israel joined the coalition.`,
  };
}

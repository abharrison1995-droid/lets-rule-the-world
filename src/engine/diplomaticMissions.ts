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
    return { success: false, message: `Insufficient funds (need $${preview.cost}B).` };
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
    return { success: false, message: `Insufficient funds (need $${preview.cost}B).` };
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

    if (mission.type === 'covert_trade' || mission.type === 'covert_military' || mission.type === 'covert_intel') {
      const covertOption = mission.type as CovertTalkOptionId;
      const result = resolveCovertNegotiationMission(state, playerId, mission.targetNationId, covertOption);
      state.history.push(`Turn ${state.turn}: Covert mission to ${targetName} — ${result.message}`);
      continue;
    }

    const talkOption = mission.type as TalkOptionId;
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

import type { GameState, StrikeType } from '../types/game';
import { getStrikeOptions } from './strikes';
import { CAMPAIGN_DEFS } from './strikeCampaigns';
import { isAtWarWith, canAfford } from './actions';
import { getUnprovokedStrikePenalty, estimateUnprovokedSpillover } from './combat';
import { getRelation } from '../data/relations';
import { formatDisplayCost } from './treasuryDisplay';
import { canSpendActionEnergy } from './actionEnergy';
import { getReadinessBlockReason } from './warReadiness';

export interface StrikeConfirmPreview {
  kind: 'strike' | 'campaign';
  targetRegionId: string;
  targetRegionName: string;
  targetOwnerId: string;
  targetOwnerName: string;
  strikeType: StrikeType;
  strikeLabel: string;
  sourceRegionId?: string;
  sourceRegionName?: string;
  cost: number;
  sustainCost?: number;
  energyCost: number;
  canExecute: boolean;
  blockReason?: string;
  atWar: boolean;
  triggersWar: boolean;
  directRelationPenalty: number;
  spilloverHits: Array<{ countryId: string; name: string; estimatedDelta: number }>;
  triggersCondemnation: boolean;
  ongoingEscalationWarning?: string;
}

export function getStrikeConfirmPreview(
  state: GameState,
  targetRegionId: string,
  strikeType: StrikeType
): StrikeConfirmPreview | null {
  const region = state.regions[targetRegionId];
  if (!region) return null;

  const playerId = state.playerCountryId;
  const targetOwnerId = region.controlledBy;
  const options = getStrikeOptions(state, playerId, targetRegionId);
  const option = options.find(o => o.type === strikeType);
  if (!option) return null;

  const atWar = isAtWarWith(state, playerId, targetOwnerId);
  const triggersWar = !atWar;
  const directPenalty = triggersWar ? getUnprovokedStrikePenalty(strikeType) : 0;
  const spillover = triggersWar ? estimateUnprovokedSpillover(state, playerId, targetOwnerId) : [];

  let canExecute = option.available;
  let blockReason = option.blockReason;
  if (canExecute && !canSpendActionEnergy(state, option.energyCost)) {
    canExecute = false;
    blockReason = `Insufficient action energy (need ${option.energyCost}).`;
  }
  if (canExecute && !canAfford(state, option.cost)) {
    canExecute = false;
    blockReason = `Insufficient funds (need ${formatDisplayCost(option.cost)}).`;
  }
  const readinessBlock = getReadinessBlockReason(state, playerId);
  if (canExecute && readinessBlock) {
    canExecute = false;
    blockReason = readinessBlock;
  }

  return {
    kind: 'strike',
    targetRegionId,
    targetRegionName: region.name,
    targetOwnerId,
    targetOwnerName: state.countries[targetOwnerId]?.name ?? targetOwnerId,
    strikeType,
    strikeLabel: option.label,
    cost: option.cost,
    energyCost: option.energyCost,
    canExecute,
    blockReason,
    atWar,
    triggersWar,
    directRelationPenalty: directPenalty,
    spilloverHits: spillover,
    triggersCondemnation: triggersWar,
  };
}

export function getCampaignConfirmPreview(
  state: GameState,
  sourceRegionId: string,
  targetRegionId: string,
  strikeType: StrikeType
): StrikeConfirmPreview | null {
  const source = state.regions[sourceRegionId];
  const target = state.regions[targetRegionId];
  if (!source || !target) return null;

  const playerId = state.playerCountryId;
  const targetOwnerId = target.controlledBy;
  const def = CAMPAIGN_DEFS[strikeType];
  const options = getStrikeOptions(state, playerId, targetRegionId);
  const option = options.find(o => o.type === strikeType);
  if (!option) return null;

  const atWar = isAtWarWith(state, playerId, targetOwnerId);
  const triggersWar = !atWar;
  const directPenalty = triggersWar ? getUnprovokedStrikePenalty(strikeType) : 0;
  const spillover = triggersWar ? estimateUnprovokedSpillover(state, playerId, targetOwnerId) : [];
  const totalStart = def.upfrontCost + def.sustainCost;

  let canExecute = option.available;
  let blockReason = option.blockReason;
  if (canExecute && !canSpendActionEnergy(state, def.energyCost)) {
    canExecute = false;
    blockReason = `Insufficient action energy (need ${def.energyCost}).`;
  }
  if (canExecute && !canAfford(state, totalStart)) {
    canExecute = false;
    blockReason = `Insufficient funds (need ${formatDisplayCost(totalStart)}).`;
  }
  const readinessBlock = getReadinessBlockReason(state, playerId);
  if (canExecute && readinessBlock) {
    canExecute = false;
    blockReason = readinessBlock;
  }

  const currentRel = getRelation(state.relations, playerId, targetOwnerId);

  return {
    kind: 'campaign',
    targetRegionId,
    targetRegionName: target.name,
    targetOwnerId,
    targetOwnerName: state.countries[targetOwnerId]?.name ?? targetOwnerId,
    strikeType,
    strikeLabel: def.label,
    sourceRegionId,
    sourceRegionName: source.name,
    cost: totalStart,
    sustainCost: def.sustainCost,
    energyCost: def.energyCost,
    canExecute,
    blockReason,
    atWar,
    triggersWar,
    directRelationPenalty: directPenalty,
    spilloverHits: spillover,
    triggersCondemnation: triggersWar,
    ongoingEscalationWarning: triggersWar
      ? `Opening salvo will crater relations (${currentRel} → ~${currentRel - directPenalty}) and declare war. Further grey-zone bombardment before war formalizes draws escalating condemnation each turn.`
      : undefined,
  };
}

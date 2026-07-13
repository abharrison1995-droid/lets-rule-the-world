import type { GameState, StrikeCampaign } from '../types/game';
import type { StrikeType } from '../types/game';
import { getStrikeOptions, computeStrikePower } from './strikes';
import { deductCost } from './actions';
import { formatDisplayCost } from './treasuryDisplay';
import {
  spendActionEnergy,
  actionEnergyBlockReason,
} from './actionEnergy';
import { executeStrike } from './combat';
import { getRegionsForCountry } from '../data/regions';
import { isAtWarWith } from './actions';
import { getRelation, modifyRelation } from '../data/relations';
import { triggerUnprovokedStrikeEvent } from './events';
import {
  drainReadinessForCampaignSustain,
  getReadinessBlockReason,
  getWarReadiness,
  READINESS_CAMPAIGN_HALT,
} from './warReadiness';

export interface CampaignDefinition {
  type: StrikeType;
  label: string;
  description: string;
  upfrontCost: number;
  sustainCost: number;
  powerScale: number;
  energyCost: number;
}

export const CAMPAIGN_DEFS: Record<StrikeType, CampaignDefinition> = {
  artillery: {
    type: 'artillery',
    label: 'Artillery Barrage',
    description: 'Sustained shelling from a bordering region — cheap, close-range only.',
    upfrontCost: 3,
    sustainCost: 2,
    powerScale: 0.9,
    energyCost: 1,
  },
  drone: {
    type: 'drone',
    label: 'Drone Campaign',
    description: 'Persistent loitering-munition strikes — steady damage, moderate cost.',
    upfrontCost: 6,
    sustainCost: 4,
    powerScale: 1.1,
    energyCost: 1,
  },
  cruise: {
    type: 'cruise',
    label: 'Missile Barrage',
    description: 'Repeated cruise-missile salvos — strong sustained pressure.',
    upfrontCost: 14,
    sustainCost: 9,
    powerScale: 1.35,
    energyCost: 1,
  },
  ballistic: {
    type: 'ballistic',
    label: 'Saturation Bombardment',
    description: 'Heavy ballistic fires — devastating but expensive to sustain.',
    upfrontCost: 22,
    sustainCost: 15,
    powerScale: 1.6,
    energyCost: 2,
  },
  icbm: {
    type: 'icbm',
    label: 'Strategic Strike Campaign',
    description: 'Repeated strategic launches — ruinous upkeep, maximum destruction.',
    upfrontCost: 35,
    sustainCost: 22,
    powerScale: 1.9,
    energyCost: 2,
  },
};

const SUSTAIN_ESCALATION_PENALTY: Record<StrikeType, number> = {
  artillery: 6,
  drone: 9,
  cruise: 12,
  ballistic: 15,
  icbm: 18,
};

function applyUnprovokedCampaignEscalation(state: GameState, campaign: StrikeCampaign): void {
  const target = state.regions[campaign.targetRegionId];
  const attacker = state.countries[campaign.attackerCountryId];
  if (!target || !attacker) return;

  const victimId = target.controlledBy;
  if (isAtWarWith(state, campaign.attackerCountryId, victimId)) {
    campaign.startedUnprovoked = false;
    return;
  }
  const sustainTurns = state.turn - campaign.startTurn;
  const penalty = SUSTAIN_ESCALATION_PENALTY[campaign.strikeType] ?? 10;

  modifyRelation(state.relations, campaign.attackerCountryId, victimId, -penalty);

  for (const countryId of Object.keys(state.countries)) {
    if (countryId === campaign.attackerCountryId || countryId === victimId) continue;
    const allyToVictim = getRelation(state.relations, countryId, victimId);
    if (allyToVictim > 20) {
      modifyRelation(state.relations, countryId, campaign.attackerCountryId, -Math.round(3 + allyToVictim * 0.06));
    }
  }

  attacker.stats.warExhaustion = Math.min(1, (attacker.stats.warExhaustion ?? 0) + 0.015);

  if (campaign.attackerCountryId === state.playerCountryId) {
    attacker.stats.warPopularity = Math.max(0, attacker.stats.warPopularity - 0.04);
    if (sustainTurns > 0 && sustainTurns % 2 === 0) {
      state.internationalPariahTurns = Math.max(state.internationalPariahTurns, 2);
    }
    if (sustainTurns > 0 && sustainTurns % 4 === 0) {
      triggerUnprovokedStrikeEvent(state);
    }
    const victimName = state.countries[victimId]?.name ?? victimId;
    state.history.push(
      `Turn ${state.turn}: Sustained bombardment of ${victimName} draws global condemnation (−${penalty} relations).`
    );
  }
}

export function getPlayerCampaigns(state: GameState): StrikeCampaign[] {
  return (state.strikeCampaigns ?? []).filter(c => c.attackerCountryId === state.playerCountryId);
}

export function getCampaignsTargetingPlayer(state: GameState): StrikeCampaign[] {
  const playerId = state.playerCountryId;
  return (state.strikeCampaigns ?? []).filter(c => {
    if (c.attackerCountryId === playerId) return false;
    const target = state.regions[c.targetRegionId];
    return target?.controlledBy === playerId;
  });
}

export function hasCampaignOnTarget(
  state: GameState,
  sourceRegionId: string,
  targetRegionId: string
): boolean {
  return (state.strikeCampaigns ?? []).some(
    c => c.sourceRegionId === sourceRegionId && c.targetRegionId === targetRegionId
  );
}

export function playerStartStrikeCampaign(
  state: GameState,
  sourceRegionId: string,
  targetRegionId: string,
  strikeType: StrikeType
): string | null {
  const source = state.regions[sourceRegionId];
  const target = state.regions[targetRegionId];
  if (!source || !target) return 'Invalid region.';

  if (source.controlledBy !== state.playerCountryId) {
    return 'You must launch from your own territory.';
  }
  if (target.controlledBy === state.playerCountryId) {
    return 'Cannot strike your own territory.';
  }

  const def = CAMPAIGN_DEFS[strikeType];
  const options = getStrikeOptions(state, state.playerCountryId, targetRegionId);
  const option = options.find(o => o.type === strikeType);
  if (!option) return 'Unknown campaign type.';
  if (!option.available) return option.blockReason ?? 'Campaign unavailable at this range.';

  if (hasCampaignOnTarget(state, sourceRegionId, targetRegionId)) {
    return 'A campaign is already active from this region against that target.';
  }

  const readinessBlock = getReadinessBlockReason(state, state.playerCountryId);
  if (readinessBlock) return readinessBlock;

  if (!spendActionEnergy(state, def.energyCost)) {
    return actionEnergyBlockReason(state, def.energyCost)!;
  }

  const totalStart = def.upfrontCost + def.sustainCost;
  if (!deductCost(state, totalStart)) {
    state.actionEnergy += def.energyCost;
    return `Insufficient funds (need ${formatDisplayCost(totalStart)} to open campaign).`;
  }

  const atWar = isAtWarWith(state, state.playerCountryId, target.controlledBy);
  const campaign: StrikeCampaign = {
    id: `campaign_${sourceRegionId}_${targetRegionId}_${state.turn}`,
    attackerCountryId: state.playerCountryId,
    sourceRegionId,
    targetRegionId,
    strikeType,
    startTurn: state.turn,
    startedUnprovoked: !atWar,
  };

  if (!state.strikeCampaigns) state.strikeCampaigns = [];
  state.strikeCampaigns.push(campaign);

  const attacker = state.countries[state.playerCountryId];
  const strikePower = computeStrikePower(attacker!, strikeType, option.power * def.powerScale);
  executeStrike(state, state.playerCountryId, targetRegionId, strikePower, strikeType);

  const campaignEntry = state.strikeCampaigns![state.strikeCampaigns!.length - 1];
  if (isAtWarWith(state, state.playerCountryId, target.controlledBy)) {
    campaignEntry.startedUnprovoked = false;
  }

  state.history.push(
    `Turn ${state.turn}: ${def.label} opened from ${source.name} against ${target.name} (${formatDisplayCost(def.sustainCost)}/turn).`
  );
  return null;
}

export function playerCancelStrikeCampaign(state: GameState, campaignId: string): string | null {
  const idx = (state.strikeCampaigns ?? []).findIndex(c => c.id === campaignId);
  if (idx === -1) return 'Campaign not found.';
  const campaign = state.strikeCampaigns![idx];
  if (campaign.attackerCountryId !== state.playerCountryId) return 'Not your campaign.';

  state.strikeCampaigns!.splice(idx, 1);
  const target = state.regions[campaign.targetRegionId];
  state.history.push(
    `Turn ${state.turn}: Strike campaign against ${target?.name ?? 'target'} stood down.`
  );
  return null;
}

export function resolveStrikeCampaigns(state: GameState): void {
  const campaigns = [...(state.strikeCampaigns ?? [])];
  if (campaigns.length === 0) return;

  const surviving: StrikeCampaign[] = [];

  for (const campaign of campaigns) {
    const target = state.regions[campaign.targetRegionId];
    const source = state.regions[campaign.sourceRegionId];
    const attacker = state.countries[campaign.attackerCountryId];
    if (!target || !source || !attacker) continue;

    if (source.controlledBy !== campaign.attackerCountryId) {
      state.history.push(`Turn ${state.turn}: Strike campaign ended — launch region lost.`);
      continue;
    }
    if (target.controlledBy === campaign.attackerCountryId) {
      state.history.push(`Turn ${state.turn}: Strike campaign ended — target captured.`);
      continue;
    }

    const def = CAMPAIGN_DEFS[campaign.strikeType];
    const isPlayer = campaign.attackerCountryId === state.playerCountryId;

    if (isPlayer && getWarReadiness(attacker) < READINESS_CAMPAIGN_HALT) {
      state.history.push(
        `Turn ${state.turn}: ${def.label} against ${target.name} halted — war weariness (${Math.round(getWarReadiness(attacker) * 100)}% readiness).`
      );
      continue;
    }

    if (isPlayer && !deductCost(state, def.sustainCost)) {
      state.history.push(
        `Turn ${state.turn}: ${def.label} against ${target.name} halted — insufficient funds (${formatDisplayCost(def.sustainCost)}/turn).`
      );
      continue;
    }
    if (!isPlayer) {
      attacker.stats.treasuryPoints = Math.max(5, attacker.stats.treasuryPoints - def.sustainCost);
    }

    const options = getStrikeOptions(state, campaign.attackerCountryId, campaign.targetRegionId);
    const option = options.find(o => o.type === campaign.strikeType);
    if (!option?.available) {
      state.history.push(`Turn ${state.turn}: ${def.label} ended — target out of range.`);
      continue;
    }

    const strikePower = computeStrikePower(attacker, campaign.strikeType, option.power * def.powerScale * 0.85);
    executeStrike(state, campaign.attackerCountryId, campaign.targetRegionId, strikePower, campaign.strikeType);
    drainReadinessForCampaignSustain(attacker, campaign.strikeType);

    if (campaign.startedUnprovoked && !isAtWarWith(state, campaign.attackerCountryId, target.controlledBy)) {
      applyUnprovokedCampaignEscalation(state, campaign);
    } else if (campaign.startedUnprovoked) {
      campaign.startedUnprovoked = false;
    }

    surviving.push(campaign);
  }

  state.strikeCampaigns = surviving;
}

export function getLaunchRegions(_state: GameState, countryId: string): string[] {
  return getRegionsForCountry(countryId).map(r => r.id);
}

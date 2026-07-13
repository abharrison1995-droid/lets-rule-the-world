import type { GameState, AllianceTier, TalkOptionId, NegotiationPreview, PeaceTermsType, DiplomaticMissionType } from '../types/game';
import { getRelation, modifyRelation } from '../data/relations';
import {
  computeAllianceScore,
  proposeAlliance,
  findAllianceBetween,
  upgradeAlliance,
} from './diplomacy';
import { proposePeace, getPeaceOptions, calculatePeaceAcceptance } from './peace';
import { formatRelationValue, previewPeaceReconciliation } from './conflictRelations';
import { previewSpendFiscalImpact } from './fiscal';
import { actionEnergyBlockReason } from './actionEnergy';
import { getRegionsForCountry } from '../data/regions';

const TIER_ORDER: AllianceTier[] = ['informal', 'defensive_pact', 'full_alliance', 'bloc'];

/** Raised costs — consequential diplomacy is expensive */
export const TALK_COSTS: Record<TalkOptionId, number> = {
  peace: 4,
  military_pact: 20,
  trade_deal: 11,
  intel_sharing: 8,
  ultimatum: 7,
};

export const TALK_DURATIONS: Record<TalkOptionId, number> = {
  peace: 2,
  military_pact: 4,
  trade_deal: 2,
  intel_sharing: 3,
  ultimatum: 2,
};

export const TALK_ENERGY_COSTS: Record<TalkOptionId, number> = {
  peace: 1,
  military_pact: 2,
  trade_deal: 1,
  intel_sharing: 1,
  ultimatum: 1,
};

const TALK_LABELS: Record<TalkOptionId, string> = {
  peace: 'Propose peace terms',
  military_pact: 'Discuss military pact',
  trade_deal: 'Trade agreement',
  intel_sharing: 'Intel sharing pact',
  ultimatum: 'Issue ultimatum',
};

function isAtWarWith(state: GameState, a: string, b: string): boolean {
  return state.wars.some(w => w.belligerents.includes(a) && w.belligerents.includes(b));
}

function agreementKey(a: string, b: string): string {
  return [a, b].sort().join('|');
}

function hasPendingMission(state: GameState, targetId: string, type: DiplomaticMissionType): boolean {
  return state.diplomaticMissions.some(
    m => m.targetNationId === targetId && m.type === type && m.resolveTurn > state.turn
  );
}

export function hasBilateralAgreement(
  state: GameState,
  a: string,
  b: string,
  type: 'trade' | 'intel'
): boolean {
  const key = agreementKey(a, b);
  return state.bilateralAgreements.some(
    ag => ag.type === type && agreementKey(ag.a, ag.b) === key
  );
}

export function getAgreementsWithNation(state: GameState, playerId: string, otherId: string) {
  const key = agreementKey(playerId, otherId);
  return state.bilateralAgreements.filter(
    ag => agreementKey(ag.a, ag.b) === key
  );
}

function calculateNegotiationAcceptance(
  state: GameState,
  playerId: string,
  targetId: string,
  option: TalkOptionId
): number {
  if (option === 'peace') return 0;

  const relation = getRelation(state.relations, playerId, targetId);
  const alliance = findAllianceBetween(state, playerId, targetId);
  const allianceScore = computeAllianceScore(state, playerId, targetId);
  const target = state.countries[targetId];
  const difficulty = target?.difficultyRating.score ?? 5;

  let score: number;
  if (alliance) {
    const tierBase: Record<string, number> = {
      informal: 0.38,
      defensive_pact: 0.52,
      full_alliance: 0.62,
      bloc: 0.58,
    };
    score = tierBase[alliance.tier] ?? 0.4;
    score += relation / 250;
  } else {
    score = 0.06;
    score += relation / 220;
    score += allianceScore / 350;
    score += state.budget.diplomacy * 0.002;
    if (relation < 25) score *= 0.25;
    if (relation < 0) score *= 0.15;
    if (relation > 50) score += 0.08;
  }

  score -= (difficulty - 5) * 0.035;

  if (isAtWarWith(state, playerId, targetId)) return 0;

  if (option === 'military_pact') {
    const existing = findAllianceBetween(state, playerId, targetId);
    if (existing) {
      const idx = TIER_ORDER.indexOf(existing.tier);
      if (idx >= TIER_ORDER.indexOf('full_alliance')) return 0;
      score += alliance ? 0.12 : 0.04;
    }
    if (!alliance && relation < 25) score *= 0.3;
  } else if (option === 'trade_deal') {
    if (!alliance) {
      if (relation < 0) score *= 0.2;
      else if (relation > 40) score += 0.06;
    }
  } else if (option === 'intel_sharing') {
    if (!alliance && relation < 15) score *= 0.25;
    if (alliance || findAllianceBetween(state, playerId, targetId)) score += 0.1;
  } else if (option === 'ultimatum') {
    const player = state.countries[playerId];
    if (player && target) {
      const powerRatio = player.stats.treasuryPoints / Math.max(1, target.stats.treasuryPoints);
      score += Math.min(0.12, powerRatio * 0.04);
    }
    if (!alliance) score *= 0.5;
    if (relation < -40) score *= 0.4;
  }

  const cap = alliance ? 0.92 : 0.38;
  return Math.max(0.03, Math.min(cap, score));
}

function getMilitaryPactEffects(state: GameState, playerId: string, targetId: string): string[] {
  const existing = findAllianceBetween(state, playerId, targetId);
  if (!existing) {
    const chance = calculateNegotiationAcceptance(state, playerId, targetId, 'military_pact');
    if (chance > 0.65) return ['Forms full military alliance', '+15 relations', 'Allies may join your wars'];
    if (chance > 0.4) return ['Forms defensive pact', '+15 relations', 'Allies may join defensive wars'];
    return ['Forms informal pact', '+15 relations'];
  }
  const idx = TIER_ORDER.indexOf(existing.tier);
  if (idx < TIER_ORDER.indexOf('defensive_pact')) return ['Upgrades to defensive pact', '+10 relations'];
  if (idx < TIER_ORDER.indexOf('full_alliance')) return ['Upgrades to full military alliance', '+10 relations'];
  return ['Alliance already at maximum tier'];
}

function getBlockReason(
  state: GameState,
  playerId: string,
  targetId: string,
  option: TalkOptionId
): string | undefined {
  if (hasPendingMission(state, targetId, option)) {
    return 'An envoy is already en route for this negotiation.';
  }

  const energyReason = actionEnergyBlockReason(state, TALK_ENERGY_COSTS[option]);
  if (energyReason) return energyReason;

  const atWar = isAtWarWith(state, playerId, targetId);

  if (option === 'peace') {
    if (!atWar) return 'Only available during wartime.';
    return undefined;
  }

  if (atWar) return 'Cannot negotiate while at war.';

  const relation = getRelation(state.relations, playerId, targetId);

  if (option === 'military_pact') {
    if (relation < 25) return 'Relations must be at least +25.';
    const existing = findAllianceBetween(state, playerId, targetId);
    if (existing && TIER_ORDER.indexOf(existing.tier) >= TIER_ORDER.indexOf('full_alliance')) {
      return 'Military alliance already at maximum tier.';
    }
  }

  if (option === 'trade_deal') {
    if (relation < 0) return 'Relations must be at least 0.';
    if (hasBilateralAgreement(state, playerId, targetId, 'trade')) {
      return 'Trade agreement already in place.';
    }
  }

  if (option === 'intel_sharing') {
    if (relation < 15) return 'Relations must be at least +15.';
    if (hasBilateralAgreement(state, playerId, targetId, 'intel')) {
      return 'Intel sharing pact already in place.';
    }
  }

  if (option === 'ultimatum' && isAtWarWith(state, playerId, targetId)) {
    return 'Cannot issue ultimatum while at war — use peace envoy instead.';
  }

  return undefined;
}

export function getNegotiationPreview(
  state: GameState,
  playerId: string,
  targetId: string,
  option: TalkOptionId,
  peaceTerms?: PeaceTermsType
): NegotiationPreview {
  const blockReason = getBlockReason(state, playerId, targetId, option);
  const cost = TALK_COSTS[option];
  const energyCost = TALK_ENERGY_COSTS[option];
  const durationTurns = TALK_DURATIONS[option];

  let acceptanceChance = 0;
  let effects: string[] = [];
  let description = '';

  if (option === 'peace' && peaceTerms) {
    acceptanceChance = Math.round(calculatePeaceAcceptance(state, targetId, peaceTerms) * 100);
    const recon = previewPeaceReconciliation(state, playerId, targetId, peaceTerms);
    effects = [
      `Ends war on ${peaceTerms.replace('_', ' ')} terms`,
      `Relations after peace: ${formatRelationValue(recon.current)} → ~${formatRelationValue(recon.projected)}`,
    ];
    description = 'Send a peace envoy for back-channel talks.';
  } else if (option === 'peace') {
    description = 'Select peace terms to see acceptance odds.';
    effects = ['Ends active war', `Envoy returns in ${durationTurns} turns`];
  } else {
    acceptanceChance = Math.round(calculateNegotiationAcceptance(state, playerId, targetId, option) * 100);
    if (option === 'military_pact') {
      effects = [...getMilitaryPactEffects(state, playerId, targetId), `Summit lasts ${durationTurns} turns`];
      description = 'Host a diplomatic summit for a formal military partnership.';
    } else if (option === 'trade_deal') {
      effects = ['+0.8% GDP growth for both nations', '+5 relations', `Envoy returns in ${durationTurns} turns`];
      description = 'Send a trade delegation to negotiate liberalization.';
    } else if (option === 'intel_sharing') {
      effects = ['+5% counter-intelligence effectiveness', '+5 relations', `Envoy returns in ${durationTurns} turns`];
      description = 'Dispatch intelligence liaisons for coordination.';
    } else if (option === 'ultimatum') {
      effects = ['On accept: +10 relations, target unrest +8', 'On reject: −15 relations', `Envoy returns in ${durationTurns} turns`];
      description = 'Deliver a formal demand — backed by your national weight.';
    }
  }

  return {
    optionId: option,
    label: TALK_LABELS[option],
    description,
    canAttempt: !blockReason,
    blockReason,
    cost,
    energyCost,
    durationTurns,
    acceptanceChance,
    effects,
    fiscal: previewSpendFiscalImpact(state, playerId, cost),
  };
}

export function getAllNegotiationPreviews(
  state: GameState,
  playerId: string,
  targetId: string
): NegotiationPreview[] {
  const options: TalkOptionId[] = ['peace', 'military_pact', 'trade_deal', 'intel_sharing', 'ultimatum'];
  return options.map(opt => getNegotiationPreview(state, playerId, targetId, opt));
}

export interface NegotiationResult {
  success: boolean;
  message: string;
}

function formBilateralAgreement(
  state: GameState,
  playerId: string,
  targetId: string,
  type: 'trade' | 'intel'
): void {
  state.bilateralAgreements.push({
    id: `${type}_${playerId}_${targetId}_${state.turn}`,
    type,
    a: playerId,
    b: targetId,
    formedTurn: state.turn,
  });
}

function resolveMilitaryPact(
  state: GameState,
  playerId: string,
  targetId: string,
  acceptance: number
): NegotiationResult {
  const existing = findAllianceBetween(state, playerId, targetId);
  const playerName = state.countries[playerId]?.name ?? playerId;
  const targetName = state.countries[targetId]?.name ?? targetId;

  if (!existing) {
    if (acceptance > 0.65) {
      proposeAlliance(state, playerId, targetId, 'full_alliance');
      return { success: true, message: `${targetName} accepted a full military alliance.` };
    }
    if (acceptance > 0.4) {
      proposeAlliance(state, playerId, targetId, 'defensive_pact');
      return { success: true, message: `${targetName} accepted a defensive pact.` };
    }
    proposeAlliance(state, playerId, targetId, 'informal');
    return { success: true, message: `${targetName} agreed to an informal security partnership.` };
  }

  const idx = TIER_ORDER.indexOf(existing.tier);
  if (idx < TIER_ORDER.indexOf('defensive_pact')) {
    upgradeAlliance(state, existing.id, 'defensive_pact');
    modifyRelation(state.relations, playerId, targetId, 10);
    state.history.push(`Turn ${state.turn}: ${playerName} upgraded pact with ${targetName} to defensive.`);
    return { success: true, message: `${targetName} upgraded to a defensive pact.` };
  }
  if (idx < TIER_ORDER.indexOf('full_alliance')) {
    upgradeAlliance(state, existing.id, 'full_alliance');
    modifyRelation(state.relations, playerId, targetId, 10);
    state.history.push(`Turn ${state.turn}: ${playerName} upgraded pact with ${targetName} to full alliance.`);
    return { success: true, message: `${targetName} upgraded to a full military alliance.` };
  }

  return { success: false, message: 'Alliance cannot be upgraded further.' };
}

/** Resolve when envoy returns — called from diplomaticMissions tick */
export function resolveNegotiationMission(
  state: GameState,
  playerId: string,
  targetId: string,
  option: TalkOptionId,
  peaceTerms?: PeaceTermsType
): NegotiationResult {
  const targetName = state.countries[targetId]?.name ?? targetId;

  if (option === 'peace') {
    if (!peaceTerms) return { success: false, message: 'Peace mission lacked terms.' };
    const result = proposePeace(state, targetId, peaceTerms);
    return { success: result.accepted, message: result.message };
  }

  const acceptance = calculateNegotiationAcceptance(state, playerId, targetId, option);

  if (Math.random() > acceptance) {
    modifyRelation(state.relations, playerId, targetId, -8);
    return { success: false, message: `${targetName} rejected the ${TALK_LABELS[option].toLowerCase()}.` };
  }

  if (option === 'military_pact') {
    return resolveMilitaryPact(state, playerId, targetId, acceptance);
  }

  if (option === 'trade_deal') {
    formBilateralAgreement(state, playerId, targetId, 'trade');
    modifyRelation(state.relations, playerId, targetId, 5);
    return { success: true, message: `Trade agreement signed with ${targetName}.` };
  }

  if (option === 'intel_sharing') {
    formBilateralAgreement(state, playerId, targetId, 'intel');
    modifyRelation(state.relations, playerId, targetId, 5);
    return { success: true, message: `Intel sharing pact established with ${targetName}.` };
  }

  if (option === 'ultimatum') {
    const acceptance = calculateNegotiationAcceptance(state, playerId, targetId, 'ultimatum');
    if (Math.random() > acceptance) {
      modifyRelation(state.relations, playerId, targetId, -15);
      return { success: false, message: `${targetName} rejected the ultimatum.` };
    }
    modifyRelation(state.relations, playerId, targetId, 10);
    for (const region of getRegionsForCountry(targetId)) {
      region.unrest = Math.min(100, region.unrest + 8);
    }
    return { success: true, message: `${targetName} conceded to the ultimatum.` };
  }

  return { success: false, message: 'Unknown negotiation.' };
}

export function computeTradeAgreementBonus(state: GameState, countryId: string): number {
  let bonus = 0;
  for (const ag of state.bilateralAgreements) {
    if (ag.type !== 'trade') continue;
    if (ag.a === countryId || ag.b === countryId) bonus += 0.008;
  }
  return bonus;
}

export function computeIntelAgreementBonus(state: GameState, countryId: string): number {
  if (countryId !== state.playerCountryId) return 0;
  let count = 0;
  for (const ag of state.bilateralAgreements) {
    if (ag.type !== 'intel') continue;
    if (ag.a === countryId || ag.b === countryId) count++;
  }
  return count * 0.05;
}

export { getPeaceOptions };

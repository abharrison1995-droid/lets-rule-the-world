import type { GameState, AllianceTier, TalkOptionId, NegotiationPreview, PeaceTermsType } from '../types/game';
import { getRelation, modifyRelation } from '../data/relations';
import {
  computeAllianceScore,
  proposeAlliance,
  findAllianceBetween,
  upgradeAlliance,
} from './diplomacy';
import { proposePeace, getPeaceOptions, calculatePeaceAcceptance } from './peace';

const TIER_ORDER: AllianceTier[] = ['informal', 'defensive_pact', 'full_alliance', 'bloc'];

export const TALK_COSTS: Record<TalkOptionId, number> = {
  peace: 0,
  military_pact: 30,
  trade_deal: 15,
  intel_sharing: 20,
};

const TALK_LABELS: Record<TalkOptionId, string> = {
  peace: 'Propose peace terms',
  military_pact: 'Discuss military pact',
  trade_deal: 'Trade agreement',
  intel_sharing: 'Intel sharing pact',
};

function isAtWarWith(state: GameState, a: string, b: string): boolean {
  return state.wars.some(w => w.belligerents.includes(a) && w.belligerents.includes(b));
}

function agreementKey(a: string, b: string): string {
  return [a, b].sort().join('|');
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

function hasTalkedThisTurn(state: GameState, targetId: string): boolean {
  return state.talksAttemptedThisTurn.includes(targetId);
}

function calculateNegotiationAcceptance(
  state: GameState,
  playerId: string,
  targetId: string,
  option: TalkOptionId
): number {
  if (option === 'peace') return 0;

  const relation = getRelation(state.relations, playerId, targetId);
  const allianceScore = computeAllianceScore(state, playerId, targetId);
  const target = state.countries[targetId];
  const difficulty = target?.difficultyRating.score ?? 5;

  let score = 0.35;
  score += relation / 120;
  score += allianceScore / 200;
  score += state.budget.diplomacy * 0.004;
  score -= (difficulty - 5) * 0.04;

  if (isAtWarWith(state, playerId, targetId)) return 0;

  if (option === 'military_pact') {
    const existing = findAllianceBetween(state, playerId, targetId);
    if (existing) {
      const idx = TIER_ORDER.indexOf(existing.tier);
      if (idx >= TIER_ORDER.indexOf('full_alliance')) return 0;
      score += 0.1;
    }
    if (relation < 25) score *= 0.5;
  } else if (option === 'trade_deal') {
    if (relation < 0) score *= 0.4;
    else if (relation > 40) score += 0.15;
  } else if (option === 'intel_sharing') {
    if (relation < 15) score *= 0.5;
    const existingMil = findAllianceBetween(state, playerId, targetId);
    if (existingMil) score += 0.12;
  }

  return Math.max(0.05, Math.min(0.95, score));
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
  if (hasTalkedThisTurn(state, targetId)) {
    return 'Already held talks with this nation this turn.';
  }

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

  let acceptanceChance = 0;
  let effects: string[] = [];
  let description = '';

  if (option === 'peace' && peaceTerms) {
    acceptanceChance = Math.round(calculatePeaceAcceptance(state, targetId, peaceTerms) * 100);
    effects = [`Ends war on ${peaceTerms.replace('_', ' ')} terms`];
    description = 'Private back-channel peace proposal.';
  } else if (option === 'peace') {
    description = 'Select peace terms to see acceptance odds.';
    effects = ['Ends active war'];
  } else {
    acceptanceChance = Math.round(calculateNegotiationAcceptance(state, playerId, targetId, option) * 100);
    if (option === 'military_pact') {
      effects = getMilitaryPactEffects(state, playerId, targetId);
      description = 'Propose a formal military partnership.';
    } else if (option === 'trade_deal') {
      effects = ['+0.8% GDP growth for both nations', '+5 relations'];
      description = 'Bilateral trade liberalization.';
    } else if (option === 'intel_sharing') {
      effects = ['+5% counter-intelligence effectiveness', '+5 relations'];
      description = 'Coordinate intelligence against shared threats.';
    }
  }

  return {
    optionId: option,
    label: TALK_LABELS[option],
    description,
    canAttempt: !blockReason,
    blockReason,
    cost,
    acceptanceChance,
    effects,
  };
}

export function getAllNegotiationPreviews(
  state: GameState,
  playerId: string,
  targetId: string
): NegotiationPreview[] {
  const options: TalkOptionId[] = ['peace', 'military_pact', 'trade_deal', 'intel_sharing'];
  return options.map(opt => getNegotiationPreview(state, playerId, targetId, opt));
}

export interface NegotiationResult {
  success: boolean;
  message: string;
}

function markTalkAttempted(state: GameState, targetId: string): void {
  if (!state.talksAttemptedThisTurn.includes(targetId)) {
    state.talksAttemptedThisTurn.push(targetId);
  }
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

export function executeNegotiation(
  state: GameState,
  playerId: string,
  targetId: string,
  option: TalkOptionId,
  peaceTerms?: PeaceTermsType
): NegotiationResult {
  const preview = getNegotiationPreview(state, playerId, targetId, option, peaceTerms);
  if (!preview.canAttempt) {
    return { success: false, message: preview.blockReason ?? 'Cannot negotiate.' };
  }

  if (option === 'peace') {
    if (!peaceTerms) return { success: false, message: 'Select peace terms first.' };
    markTalkAttempted(state, targetId);
    const result = proposePeace(state, targetId, peaceTerms);
    return { success: result.accepted, message: result.message };
  }

  const acceptance = calculateNegotiationAcceptance(state, playerId, targetId, option);
  const targetName = state.countries[targetId]?.name ?? targetId;
  const playerName = state.countries[playerId]?.name ?? playerId;

  if (Math.random() > acceptance) {
    markTalkAttempted(state, targetId);
    modifyRelation(state.relations, playerId, targetId, -8);
    state.history.push(`Turn ${state.turn}: ${targetName} rejected ${playerName}'s ${TALK_LABELS[option].toLowerCase()}.`);
    return { success: false, message: `${targetName} rejected the proposal.` };
  }

  markTalkAttempted(state, targetId);

  if (option === 'military_pact') {
    return resolveMilitaryPact(state, playerId, targetId, acceptance);
  }

  if (option === 'trade_deal') {
    formBilateralAgreement(state, playerId, targetId, 'trade');
    modifyRelation(state.relations, playerId, targetId, 5);
    state.history.push(`Turn ${state.turn}: ${playerName} and ${targetName} signed a trade agreement.`);
    return { success: true, message: `Trade agreement signed with ${targetName}.` };
  }

  if (option === 'intel_sharing') {
    formBilateralAgreement(state, playerId, targetId, 'intel');
    modifyRelation(state.relations, playerId, targetId, 5);
    state.history.push(`Turn ${state.turn}: ${playerName} and ${targetName} established intel sharing.`);
    return { success: true, message: `Intel sharing pact established with ${targetName}.` };
  }

  return { success: false, message: 'Unknown negotiation option.' };
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

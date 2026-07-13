import type {
  GameState,
  CovertTalkOptionId,
  CovertNegotiationPreview,
  CovertAgreementType,
  CovertAlliance,
} from '../types/game';
import { getRelation, modifyRelation } from '../data/relations';
import { computeAllianceScore } from './diplomacy';
import { hasBilateralAgreement } from './talks';

export const COVERT_TALK_COSTS: Record<CovertTalkOptionId, number> = {
  covert_trade: 20,
  covert_military: 35,
  covert_intel: 25,
};

const COVERT_LABELS: Record<CovertTalkOptionId, string> = {
  covert_trade: 'Covert trade deal',
  covert_military: 'Covert military coordination',
  covert_intel: 'Covert intel sharing',
};

const COVERT_TO_TYPE: Record<CovertTalkOptionId, CovertAgreementType> = {
  covert_trade: 'trade',
  covert_military: 'military',
  covert_intel: 'intel',
};

const BASE_EXPOSURE_RISK: Record<CovertAgreementType, number> = {
  trade: 4,
  military: 8,
  intel: 6,
};

function agreementKey(a: string, b: string): string {
  return [a, b].sort().join('|');
}

export function getActiveCovertAlliances(state: GameState, countryId: string): CovertAlliance[] {
  return state.covertAlliances.filter(
    ca => !ca.exposed && (ca.a === countryId || ca.b === countryId)
  );
}

export function getCovertAlliancesWithNation(
  state: GameState,
  playerId: string,
  otherId: string
): CovertAlliance[] {
  const key = agreementKey(playerId, otherId);
  return state.covertAlliances.filter(
    ca => !ca.exposed && agreementKey(ca.a, ca.b) === key
  );
}

export function hasCovertAlliance(
  state: GameState,
  a: string,
  b: string,
  type: CovertAgreementType
): boolean {
  const key = agreementKey(a, b);
  return state.covertAlliances.some(
    ca => !ca.exposed && ca.type === type && agreementKey(ca.a, ca.b) === key
  );
}

function hasCovertTalkedThisTurn(state: GameState, targetId: string): boolean {
  return state.covertTalksAttemptedThisTurn.includes(targetId);
}

function calculateCovertAcceptance(
  state: GameState,
  playerId: string,
  targetId: string,
  option: CovertTalkOptionId
): number {
  const relation = getRelation(state.relations, playerId, targetId);
  const allianceScore = computeAllianceScore(state, playerId, targetId);
  const target = state.countries[targetId];
  const difficulty = target?.difficultyRating.score ?? 5;

  let score = 0.25;
  score += relation / 100;
  score += allianceScore / 250;
  score += state.budget.covert * 0.006;
  score -= (difficulty - 5) * 0.05;

  const type = COVERT_TO_TYPE[option];
  if (type === 'trade' && relation >= 0) score += 0.1;
  if (type === 'military' && relation >= 20) score += 0.08;
  if (type === 'intel' && relation >= 10) score += 0.08;

  return Math.max(0.08, Math.min(0.88, score));
}

function getCovertEffects(option: CovertTalkOptionId): string[] {
  switch (option) {
    case 'covert_trade':
      return ['+0.5% GDP growth (hidden)', 'No public relation shift', 'Leaks if exposed'];
    case 'covert_military':
      return ['Secret war support (30% join chance)', 'Hidden from alliance map', 'High exposure risk'];
    case 'covert_intel':
      return ['+3% counter-intel per pact', 'Hidden from rivals', 'Leaks if exposed'];
  }
}

function getBlockReason(
  state: GameState,
  playerId: string,
  targetId: string,
  option: CovertTalkOptionId
): string | undefined {
  if (hasCovertTalkedThisTurn(state, targetId)) {
    return 'Covert backchannel already used with this nation this turn.';
  }

  const type = COVERT_TO_TYPE[option];
  if (hasCovertAlliance(state, playerId, targetId, type)) {
    return `Covert ${type} pact already active.`;
  }

  if (type === 'trade' && hasBilateralAgreement(state, playerId, targetId, 'trade')) {
    return 'Overt trade deal already in place.';
  }
  if (type === 'intel' && hasBilateralAgreement(state, playerId, targetId, 'intel')) {
    return 'Overt intel pact already in place.';
  }

  const relation = getRelation(state.relations, playerId, targetId);

  if (type === 'trade' && relation < -30) {
    return 'Relations too hostile for backchannel trade.';
  }
  if (type === 'military' && relation < -10) {
    return 'Relations too hostile for covert military ties.';
  }
  if (type === 'intel' && relation < -5) {
    return 'Relations too poor for intel sharing.';
  }

  return undefined;
}

export function getCovertNegotiationPreview(
  state: GameState,
  playerId: string,
  targetId: string,
  option: CovertTalkOptionId
): CovertNegotiationPreview {
  const blockReason = getBlockReason(state, playerId, targetId, option);
  const type = COVERT_TO_TYPE[option];
  const acceptanceChance = Math.round(
    calculateCovertAcceptance(state, playerId, targetId, option) * 100
  );
  const exposureRisk = BASE_EXPOSURE_RISK[type] + Math.max(0, 3 - state.budget.covert * 30);

  return {
    optionId: option,
    label: COVERT_LABELS[option],
    description: 'Secret pact — the world will not acknowledge it unless exposed.',
    canAttempt: !blockReason,
    blockReason,
    cost: COVERT_TALK_COSTS[option],
    acceptanceChance,
    exposureRisk: Math.round(exposureRisk),
    effects: getCovertEffects(option),
  };
}

export interface CovertNegotiationResult {
  success: boolean;
  message: string;
}

function markCovertTalkAttempted(state: GameState, targetId: string): void {
  if (!state.covertTalksAttemptedThisTurn.includes(targetId)) {
    state.covertTalksAttemptedThisTurn.push(targetId);
  }
}

function formCovertAlliance(
  state: GameState,
  playerId: string,
  targetId: string,
  type: CovertAgreementType
): CovertAlliance {
  const risk = BASE_EXPOSURE_RISK[type] + Math.max(0, 4 - state.budget.covert * 25);
  const alliance: CovertAlliance = {
    id: `covert_${type}_${playerId}_${targetId}_${state.turn}`,
    type,
    a: playerId,
    b: targetId,
    formedTurn: state.turn,
    exposed: false,
    exposureRisk: risk,
  };
  state.covertAlliances.push(alliance);
  return alliance;
}

export function executeCovertNegotiation(
  state: GameState,
  playerId: string,
  targetId: string,
  option: CovertTalkOptionId
): CovertNegotiationResult {
  const preview = getCovertNegotiationPreview(state, playerId, targetId, option);
  if (!preview.canAttempt) {
    return { success: false, message: preview.blockReason ?? 'Cannot negotiate covertly.' };
  }

  const acceptance = calculateCovertAcceptance(state, playerId, targetId, option);
  const targetName = state.countries[targetId]?.name ?? targetId;
  const playerName = state.countries[playerId]?.name ?? playerId;
  const type = COVERT_TO_TYPE[option];

  if (Math.random() > acceptance) {
    markCovertTalkAttempted(state, targetId);
    // Failed backchannel — small leak risk
    if (Math.random() < 0.15) {
      modifyRelation(state.relations, playerId, targetId, -5);
      state.history.push(
        `Turn ${state.turn}: Rumours of secret talks between ${playerName} and ${targetName} surfaced.`
      );
      return { success: false, message: `${targetName} rebuffed the backchannel — rumours leaked.` };
    }
    return { success: false, message: `${targetName} rebuffed the covert proposal.` };
  }

  markCovertTalkAttempted(state, targetId);
  formCovertAlliance(state, playerId, targetId, type);
  state.history.push(
    `Turn ${state.turn}: ${playerName} formed a secret ${type} pact with ${targetName}. 🔒`
  );
  return {
    success: true,
    message: `Secret ${type} pact with ${targetName} established. 🔒`,
  };
}

export function exposeCovertAlliance(
  state: GameState,
  allianceId: string,
  reason: string
): boolean {
  const alliance = state.covertAlliances.find(ca => ca.id === allianceId && !ca.exposed);
  if (!alliance) return false;

  alliance.exposed = true;
  const aName = state.countries[alliance.a]?.name ?? alliance.a;
  const bName = state.countries[alliance.b]?.name ?? alliance.b;

  modifyRelation(state.relations, alliance.a, alliance.b, -20);

  for (const countryId of Object.keys(state.countries)) {
    if (countryId === alliance.a || countryId === alliance.b) continue;
    const relA = getRelation(state.relations, countryId, alliance.a);
    const relB = getRelation(state.relations, countryId, alliance.b);
    if (relA > 25) modifyRelation(state.relations, countryId, alliance.a, -12);
    if (relB > 25) modifyRelation(state.relations, countryId, alliance.b, -12);
    if (relA > 40 && relB > 40) {
      modifyRelation(state.relations, countryId, alliance.a, -5);
      modifyRelation(state.relations, countryId, alliance.b, -5);
    }
  }

  const playerInvolved =
    alliance.a === state.playerCountryId || alliance.b === state.playerCountryId;
  if (playerInvolved) {
    const player = state.countries[state.playerCountryId];
    if (player) {
      player.stats.warPopularity = Math.max(0, player.stats.warPopularity - 0.08);
    }
    state.internationalPariahTurns = Math.max(state.internationalPariahTurns, 2);
  }

  state.history.push(
    `Turn ${state.turn}: EXPOSED — secret ${alliance.type} pact between ${aName} and ${bName} (${reason}).`
  );
  return true;
}

export function tickCovertAllianceExposure(state: GameState): void {
  for (const alliance of [...state.covertAlliances]) {
    if (alliance.exposed) continue;

    let risk = alliance.exposureRisk;
    if (state.internationalPariahTurns > 0) risk += 2;

    const activeCount = state.covertAlliances.filter(
      ca => !ca.exposed && (ca.a === alliance.a || ca.b === alliance.a)
    ).length;
    if (activeCount > 2) risk += 1;

    if (Math.random() * 100 < risk) {
      exposeCovertAlliance(state, alliance.id, 'intelligence leak');
    }
  }
}

export function tryExposeFromCounterIntel(
  state: GameState,
  spySourceId: string,
  spyTargetId: string
): void {
  const involving = state.covertAlliances.filter(
    ca =>
      !ca.exposed &&
      (ca.a === spyTargetId || ca.b === spyTargetId) &&
      (ca.a === spySourceId || ca.b === spySourceId)
  );

  if (involving.length > 0 && Math.random() < 0.35) {
    exposeCovertAlliance(state, involving[0].id, 'counter-intelligence investigation');
    return;
  }

  const targetPacts = state.covertAlliances.filter(
    ca => !ca.exposed && (ca.a === spyTargetId || ca.b === spyTargetId)
  );
  if (targetPacts.length > 0 && Math.random() < 0.2) {
    const pact = targetPacts[Math.floor(Math.random() * targetPacts.length)];
    exposeCovertAlliance(state, pact.id, 'spy network breach');
  }
}

export function resolveProbePactsOp(state: GameState, sourceId: string, targetId: string): void {
  const targetPacts = state.covertAlliances.filter(
    ca => !ca.exposed && (ca.a === targetId || ca.b === targetId)
  );

  if (targetPacts.length === 0) {
    state.history.push(
      `Turn ${state.turn}: Spy probe of ${state.countries[targetId]?.name} found no secret pacts.`
    );
    return;
  }

  const pact = targetPacts[Math.floor(Math.random() * targetPacts.length)];
  const partnerId = pact.a === targetId ? pact.b : pact.a;
  const involvesPlayer = sourceId === state.playerCountryId || partnerId === state.playerCountryId;

  if (involvesPlayer && (pact.a === state.playerCountryId || pact.b === state.playerCountryId)) {
    exposeCovertAlliance(state, pact.id, 'foreign intelligence probe');
    state.history.push(
      `Turn ${state.turn}: Probe exposed YOUR secret pact with ${state.countries[partnerId]?.name}!`
    );
  } else {
    state.history.push(
      `Turn ${state.turn}: Intel gathered — ${state.countries[targetId]?.name} has secret ${pact.type} ties with ${state.countries[partnerId]?.name}.`
    );
    if (sourceId === state.playerCountryId) {
      modifyRelation(state.relations, state.playerCountryId, targetId, -3);
    }
  }
}

export function computeCovertTradeBonus(state: GameState, countryId: string): number {
  let bonus = 0;
  for (const ca of state.covertAlliances) {
    if (ca.exposed || ca.type !== 'trade') continue;
    if (ca.a === countryId || ca.b === countryId) bonus += 0.005;
  }
  return bonus;
}

export function computeCovertIntelBonus(state: GameState, countryId: string): number {
  if (countryId !== state.playerCountryId) return 0;
  let count = 0;
  for (const ca of state.covertAlliances) {
    if (ca.exposed || ca.type !== 'intel') continue;
    if (ca.a === countryId || ca.b === countryId) count++;
  }
  return count * 0.03;
}

export const COVERT_OPTION_ORDER: CovertTalkOptionId[] = [
  'covert_trade',
  'covert_military',
  'covert_intel',
];

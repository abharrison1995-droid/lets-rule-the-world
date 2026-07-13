import type { GameState, PeaceTermsType } from '../types/game';
import { getRelation, modifyRelation } from '../data/relations';
import { isAtWarWith } from './actions';

export interface PeaceResult {
  accepted: boolean;
  message: string;
}

export function getWarWithTarget(state: GameState, targetId: string) {
  return state.wars.find(
    w => w.belligerents.includes(state.playerCountryId) && w.belligerents.includes(targetId)
  );
}

export function calculatePeaceAcceptance(
  state: GameState,
  targetId: string,
  terms: PeaceTermsType
): number {
  const target = state.countries[targetId];
  const player = state.countries[state.playerCountryId];
  if (!target || !player) return 0;

  let score = 0.3;

  // War exhaustion drives peace desire
  score += target.stats.warExhaustion * 0.5;
  score += player.stats.warExhaustion * 0.2;

  // Relations
  const relation = getRelation(state.relations, state.playerCountryId, targetId);
  score += relation / 200;

  // Front pressure — if target is losing, less likely to accept reparations
  const targetFronts = state.fronts.filter(
    f => f.defenderCountryId === targetId || f.attackerCountryId === targetId
  );
  const avgPressure = targetFronts.length
    ? targetFronts.reduce((s, f) => {
        const isTargetDefending = f.defenderCountryId === targetId;
        return s + (isTargetDefending ? -f.pressure : f.pressure);
      }, 0) / targetFronts.length
    : 0;

  if (terms === 'white_peace') {
    score += 0.2;
    if (avgPressure < -20) score += 0.15; // target losing, wants out
  } else if (terms === 'ceasefire') {
    score += 0.25;
  } else if (terms === 'reparations') {
    score -= 0.2;
    if (avgPressure > 20) score += 0.3; // player winning, target may capitulate
    else score -= 0.3;
  }

  return Math.max(0, Math.min(1, score));
}

export function proposePeace(
  state: GameState,
  targetId: string,
  terms: PeaceTermsType
): PeaceResult {
  if (!isAtWarWith(state, state.playerCountryId, targetId)) {
    return { accepted: false, message: 'Not at war with this nation.' };
  }

  const war = getWarWithTarget(state, targetId);
  if (!war) return { accepted: false, message: 'No active war found.' };

  const acceptance = calculatePeaceAcceptance(state, targetId, terms);
  const target = state.countries[targetId]!;

  if (Math.random() > acceptance) {
    modifyRelation(state.relations, state.playerCountryId, targetId, -5);
    state.history.push(
      `Turn ${state.turn}: ${target.name} rejected peace proposal (${terms.replace('_', ' ')}).`
    );
    return { accepted: false, message: `${target.name} rejected the peace offer.` };
  }

  // End war and clear related fronts
  state.wars = state.wars.filter(w => w.id !== war.id);
  state.fronts = state.fronts.filter(f => {
    const involvesPlayer =
      f.attackerCountryId === state.playerCountryId || f.defenderCountryId === state.playerCountryId;
    const involvesTarget = f.attackerCountryId === targetId || f.defenderCountryId === targetId;
    return !(involvesPlayer && involvesTarget);
  });

  const player = state.countries[state.playerCountryId];
  player.stats.warExhaustion = Math.max(0, player.stats.warExhaustion - 0.25);
  target.stats.warExhaustion = Math.max(0, target.stats.warExhaustion - 0.25);

  if (terms === 'ceasefire') {
    modifyRelation(state.relations, state.playerCountryId, targetId, 5);
  } else if (terms === 'reparations') {
    const payment = Math.min(target.stats.treasuryPoints * 0.05, 50);
    target.stats.treasuryPoints -= payment;
    player.stats.treasuryPoints += payment * 0.8;
    modifyRelation(state.relations, state.playerCountryId, targetId, -10);
  } else {
    modifyRelation(state.relations, state.playerCountryId, targetId, 2);
  }

  state.history.push(
    `Turn ${state.turn}: Peace with ${target.name} (${terms.replace('_', ' ')}). War ended.`
  );

  return {
    accepted: true,
    message: `${target.name} accepted ${terms.replace('_', ' ')}. War is over.`,
  };
}

export function getPeaceOptions(state: GameState, _targetId: string): PeaceTermsType[] {
  const playerFronts = state.fronts.filter(
    f => f.attackerCountryId === state.playerCountryId || f.defenderCountryId === state.playerCountryId
  );
  const winning = playerFronts.some(
    f => f.attackerCountryId === state.playerCountryId && f.pressure > 30
  );

  const options: PeaceTermsType[] = ['white_peace', 'ceasefire'];
  if (winning) options.push('reparations');
  return options;
}

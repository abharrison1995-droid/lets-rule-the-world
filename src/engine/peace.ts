import type { GameState, PeaceTermsType, War } from '../types/game';
import { getRelation, modifyRelation } from '../data/relations';
import { isAtWarWith } from './actions';
import { recordConflictBaseline, applyPeaceReconciliation } from './conflictRelations';
import {
  applyTheaterPeaceSettlement,
  getTheaterControlShare,
  getTheaterForWar,
  syncWarTheaters,
} from './warTheater';

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

  score += target.stats.warExhaustion * 0.5;
  score += player.stats.warExhaustion * 0.2;

  const relation = getRelation(state.relations, state.playerCountryId, targetId);
  score += relation / 200;

  const targetFronts = state.fronts.filter(
    f => f.defenderCountryId === targetId || f.attackerCountryId === targetId
  );
  const avgPressure = targetFronts.length
    ? targetFronts.reduce((s, f) => {
        const isTargetDefending = f.defenderCountryId === targetId;
        return s + (isTargetDefending ? -f.pressure : f.pressure);
      }, 0) / targetFronts.length
    : 0;

  const war = getWarWithTarget(state, targetId);
  const theater = war ? getTheaterForWar(state, war.id) : undefined;
  const theaterEdge = theater
    ? getTheaterControlShare(theater, state.playerCountryId) -
      getTheaterControlShare(theater, targetId)
    : 0;

  if (terms === 'white_peace') {
    score += 0.2;
    if (avgPressure < -20) score += 0.15;
  } else if (terms === 'ceasefire') {
    score += 0.25;
  } else if (terms === 'reparations') {
    score -= 0.2;
    if (avgPressure > 20) score += 0.3;
    else score -= 0.3;
  } else if (terms === 'freeze_lines') {
    score += 0.05;
    score += theaterEdge * 0.4;
    if (theaterEdge < 0.05) score -= 0.2;
  } else if (terms === 'territorial_cede') {
    score -= 0.25;
    score += Math.max(0, theaterEdge) * 0.9;
    if (theaterEdge < 0.12) score -= 0.35;
    if (avgPressure > 25) score += 0.15;
  } else if (terms === 'dmz') {
    score -= 0.1;
    score += Math.abs(theaterEdge) < 0.2 ? 0.15 : 0;
    score += theaterEdge * 0.35;
  }

  return Math.max(0, Math.min(1, score));
}

/** Player leaves a war without dissolving coalition conflicts among remaining parties */
function playerLeaveWar(state: GameState, war: War, peaceTargetId: string): { warEnded: boolean } {
  const playerId = state.playerCountryId;

  // Clear fronts involving the player in this conflict
  state.fronts = state.fronts.filter(f => {
    const involvesPlayer =
      f.attackerCountryId === playerId || f.defenderCountryId === playerId;
    if (!involvesPlayer) return true;
    // Only drop fronts tied to this war's members
    const other = f.attackerCountryId === playerId ? f.defenderCountryId : f.attackerCountryId;
    return !war.belligerents.includes(other);
  });

  if (war.belligerents.length <= 2) {
    state.wars = state.wars.filter(w => w.id !== war.id);
    return { warEnded: true };
  }

  // Multi-party: player exits; war continues between remaining belligerents
  war.belligerents = war.belligerents.filter(b => b !== playerId);
  delete war.isDefensive[playerId];

  if (war.belligerents.length < 2) {
    state.wars = state.wars.filter(w => w.id !== war.id);
    return { warEnded: true };
  }

  // If peace target is no longer opposed by anyone in this war, nothing else to do
  void peaceTargetId;
  return { warEnded: false };
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
      `Turn ${state.turn}: ${target.name} rejected peace proposal (${terms.replace(/_/g, ' ')}).`
    );
    return { accepted: false, message: `${target.name} rejected the peace offer.` };
  }

  const warId = war.id;
  const { warEnded } = playerLeaveWar(state, war, targetId);

  const player = state.countries[state.playerCountryId];
  player.stats.warExhaustion = Math.max(0, player.stats.warExhaustion - 0.25);
  target.stats.warExhaustion = Math.max(0, target.stats.warExhaustion - 0.25);

  recordConflictBaseline(state, state.playerCountryId, targetId);

  if (terms === 'reparations') {
    const payment = Math.min(target.stats.treasuryPoints * 0.05, 50);
    target.stats.treasuryPoints -= payment;
    player.stats.treasuryPoints += payment * 0.8;
  }

  if (warEnded) {
    applyTheaterPeaceSettlement(state, warId, terms);
  }

  applyPeaceReconciliation(state, state.playerCountryId, targetId, terms);
  syncWarTheaters(state);

  if (warEnded) {
    state.history.push(
      `Turn ${state.turn}: Peace with ${target.name} (${terms.replace(/_/g, ' ')}). War ended.`
    );
    return {
      accepted: true,
      message: `${target.name} accepted ${terms.replace(/_/g, ' ')}. War is over.`,
    };
  }

  state.history.push(
    `Turn ${state.turn}: Peace with ${target.name} (${terms.replace(/_/g, ' ')}). You leave the war; fighting continues among remaining parties.`
  );
  return {
    accepted: true,
    message: `${target.name} accepted ${terms.replace(/_/g, ' ')}. You withdrew — the wider war continues.`,
  };
}

export function getPeaceOptions(state: GameState, targetId: string): PeaceTermsType[] {
  const playerFronts = state.fronts.filter(
    f => f.attackerCountryId === state.playerCountryId || f.defenderCountryId === state.playerCountryId
  );
  const winning = playerFronts.some(
    f => f.attackerCountryId === state.playerCountryId && f.pressure > 30
  );

  const options: PeaceTermsType[] = ['white_peace', 'ceasefire'];

  const war = getWarWithTarget(state, targetId);
  const theater = war ? getTheaterForWar(state, war.id) : undefined;
  if (theater) {
    const edge =
      getTheaterControlShare(theater, state.playerCountryId) -
      getTheaterControlShare(theater, targetId);
    if (edge > 0.06) options.push('freeze_lines');
    if (edge > 0.12) {
      options.push('territorial_cede');
      options.push('dmz');
    } else if (Math.abs(edge) < 0.1 && edge > -0.05) {
      // Stalemate front — DMZ is a natural ask
      options.push('dmz');
    }
  }

  if (winning) options.push('reparations');
  return options;
}

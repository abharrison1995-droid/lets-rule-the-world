import type { GameState, WarDeclarationPreview } from '../types/game';
import { getRelation } from '../data/relations';
import { actionEnergyBlockReason, ACTION_ENERGY_COSTS } from './actionEnergy';

function isAtWarWith(state: GameState, a: string, b: string): boolean {
  return state.wars.some(w => w.belligerents.includes(a) && w.belligerents.includes(b));
}

export const GREAT_POWERS = new Set(['usa', 'china', 'russia']);

export function getWarDeclarationCap(countryId: string): number {
  return GREAT_POWERS.has(countryId) ? 2 : 1;
}

export function getWarsRemaining(state: GameState, countryId: string): number {
  const cap = getWarDeclarationCap(countryId);
  return Math.max(0, cap - state.warsDeclaredThisTurn);
}

export function canDeclareWarThisTurn(state: GameState, countryId: string): boolean {
  return getWarsRemaining(state, countryId) > 0;
}

export function getAttackerBlocExpulsions(
  state: GameState,
  attackerId: string,
  defenderId: string
): Array<{ allianceId: string; allianceName: string }> {
  const expulsions: Array<{ allianceId: string; allianceName: string }> = [];
  for (const alliance of state.alliances) {
    if (!alliance.members.includes(attackerId)) continue;
    if (alliance.members.includes(defenderId)) {
      expulsions.push({ allianceId: alliance.id, allianceName: alliance.name });
    }
  }
  return expulsions;
}

export function getBlocMembersJoiningWar(
  state: GameState,
  attackerId: string,
  defenderId: string
): Array<{ countryId: string; name: string; blocName: string }> {
  const joiners: Array<{ countryId: string; name: string; blocName: string }> = [];
  const seen = new Set<string>();

  for (const alliance of state.alliances) {
    if (alliance.tier !== 'bloc' || !alliance.members.includes(defenderId)) continue;
    for (const member of alliance.members) {
      if (member === defenderId || member === attackerId || seen.has(member)) continue;
      seen.add(member);
      joiners.push({
        countryId: member,
        name: state.countries[member]?.name ?? member,
        blocName: alliance.name,
      });
    }
  }
  return joiners;
}

export function getAlliesLikelyToJoinEnemy(
  state: GameState,
  attackerId: string,
  defenderId: string
): Array<{ countryId: string; name: string; allianceName: string }> {
  const joiners: Array<{ countryId: string; name: string; allianceName: string }> = [];
  const seen = new Set<string>();

  for (const alliance of state.alliances) {
    if (!alliance.members.includes(defenderId)) continue;
    for (const member of alliance.members) {
      if (member === defenderId || member === attackerId || seen.has(member)) continue;
      const relation = getRelation(state.relations, member, defenderId);
      if (relation > 20) {
        seen.add(member);
        joiners.push({
          countryId: member,
          name: state.countries[member]?.name ?? member,
          allianceName: alliance.name,
        });
      }
    }
  }
  return joiners;
}

export function getRelationHitsFromWar(
  state: GameState,
  attackerId: string,
  defenderId: string
): Array<{ countryId: string; name: string; estimatedDelta: number }> {
  const hits: Array<{ countryId: string; name: string; estimatedDelta: number }> = [];

  for (const countryId of Object.keys(state.countries)) {
    if (countryId === attackerId) continue;
    const rel = getRelation(state.relations, countryId, defenderId);
    if (rel > 30) {
      hits.push({
        countryId,
        name: state.countries[countryId]?.name ?? countryId,
        estimatedDelta: Math.round(-rel * 0.3),
      });
    }
  }

  for (const expulsion of getAttackerBlocExpulsions(state, attackerId, defenderId)) {
    const alliance = state.alliances.find(a => a.id === expulsion.allianceId);
    if (!alliance) continue;
    for (const member of alliance.members) {
      if (member === attackerId) continue;
      const existing = hits.find(h => h.countryId === member);
      if (existing) {
        existing.estimatedDelta -= 25;
      } else {
        hits.push({
          countryId: member,
          name: state.countries[member]?.name ?? member,
          estimatedDelta: -25,
        });
      }
    }
  }

  return hits.sort((a, b) => a.estimatedDelta - b.estimatedDelta);
}

export function wouldTriggerGlobalCondemnation(
  state: GameState,
  attackerId: string,
  defenderId: string
): { triggers: boolean; reason?: string } {
  const expulsions = getAttackerBlocExpulsions(state, attackerId, defenderId);
  if (expulsions.length > 0) {
    return { triggers: true, reason: 'Attacking an ally triggers global condemnation.' };
  }

  const activeWars = state.wars.filter(w => w.belligerents.includes(attackerId)).length;
  if (activeWars >= 2) {
    return { triggers: true, reason: 'Multiple simultaneous wars mark you as an international aggressor.' };
  }

  if (state.warsDeclaredThisTurn >= 1) {
    return { triggers: true, reason: 'Declaring another war this turn escalates international outrage.' };
  }

  return { triggers: false };
}

export function getWarDeclarationPreview(
  state: GameState,
  attackerId: string,
  defenderId: string
): WarDeclarationPreview {
  const target = state.countries[defenderId];
  const warCap = getWarDeclarationCap(attackerId);
  const warsRemaining = getWarsRemaining(state, attackerId);
  const condemnation = wouldTriggerGlobalCondemnation(state, attackerId, defenderId);

  let canDeclare = true;
  let blockReason: string | undefined;

  if (!target) {
    canDeclare = false;
    blockReason = 'Invalid target.';
  } else if (attackerId === defenderId) {
    canDeclare = false;
    blockReason = 'Cannot declare war on yourself.';
  } else if (isAtWarWith(state, attackerId, defenderId)) {
    canDeclare = false;
    blockReason = 'Already at war.';
  } else if (warsRemaining <= 0) {
    canDeclare = false;
    blockReason = `War declaration limit reached (${warCap} per turn).`;
  } else {
    const energyReason = actionEnergyBlockReason(state, ACTION_ENERGY_COSTS.declare_war);
    if (energyReason) {
      canDeclare = false;
      blockReason = energyReason;
    }
  }

  return {
    targetId: defenderId,
    targetName: target?.name ?? defenderId,
    canDeclare,
    blockReason,
    warsDeclaredThisTurn: state.warsDeclaredThisTurn,
    warCap,
    warsRemaining,
    blocExpulsions: getAttackerBlocExpulsions(state, attackerId, defenderId),
    blocMembersJoiningWar: getBlocMembersJoiningWar(state, attackerId, defenderId),
    alliesLikelyToJoinEnemy: getAlliesLikelyToJoinEnemy(state, attackerId, defenderId),
    relationHits: getRelationHitsFromWar(state, attackerId, defenderId),
    triggersGlobalCondemnation: condemnation.triggers,
    condemnationReason: condemnation.reason,
  };
}

export type RelationCategory = 'at_war' | 'allies' | 'friendly' | 'neutral' | 'hostile';

export function categorizeRelation(
  state: GameState,
  playerId: string,
  otherId: string,
  value: number
): RelationCategory {
  if (isAtWarWith(state, playerId, otherId)) return 'at_war';
  const sharedAlliance = state.alliances.some(
    a => a.members.includes(playerId) && a.members.includes(otherId)
  );
  if (sharedAlliance || value >= 60) return 'allies';
  if (value >= 20) return 'friendly';
  if (value <= -20) return 'hostile';
  return 'neutral';
}

export const RELATION_GROUP_LABELS: Record<RelationCategory, string> = {
  at_war: 'At War',
  allies: 'Allies',
  friendly: 'Friendly',
  neutral: 'Neutral',
  hostile: 'Hostile',
};

export const RELATION_GROUP_ORDER: RelationCategory[] = [
  'at_war',
  'allies',
  'friendly',
  'neutral',
  'hostile',
];

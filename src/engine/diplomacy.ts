import type { GameState, Alliance, AllianceTier } from '../types/game';
import { getRelation, modifyRelation } from '../data/relations';
import { recordConflictBaseline } from './conflictRelations';
import { applyWarBelligerentRelations, tickWarRelations, triggerIranWarConsequences } from './warRelations';
import { onNationEntersWar } from './warReadiness';

const TIER_WEIGHTS: Record<AllianceTier, number> = {
  informal: 0.2,
  defensive_pact: 0.5,
  full_alliance: 0.8,
  bloc: 1.0,
};

export function tickDiplomacy(state: GameState): void {
  const countryIds = Object.keys(state.countries);

  tickWarRelations(state);

  for (const npcId of countryIds) {
    if (npcId === state.playerCountryId) continue;
    evaluateNpcAlliances(state, npcId);
  }

  // Passive ideological drift (very slow)
  if (state.turn % 5 === 0) {
    applyIdeologicalDrift(state);
  }
}

function evaluateNpcAlliances(state: GameState, npcId: string): void {
  for (const otherId of Object.keys(state.countries)) {
    if (otherId === npcId) continue;
    const score = computeAllianceScore(state, npcId, otherId);
    const existing = findAllianceBetween(state, npcId, otherId);

    if (!existing && score > 60) {
      // NPC would propose — only auto-join informal for NPCs
      if (Math.random() < 0.1) {
        proposeAlliance(state, npcId, otherId, 'informal');
      }
    } else if (existing && score < 20) {
      // Risk of downgrade
      if (Math.random() < 0.05) {
        breakAlliance(state, existing.id, npcId);
      }
    }
  }
}

export function computeAllianceScore(state: GameState, a: string, b: string): number {
  const relation = getRelation(state.relations, a, b);
  const sharedEnemy = findSharedEnemies(state, a, b).length * 15;
  const ideological = computeIdeologicalAlignment(a, b);
  const obligations = countConflictingObligations(state, a, b) * -20;

  return relation + sharedEnemy + ideological - obligations;
}

function findSharedEnemies(state: GameState, a: string, b: string): string[] {
  const aWars = state.wars.filter(w => w.belligerents.includes(a));
  const enemies = new Set<string>();
  for (const war of aWars) {
    for (const bell of war.belligerents) {
      if (bell !== a && bell !== b) enemies.add(bell);
    }
  }
  const bWars = state.wars.filter(w => w.belligerents.includes(b));
  for (const war of bWars) {
    for (const bell of war.belligerents) {
      if (bell !== b && bell !== a && enemies.has(bell)) return [...enemies];
    }
  }
  return [];
}

function computeIdeologicalAlignment(a: string, b: string): number {
  const west = ['usa', 'england', 'france', 'germany', 'israel', 'south_korea', 'japan'];
  const east = ['russia', 'china', 'iran', 'north_korea'];

  if ((west.includes(a) && west.includes(b)) || (east.includes(a) && east.includes(b))) return 20;
  if ((west.includes(a) && east.includes(b)) || (east.includes(a) && west.includes(b))) return -15;
  return 5;
}

function countConflictingObligations(state: GameState, a: string, b: string): number {
  let conflicts = 0;
  for (const alliance of state.alliances) {
    if (alliance.members.includes(a) && !alliance.members.includes(b)) {
      for (const member of alliance.members) {
        if (member !== a && getRelation(state.relations, member, b) < -30) conflicts++;
      }
    }
  }
  return conflicts;
}

function findAllianceBetween(state: GameState, a: string, b: string): Alliance | undefined {
  return state.alliances.find(al => al.members.includes(a) && al.members.includes(b));
}

export { findAllianceBetween };

export function upgradeAlliance(state: GameState, allianceId: string, newTier: AllianceTier): boolean {
  const alliance = state.alliances.find(a => a.id === allianceId);
  if (!alliance) return false;

  const tierOrder: AllianceTier[] = ['informal', 'defensive_pact', 'full_alliance', 'bloc'];
  if (tierOrder.indexOf(newTier) <= tierOrder.indexOf(alliance.tier)) return false;

  alliance.tier = newTier;
  return true;
}

export function proposeAlliance(
  state: GameState, proposer: string, target: string, tier: AllianceTier
): void {
  const existing = state.alliances.find(al =>
    al.members.includes(proposer) && al.members.includes(target)
  );
  if (existing) return;

  state.alliances.push({
    id: `alliance_${proposer}_${target}_${state.turn}`,
    name: `${state.countries[proposer]?.name}–${state.countries[target]?.name} Pact`,
    tier,
    members: [proposer, target],
  });
  modifyRelation(state.relations, proposer, target, 15);
  state.history.push(`Turn ${state.turn}: ${state.countries[proposer]?.name} and ${state.countries[target]?.name} formed a ${tier} alliance.`);
}

function breakAlliance(state: GameState, allianceId: string, breaker: string): void {
  const idx = state.alliances.findIndex(a => a.id === allianceId);
  if (idx === -1) return;
  const alliance = state.alliances[idx];
  for (const member of alliance.members) {
    if (member !== breaker) {
      modifyRelation(state.relations, breaker, member, -25);
    }
  }
  state.alliances.splice(idx, 1);
  state.history.push(`Turn ${state.turn}: ${state.countries[breaker]?.name} broke an alliance.`);
}

function expelFromAlliance(state: GameState, allianceId: string, expelledId: string, reason: string): void {
  const alliance = state.alliances.find(a => a.id === allianceId);
  if (!alliance || !alliance.members.includes(expelledId)) return;

  for (const member of alliance.members) {
    if (member !== expelledId) {
      modifyRelation(state.relations, expelledId, member, -25);
    }
  }

  alliance.members = alliance.members.filter(m => m !== expelledId);
  state.history.push(
    `Turn ${state.turn}: ${state.countries[expelledId]?.name} expelled from ${alliance.name} (${reason}).`
  );
}

function applyIdeologicalDrift(state: GameState): void {
  const pairs = [
    ['usa', 'china', -1], ['usa', 'russia', -1], ['russia', 'china', 1],
    ['israel', 'iran', -2], ['india', 'pakistan', -1],
  ] as const;
  for (const [a, b, drift] of pairs) {
    if (state.countries[a] && state.countries[b]) {
      modifyRelation(state.relations, a, b, drift);
    }
  }
}

function checkAllianceCallUp(state: GameState, defenderId: string, attackerId: string): string[] {
  const joiners: string[] = [];
  for (const alliance of state.alliances) {
    if (!alliance.members.includes(defenderId)) continue;
    const weight = TIER_WEIGHTS[alliance.tier] ?? 0.2;
    for (const member of alliance.members) {
      if (member === defenderId || member === attackerId) continue;
      const relation = getRelation(state.relations, member, defenderId);
      const economyFactor = state.countries[member]?.stats.baseGrowthRate ?? 0;
      const warWeariness = state.countries[member]?.stats.warExhaustion ?? 0;
      const probability = (relation / 100) * weight * (1 + economyFactor) * (1 - warWeariness) * 0.5;
      if (Math.random() < probability) {
        joiners.push(member);
      }
    }
  }
  return joiners;
}

export function declareWar(state: GameState, attackerId: string, defenderId: string): void {
  const existing = state.wars.find(w =>
    w.belligerents.includes(attackerId) && w.belligerents.includes(defenderId)
  );
  if (existing) return;

  recordConflictBaseline(state, attackerId, defenderId);

  // Expel attacker from alliances shared with defender (e.g. attacking a NATO ally)
  for (const alliance of [...state.alliances]) {
    if (alliance.members.includes(attackerId) && alliance.members.includes(defenderId)) {
      expelFromAlliance(state, alliance.id, attackerId, `war on ${state.countries[defenderId]?.name}`);
    }
  }

  state.wars.push({
    id: `war_${attackerId}_${defenderId}_${state.turn}`,
    belligerents: [attackerId, defenderId],
    startTurn: state.turn,
    isDefensive: { [defenderId]: true },
    initiatorId: attackerId,
  });

  const war = state.wars[state.wars.length - 1];

  // Bloc-wide war: all members of defender's blocs join against attacker
  for (const alliance of state.alliances) {
    if (alliance.tier !== 'bloc' || !alliance.members.includes(defenderId)) continue;
    for (const member of alliance.members) {
      if (member !== defenderId && !war.belligerents.includes(member)) {
        war.belligerents.push(member);
        war.isDefensive[member] = true;
      }
    }
  }

  const allies = checkAllianceCallUp(state, defenderId, attackerId);
  for (const ally of allies) {
    if (!war.belligerents.includes(ally)) {
      war.belligerents.push(ally);
      war.isDefensive[ally] = true;
    }
  }

  // Covert military partners may join secretly
  const covertJoiners = getCovertMilitaryJoiners(state, defenderId, attackerId);
  for (const ally of covertJoiners) {
    if (!war.belligerents.includes(ally)) {
      war.belligerents.push(ally);
      war.isDefensive[ally] = true;
      state.history.push(
        `Turn ${state.turn}: ${state.countries[ally]?.name} covertly intervened on behalf of ${state.countries[defenderId]?.name}.`
      );
    }
  }

  applyWarBelligerentRelations(state, war);
  triggerIranWarConsequences(state, attackerId, defenderId);

  const attackerCountry = state.countries[attackerId];
  const defenderCountry = state.countries[defenderId];
  if (attackerCountry) onNationEntersWar(attackerCountry);
  if (defenderCountry) onNationEntersWar(defenderCountry);

  // Secondary condemnation from nations friendly with defender
  for (const countryId of Object.keys(state.countries)) {
    if (countryId === attackerId) continue;
    const rel = getRelation(state.relations, countryId, defenderId);
    if (rel > 30) {
      modifyRelation(state.relations, countryId, attackerId, -rel * 0.3);
    }
  }

  state.history.push(`Turn ${state.turn}: ${state.countries[attackerId]?.name} declared war on ${state.countries[defenderId]?.name}.`);
}

export function applyGlobalCondemnation(state: GameState, attackerId: string, reason: string): void {
  state.internationalPariahTurns = Math.max(state.internationalPariahTurns, 3);

  for (const countryId of Object.keys(state.countries)) {
    if (countryId === attackerId) continue;
    modifyRelation(state.relations, countryId, attackerId, -10);
  }

  const attacker = state.countries[attackerId];
  if (attacker) {
    attacker.stats.warPopularity = Math.max(0, attacker.stats.warPopularity - 0.15);
  }

  state.history.push(`Turn ${state.turn}: Global condemnation of ${attacker?.name} — ${reason}`);
}

export function tickInternationalPariah(state: GameState): void {
  if (state.internationalPariahTurns <= 0) return;
  state.internationalPariahTurns -= 1;
}

/** Temporary income drag while under international condemnation (reversible when pariah expires). */
export function getPariahIncomeDrag(state: GameState, countryId: string): number {
  if (countryId !== state.playerCountryId || state.internationalPariahTurns <= 0) return 0;
  const country = state.countries[countryId];
  if (!country) return 0;
  const severity = Math.min(1, state.internationalPariahTurns / 3) * 0.028;
  return country.stats.treasuryPoints * severity;
}

export function getBlocColor(state: GameState, countryId: string): string {
  const country = state.countries[countryId];
  if (!country) return '#4a5a55';

  for (const alliance of state.alliances) {
    if (alliance.members.includes(countryId) && alliance.tier === 'bloc') {
      if (alliance.id === 'nato') return '#4a7c9e';
      if (alliance.id === 'csto') return '#8f5a55';
      if (alliance.id === 'sco') return '#9a5555';
    }
  }

  // War is shown via stroke / front lines — keep nation identity in the fill
  return country.color;
}

export function getAllRelationsForCountry(state: GameState, countryId: string): Array<{ countryId: string; name: string; value: number }> {
  return Object.keys(state.countries)
    .filter(id => id !== countryId)
    .map(id => ({
      countryId: id,
      name: state.countries[id].name,
      value: getRelation(state.relations, countryId, id),
    }))
    .sort((a, b) => b.value - a.value);
}

function getCovertMilitaryJoiners(
  state: GameState,
  defenderId: string,
  attackerId: string
): string[] {
  const joiners: string[] = [];
  for (const ca of state.covertAlliances) {
    if (ca.exposed || ca.type !== 'military') continue;
    const partner = ca.a === defenderId ? ca.b : ca.b === defenderId ? ca.a : null;
    if (!partner || partner === attackerId) continue;
    const relation = getRelation(state.relations, partner, defenderId);
    if (Math.random() < 0.3 * (relation / 80)) joiners.push(partner);
  }
  return joiners;
}

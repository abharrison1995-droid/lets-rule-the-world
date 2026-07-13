import type { GameState, Front, StrikeAnimation } from '../types/game';
import { computeAttackPower, computeDefensePower, getDefenseSystemRating } from './economy';
import { triggerUnprovokedStrikeEvent } from './events';
import { getRelation, modifyRelation } from '../data/relations';
import { declareWar } from './diplomacy';
import { recordConflictBaseline } from './conflictRelations';
import type { StrikeType } from './strikes';

const PRESSURE_THRESHOLD = 100;
const PRESSURE_SHIFT_BASE = 15;

export function detectFronts(state: GameState): Front[] {
  const fronts: Front[] = [];
  const seen = new Set<string>();

  for (const region of Object.values(state.regions)) {
    for (const neighbourId of region.neighbours) {
      const neighbour = state.regions[neighbourId];
      if (!neighbour) continue;
      if (region.controlledBy === neighbour.controlledBy) continue;

      const atWar = state.wars.some(w =>
        w.belligerents.includes(region.controlledBy) &&
        w.belligerents.includes(neighbour.controlledBy)
      );
      if (!atWar) continue;

      const frontKey = [region.id, neighbourId].sort().join('|');
      if (seen.has(frontKey)) continue;
      seen.add(frontKey);

      const existing = state.fronts.find(f =>
        (f.attackerRegionId === region.id && f.defenderRegionId === neighbourId) ||
        (f.attackerRegionId === neighbourId && f.defenderRegionId === region.id)
      );

      fronts.push(existing ?? {
        id: `front_${frontKey}`,
        attackerRegionId: region.id,
        defenderRegionId: neighbourId,
        attackerCountryId: region.controlledBy,
        defenderCountryId: neighbour.controlledBy,
        pressure: 0,
      });
    }
  }

  return fronts;
}

export function resolveCombat(state: GameState): void {
  state.fronts = detectFronts(state);

  for (const front of state.fronts) {
    const attackerRegion = state.regions[front.attackerRegionId];
    const defenderRegion = state.regions[front.defenderRegionId];
    if (!attackerRegion || !defenderRegion) continue;

    const attacker = state.countries[front.attackerCountryId];
    const defender = state.countries[front.defenderCountryId];
    if (!attacker || !defender) continue;

    const atkPower = computeAttackPower(
      attackerRegion.garrison.troops * 0.6,
      attacker.stats.troopQuality * (1 + attacker.militaryDev.troopQuality * 0.1),
      attacker.stats.techLevel,
      defenderRegion.terrain,
      getDefenseSystemRating(defenderRegion),
      getAllianceReinforcement(state, front.attackerCountryId) * 0.1
    );

    const defPower = computeDefensePower(
      defenderRegion.garrison.troops,
      defender.stats.troopQuality * (1 + defender.militaryDev.troopQuality * 0.1),
      defender.stats.techLevel,
      defenderRegion.terrain,
      getDefenseSystemRating(defenderRegion),
      defenderRegion.fortificationLevel
    );

    const differential = atkPower - defPower;
    const randomFactor = (Math.random() - 0.5) * 10;
    const shift = Math.sign(differential) * Math.min(PRESSURE_SHIFT_BASE, Math.abs(differential) * 0.1) + randomFactor;

    front.pressure += shift;

    // Region flip
    if (front.pressure >= PRESSURE_THRESHOLD) {
      flipRegion(state, defenderRegion, front.attackerCountryId);
      front.pressure = 0;
      state.history.push(`Turn ${state.turn}: ${attacker.name} captured ${defenderRegion.name}.`);
    } else if (front.pressure <= -PRESSURE_THRESHOLD) {
      front.pressure = Math.max(-50, front.pressure + 30);
    }

    // Casualties
    const casualtyRate = 0.02 + Math.abs(differential) * 0.001;
    attackerRegion.garrison.troops = Math.max(100, attackerRegion.garrison.troops * (1 - casualtyRate));
    defenderRegion.garrison.troops = Math.max(100, defenderRegion.garrison.troops * (1 - casualtyRate * 1.2));
  }
}

function flipRegion(state: GameState, region: typeof state.regions[string], newOwner: string): void {
  region.controlledBy = newOwner;
  region.unrest = 60;
  region.garrison.troops = Math.max(500, region.garrison.troops * 0.3);
}

function getAllianceReinforcement(state: GameState, countryId: string): number {
  let reinforcement = 0;
  for (const alliance of state.alliances) {
    if (!alliance.members.includes(countryId)) continue;
    for (const memberId of alliance.members) {
      if (memberId === countryId) continue;
      const member = state.countries[memberId];
      if (member && !state.wars.some(w => w.belligerents.includes(memberId))) {
        reinforcement += member.stats.defenseBudget * member.stats.treasuryPoints * 0.04;
      }
    }
  }
  return reinforcement;
}

const UNPROVOKED_DIRECT_PENALTY: Record<StrikeType, number> = {
  artillery: 28,
  drone: 38,
  cruise: 48,
  ballistic: 58,
  icbm: 68,
};

export function executeStrike(
  state: GameState,
  attackerId: string,
  targetRegionId: string,
  strikePower: number,
  strikeType: StrikeType = 'cruise'
): StrikeAnimation {
  const targetRegion = state.regions[targetRegionId];
  const defenseRating = getDefenseSystemRating(targetRegion);
  const intercepted = strikePower < defenseRating * 2;

  const animation: StrikeAnimation = {
    id: `strike_${state.turn}_${targetRegionId}`,
    sourceRegionId: '',
    targetRegionId,
    intercepted,
    turn: state.turn,
  };

  if (!intercepted) {
    targetRegion.garrison.troops = Math.max(0, targetRegion.garrison.troops * 0.7);
    targetRegion.industryValue *= 0.85;
    targetRegion.unrest = Math.min(100, targetRegion.unrest + 15);
  }

  state.strikeAnimations.push(animation);

  // Escalation check — striking nation not at war with
  const targetOwner = targetRegion.controlledBy;
  const atWar = state.wars.some(w =>
    w.belligerents.includes(attackerId) && w.belligerents.includes(targetOwner)
  );
  if (!atWar) {
    recordConflictBaseline(state, attackerId, targetOwner);

    const directPenalty = UNPROVOKED_DIRECT_PENALTY[strikeType] ?? 45;
    modifyRelation(state.relations, attackerId, targetOwner, -directPenalty);

    const victim = state.countries[targetOwner];
    const victimName = victim?.name ?? targetOwner;
    state.history.push(
      `Turn ${state.turn}: Unprovoked ${strikeType} strike on ${victimName} — relations cratered (−${directPenalty}).`
    );

    for (const countryId of Object.keys(state.countries)) {
      if (countryId === attackerId || countryId === targetOwner) continue;
      const allyToVictim = getRelation(state.relations, countryId, targetOwner);
      if (allyToVictim > 25) {
        const spillover = Math.round(8 + allyToVictim * 0.12);
        modifyRelation(state.relations, countryId, attackerId, -spillover);
      }
    }

    if (attackerId === state.playerCountryId) {
      triggerUnprovokedStrikeEvent(state);
    }

    declareWar(state, targetOwner, attackerId);
    state.history.push(`Turn ${state.turn}: ${victimName} declared war in response to the attack.`);
  }

  return animation;
}

export function decayUnrest(state: GameState): void {
  for (const region of Object.values(state.regions)) {
    if (region.unrest > 0 && region.controlledBy !== region.countryId) {
      region.unrest = Math.max(0, region.unrest - 3);
    } else if (region.unrest > 0) {
      region.unrest = Math.max(0, region.unrest - 5);
    }
  }
}

export function cleanStrikeAnimations(state: GameState): void {
  state.strikeAnimations = state.strikeAnimations.filter(a => a.turn >= state.turn - 1);
}

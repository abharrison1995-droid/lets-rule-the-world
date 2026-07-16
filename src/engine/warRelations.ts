import type { GameState, War } from '../types/game';
import { getRelation, modifyRelation } from '../data/relations';
import { getEventById } from '../data/events';
import { applyEventSilentlyForNpc, triggerEventById } from './events';

/** Nations whose economies are heavily exposed to Gulf shipping / Hormuz disruption */
const HORMUZ_ENERGY_EXPOSED = [
  'usa',
  'england',
  'france',
  'germany',
  'japan',
  'china',
  'india',
  'south_korea',
  'turkey',
  'israel',
  'egypt',
  'pakistan',
  'saudi_arabia',
] as const;

function getHormuzAffectedNations(initiatorId: string, otherId: string): string[] {
  const affected = new Set<string>([initiatorId, otherId]);
  for (const id of HORMUZ_ENERGY_EXPOSED) {
    affected.add(id);
  }
  return [...affected];
}

export function isHormuzEnergyExposed(countryId: string): boolean {
  return (HORMUZ_ENERGY_EXPOSED as readonly string[]).includes(countryId);
}

export function isPlayerInIranWar(state: GameState, playerId: string): boolean {
  return state.wars.some(
    w => w.belligerents.includes('iran') && w.belligerents.includes(playerId)
  );
}

function isAtWar(state: GameState, a: string, b: string): boolean {
  return state.wars.some(w => w.belligerents.includes(a) && w.belligerents.includes(b));
}

function getAttackers(war: War): string[] {
  return war.belligerents.filter(b => !war.isDefensive[b]);
}

function getDefenders(war: War): string[] {
  return war.belligerents.filter(b => war.isDefensive[b]);
}

/** Force hostile relations between opposing belligerents */
export function applyWarBelligerentRelations(state: GameState, war: War): void {
  const attackers = getAttackers(war);
  const defenders = getDefenders(war);

  for (const atk of attackers) {
    for (const def of defenders) {
      clampHostileRelation(state, atk, def, -45);
    }
  }
}

function clampHostileRelation(
  state: GameState,
  a: string,
  b: string,
  floor: number
): void {
  const current = getRelation(state.relations, a, b);
  if (current > floor) {
    modifyRelation(state.relations, a, b, floor - current);
  }
}

/** Each turn, ensure at-war nations don't stay friendly */
export function tickWarRelations(state: GameState): void {
  for (const war of state.wars) {
    applyWarBelligerentRelations(state, war);

    const attackers = getAttackers(war);
    const defenders = getDefenders(war);

    for (const atk of attackers) {
      for (const def of defenders) {
        const rel = getRelation(state.relations, atk, def);
        if (rel > -60) {
          modifyRelation(state.relations, atk, def, -8);
        }
      }
    }
  }

  for (const a of Object.keys(state.countries)) {
    for (const b of Object.keys(state.countries)) {
      if (a >= b) continue;
      if (isAtWar(state, a, b)) {
        const rel = getRelation(state.relations, a, b);
        if (rel > -25) {
          modifyRelation(state.relations, a, b, Math.min(-10, -25 - rel));
        }
      }
    }
  }
}

export function triggerIranWarConsequences(state: GameState, initiatorId: string, otherId: string): void {
  const iranInvolved = initiatorId === 'iran' || otherId === 'iran';
  if (!iranInvolved) return;
  if (state.globalOilShock && state.globalOilShock.turnsRemaining > 0) return;

  state.globalOilShock = {
    turnsRemaining: 8,
    severity: 0.55,
    reason: 'Strait of Hormuz disruption',
  };

  state.history.push(
    `Turn ${state.turn}: Iran threatens to close the Strait of Hormuz — global oil markets spike.`
  );

  const hormuzEvent = getEventById('strait_of_hormuz');
  if (!hormuzEvent) return;

  for (const nationId of getHormuzAffectedNations(initiatorId, otherId)) {
    if (!state.countries[nationId]) continue;

    if (nationId === state.playerCountryId) {
      triggerEventById(state, 'strait_of_hormuz', nationId);
      continue;
    }

    applyEventSilentlyForNpc(state, hormuzEvent, nationId);
    const name = state.countries[nationId]?.name ?? nationId;
    state.history.push(
      `Turn ${state.turn}: ${name} responds to Hormuz disruption — energy markets adjust.`
    );
  }
}

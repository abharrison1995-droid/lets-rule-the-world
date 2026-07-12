import type { GameState, GameEvent, ActiveEvent } from '../types/game';
import { EVENTS, getEventById } from '../data/events';
import { getRelation, modifyRelation } from '../data/relations';
import { proposeAlliance } from './diplomacy';

const STAT_COMPARE: Record<string, 'lte' | 'gte'> = {
  moraleBase: 'lte',
  regimeSecurity: 'lte',
  gdp: 'lte',
  defenseBudget: 'lte',
  warExhaustion: 'gte',
  propagandaSaturation: 'gte',
  globalInfluence: 'lte',
};

const WEST_BLOC = ['usa', 'england', 'france', 'germany', 'israel', 'south_korea', 'japan'];
const EAST_BLOC = ['russia', 'china', 'iran', 'north_korea'];

export function rollEvents(state: GameState): ActiveEvent[] {
  const newEvents: ActiveEvent[] = [];

  for (const followUp of state.pendingFollowUps) {
    if (followUp.triggerTurn <= state.turn) {
      const event = getEventById(followUp.eventId);
      if (event) {
        newEvents.push({
          eventId: event.id,
          turn: state.turn,
          targetCountryId: followUp.targetCountryId,
          resolved: false,
        });
      }
    }
  }
  state.pendingFollowUps = state.pendingFollowUps.filter(f => f.triggerTurn > state.turn);

  const eligible = filterEligibleEvents(state, state.playerCountryId);
  const playerEvents = weightedRandomSelect(eligible, 1 + (Math.random() < 0.3 ? 1 : 0));

  for (const event of playerEvents) {
    newEvents.push({
      eventId: event.id,
      turn: state.turn,
      targetCountryId: state.playerCountryId,
      resolved: false,
    });
  }

  for (const npcId of Object.keys(state.countries)) {
    if (npcId === state.playerCountryId) continue;
    const npcEligible = filterEligibleEvents(state, npcId);
    const npcEvent = weightedRandomSelect(npcEligible, 1);
    for (const event of npcEvent) {
      resolveEventSilently(state, event, npcId);
    }
  }

  state.activeEvents.push(...newEvents);
  return newEvents;
}

function filterEligibleEvents(state: GameState, countryId: string): GameEvent[] {
  const activeIds = state.activeEvents.filter(e => !e.resolved).map(e => e.eventId);

  return EVENTS.filter(event => {
    const cond = event.triggerConditions;
    if (cond.minTurn && state.turn < cond.minTurn) return false;
    if (cond.maxTurn && state.turn > cond.maxTurn) return false;
    if (cond.targetCountry && cond.targetCountry !== countryId) return false;
    if (cond.excludedIfActive?.some(id => activeIds.includes(id))) return false;
    if (cond.requiredState) {
      for (const req of cond.requiredState) {
        if (!checkRequiredState(state, countryId, req)) return false;
      }
    }
    return true;
  });
}

function getStatValue(state: GameState, countryId: string, key: string): number | boolean {
  const country = state.countries[countryId];
  if (!country) return 0;

  switch (key) {
    case 'moraleBase': return country.stats.moraleBase;
    case 'warExhaustion': return country.stats.warExhaustion;
    case 'regimeSecurity': return country.stats.regimeSecurity;
    case 'gdp': return country.stats.gdp;
    case 'propagandaSaturation': return country.stats.propagandaSaturation;
    case 'defenseBudget': return country.stats.defenseBudget;
    case 'atWar': return state.wars.some(w => w.belligerents.includes(countryId));
    case 'avgRelationsMajor': {
      const majors = ['usa', 'china', 'germany', 'japan'];
      return majors.reduce((s, id) => s + getRelation(state.relations, countryId, id), 0) / majors.length;
    }
    case 'relations_usa': return getRelation(state.relations, countryId, 'usa');
    case 'globalInfluence': {
      const allies = Object.keys(state.countries).filter(
        id => id !== countryId && getRelation(state.relations, countryId, id) > 40
      );
      return allies.length * 10;
    }
    default: return 0;
  }
}

function checkRequiredState(
  state: GameState,
  countryId: string,
  req: { key: string; op: string; value: number | string | boolean }
): boolean {
  const actual = getStatValue(state, countryId, req.key);

  switch (req.op) {
    case 'lt': return (actual as number) < (req.value as number);
    case 'gt': return (actual as number) > (req.value as number);
    case 'eq': return actual === req.value;
    case 'lte': return (actual as number) <= (req.value as number);
    case 'gte': return (actual as number) >= (req.value as number);
    default: return true;
  }
}

function weightedRandomSelect(events: GameEvent[], count: number): GameEvent[] {
  if (events.length === 0) return [];
  const selected: GameEvent[] = [];
  const pool = [...events];

  for (let i = 0; i < count && pool.length > 0; i++) {
    const totalWeight = pool.reduce((s, e) => s + e.weight, 0);
    let roll = Math.random() * totalWeight;
    for (let j = 0; j < pool.length; j++) {
      roll -= pool[j].weight;
      if (roll <= 0) {
        selected.push(pool[j]);
        pool.splice(j, 1);
        break;
      }
    }
  }
  return selected;
}

export function resolveEventChoice(
  state: GameState,
  eventId: string,
  choiceIndex: number,
  targetCountryId: string
): void {
  const event = getEventById(eventId);
  if (!event || !event.choices[choiceIndex]) return;

  const choice = event.choices[choiceIndex];
  const country = state.countries[targetCountryId];
  if (!country) return;

  state.eventContextNationId = state.eventContextNationId ?? 'usa';

  for (const effect of choice.effects) {
    applyEffect(state, country, effect.stat, effect.target, effect.delta);
  }

  if (choice.followUpEventId) {
    state.pendingFollowUps.push({
      eventId: choice.followUpEventId,
      triggerTurn: state.turn + 1 + Math.floor(Math.random() * 2),
      targetCountryId,
    });
  }

  const active = state.activeEvents.find(e => e.eventId === eventId && !e.resolved);
  if (active) active.resolved = true;
}

function resolveRelationTarget(state: GameState, country: typeof state.countries[string], target: string): string | null {
  if (target === 'all' || target === 'west_bloc' || target === 'east_bloc') return null;
  if (target === 'self') return country.id;
  if (target === 'sender' || target === 'ally' || target === 'partner' || target === 'suspect') {
    return state.eventContextNationId ?? 'usa';
  }
  if (state.countries[target]) return target;
  return null;
}

function applyEffect(
  state: GameState,
  country: typeof state.countries[string],
  stat: string,
  target: string,
  delta: number
): void {
  if (stat === 'gameOver') {
    state.gameOver = true;
    state.gameOverReason = `${country.name} has collapsed.`;
    return;
  }

  const stats = country.stats;
  const dev = country.militaryDev;

  switch (stat) {
    case 'gdp': stats.gdp += delta; break;
    case 'gdpGrowth': stats.gdpGrowth += delta; break;
    case 'moraleBase': stats.moraleBase = Math.max(0, Math.min(1, stats.moraleBase + delta)); break;
    case 'regimeSecurity': stats.regimeSecurity = Math.max(0, Math.min(1, stats.regimeSecurity + delta)); break;
    case 'warPopularity': stats.warPopularity = Math.max(0, Math.min(1, stats.warPopularity + delta)); break;
    case 'propagandaSaturation': stats.propagandaSaturation = Math.max(0, Math.min(1, stats.propagandaSaturation + delta)); break;
    case 'defenseBudget': stats.defenseBudget = Math.max(0, stats.defenseBudget + delta); break;
    case 'techLevel': stats.techLevel = Math.max(0, Math.min(1, stats.techLevel + delta)); break;
    case 'troopQuality': stats.troopQuality = Math.max(0, Math.min(1, stats.troopQuality + delta)); break;
    case 'missileDefense': dev.missileDefense = Math.max(1, Math.min(5, dev.missileDefense + delta)); break;
    case 'droneProgram': dev.droneProgram = Math.max(1, Math.min(5, dev.droneProgram + delta)); break;
    case 'alliance': {
      const targetId = resolveRelationTarget(state, country, target);
      if (targetId) proposeAlliance(state, country.id, targetId, 'defensive_pact');
      break;
    }
    case 'relations': {
      if (target === 'all') {
        for (const otherId of Object.keys(state.countries)) {
          if (otherId === country.id) continue;
          modifyRelation(state.relations, country.id, otherId, delta);
        }
      } else if (target === 'west_bloc') {
        for (const id of WEST_BLOC) {
          if (id !== country.id && state.countries[id]) modifyRelation(state.relations, country.id, id, delta);
        }
      } else if (target === 'east_bloc') {
        for (const id of EAST_BLOC) {
          if (id !== country.id && state.countries[id]) modifyRelation(state.relations, country.id, id, delta);
        }
      } else {
        const targetId = resolveRelationTarget(state, country, target);
        if (targetId) modifyRelation(state.relations, country.id, targetId, delta);
      }
      break;
    }
  }
}

function resolveEventSilently(state: GameState, event: GameEvent, countryId: string): void {
  if (event.choices.length > 0) {
    const choice = event.choices[Math.floor(Math.random() * event.choices.length)];
    const country = state.countries[countryId];
    if (country) {
      for (const effect of choice.effects) {
        applyEffect(state, country, effect.stat, effect.target, effect.delta * 0.5);
      }
    }
  }
}

function isCollapseTriggered(state: GameState, countryId: string): boolean {
  const country = state.countries[countryId];
  if (!country) return false;

  const collapse = country.collapseCondition;
  if (collapse.type === 'none') return false;

  for (const [stat, threshold] of Object.entries(collapse.triggerStats)) {
    const value = getStatValue(state, countryId, stat) as number;
    const compare = STAT_COMPARE[stat] ?? 'lte';
    if (compare === 'lte' && value > threshold) return false;
    if (compare === 'gte' && value < threshold) return false;
  }
  return true;
}

export function checkCollapseConditions(state: GameState): void {
  const country = state.countries[state.playerCountryId];
  if (!country) return;

  const collapse = country.collapseCondition;
  if (collapse.type === 'none') return;

  const triggered = isCollapseTriggered(state, state.playerCountryId);

  if (!triggered) {
    state.telegraphedCollapse = false;
    return;
  }

  // Telegraph warning first
  if (!state.telegraphedCollapse && collapse.telegraphEventId) {
    const telegraphEvent = getEventById(collapse.telegraphEventId);
    if (telegraphEvent) {
      state.activeEvents.push({
        eventId: telegraphEvent.id,
        turn: state.turn,
        targetCountryId: state.playerCountryId,
        resolved: false,
      });
      state.telegraphedCollapse = true;
      state.history.push(`Turn ${state.turn}: WARNING — ${telegraphEvent.title}`);
      return;
    }
  }

  if (collapse.type === 'hard') {
    state.gameOver = true;
    state.gameOverReason = `${country.name} has collapsed.`;
  } else if (collapse.type === 'soft') {
    state.declineMode = true;
    state.history.push(`Turn ${state.turn}: ${country.name} enters decline/survival mode.`);
  }
}

export function triggerUnprovokedStrikeEvent(state: GameState): void {
  const event = getEventById('unprovoked_strike_condemnation');
  if (!event) return;
  const already = state.activeEvents.some(e => e.eventId === event.id && !e.resolved);
  if (already) return;
  state.activeEvents.push({
    eventId: event.id,
    turn: state.turn,
    targetCountryId: state.playerCountryId,
    resolved: false,
  });
}

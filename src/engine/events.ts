import type { GameState, GameEvent, ActiveEvent } from '../types/game';
import { EVENTS, getEventById } from '../data/events';
import { getRelation, modifyRelation } from '../data/relations';
import { proposeAlliance } from './diplomacy';
import { getRegionsForCountry } from '../data/regions';

const STAT_COMPARE: Record<string, 'lte' | 'gte'> = {
  moraleBase: 'lte',
  regimeSecurity: 'lte',
  treasuryPoints: 'lte',
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
        newEvents.push(buildActiveEvent(state, event, followUp.targetCountryId ?? state.playerCountryId));
      }
    }
  }
  state.pendingFollowUps = state.pendingFollowUps.filter(f => f.triggerTurn > state.turn);

  const eligible = filterEligibleEvents(state, state.playerCountryId);
  const rollCount = 1 + (Math.random() < 0.55 ? 1 : 0) + (Math.random() < 0.2 ? 1 : 0);
  const playerEvents = weightedRandomSelect(eligible, rollCount);

  for (const event of playerEvents) {
    newEvents.push(buildActiveEvent(state, event, state.playerCountryId));
  }

  for (const npcId of Object.keys(state.countries)) {
    if (npcId === state.playerCountryId) continue;
    if ((state.collapsedNations ?? []).includes(npcId)) continue;
    const npcEligible = filterEligibleEvents(state, npcId).filter(
      e => !e.choices.every(c => c.effects.some(fx => fx.stat === 'gameOver'))
    );
    const npcEvent = weightedRandomSelect(npcEligible, 1);
    for (const event of npcEvent) {
      applyEventSilentlyForNpc(state, event, npcId);
    }
  }

  state.activeEvents.push(...newEvents);
  // Drop resolved clutter so the log does not grow forever
  state.activeEvents = state.activeEvents.filter(e => !e.resolved).slice(-12);
  return newEvents;
}

function pickDiplomaticPartner(state: GameState, countryId: string): string | null {
  const candidates = Object.keys(state.countries)
    .filter(id => id !== countryId)
    .map(id => ({ id, rel: getRelation(state.relations, countryId, id) }))
    .filter(c => c.rel > -20)
    .sort((a, b) => b.rel - a.rel);
  if (candidates.length === 0) return null;
  const pool = candidates.slice(0, Math.min(5, candidates.length));
  return pool[Math.floor(Math.random() * pool.length)].id;
}

function pickPlayerRegion(countryId: string): string | null {
  const regions = getRegionsForCountry(countryId);
  if (regions.length === 0) return null;
  return regions[Math.floor(Math.random() * regions.length)].id;
}

function pickCauseLabel(): string {
  const causes = [
    'veterans\' healthcare',
    'rural broadband expansion',
    'your re-election campaign',
    'a state propaganda initiative',
    'disaster relief reserves',
    'the national space programme',
  ];
  return causes[Math.floor(Math.random() * causes.length)];
}

function buildActiveEvent(
  state: GameState,
  event: GameEvent,
  countryId: string
): ActiveEvent {
  const active: ActiveEvent = {
    eventId: event.id,
    turn: state.turn,
    targetCountryId: countryId,
    resolved: false,
  };

  const partner = pickDiplomaticPartner(state, countryId);
  const regionId = pickPlayerRegion(countryId);
  const region = regionId ? state.regions[regionId] : null;
  const partnerName = partner ? state.countries[partner]?.name ?? partner : 'a foreign power';
  const donation = Math.round(12 + Math.random() * 22);
  const cause = pickCauseLabel();

  if (event.id === 'alliance_proposal' && partner) {
    active.contextNationId = partner;
    active.displayDescription =
      `${partnerName} seeks a defensive pact with your government. ` +
      `Relations stand at ${getRelation(state.relations, countryId, partner) > 0 ? '+' : ''}` +
      `${getRelation(state.relations, countryId, partner)}. Accepting binds you to mutual defence.`;
  } else if (event.id === 'trade_deal' && partner) {
    active.contextNationId = partner;
    active.displayDescription =
      `${partnerName} proposes an expanded trade framework. ` +
      `Your ministries estimate +0.8% GDP growth if signed.`;
  } else if (event.id === 'betrayal_warning' && partner) {
    active.contextNationId = partner;
    active.displayDescription =
      `Intelligence reports suggest ${partnerName} is reconsidering their commitment to your pact.`;
  } else if (event.id === 'datacentre_protest' && region) {
    active.contextRegionId = regionId!;
    active.contextAmount = donation;
    active.displayDescription =
      `A rogue tech billionaire wants to build a hyperscale data centre in ${region.name}. ` +
      `Local residents are furious — but he will donate ${donation} treasury points to ${cause} if you approve the permits.`;
  } else if (event.id === 'dissident_pardon') {
    active.displayDescription =
      'A political dissident requests a presidential pardon. They attempted to assassinate your chief political rival last year. ' +
      'Granting clemency may calm unrest; refusing may harden opposition.';
  } else if (event.id === 'arms_deal_offer' && partner) {
    active.contextNationId = partner;
    active.contextAmount = donation;
    active.displayDescription =
      `${partnerName} offers a discounted arms package worth ${donation} TP — ` +
      `with strings attached on future diplomatic votes.`;
  } else if (event.id === 'refugee_crisis' && region) {
    active.contextRegionId = regionId!;
    active.displayDescription =
      `A sudden influx of refugees strains ${region.name}. Border towns demand emergency funding or closed crossings.`;
  } else if (event.id === 'corruption_scandal') {
    active.displayDescription =
      'Investigative journalists allege senior officials diverted defence contracts. ' +
      'The story is trending worldwide.';
  } else if (event.id === 'energy_blackout' && region) {
    active.contextRegionId = regionId!;
    active.displayDescription =
      `Rolling blackouts hit ${region.name} after grid failures. Industry lobbies demand immediate investment.`;
  } else if (event.id === 'covert_op_detected' && partner) {
    active.contextNationId = partner;
    active.displayDescription =
      `Counter-intelligence flags suspicious activity linked to ${partnerName}. ` +
      `Your agencies recommend a response.`;
  } else {
    active.displayDescription = event.description;
  }

  return active;
}

function filterEligibleEvents(state: GameState, countryId: string): GameEvent[] {
  const activeIds = state.activeEvents.filter(e => !e.resolved).map(e => e.eventId);

  return EVENTS.filter(event => {
    const cond = event.triggerConditions;
    if (cond.manualOnly) return false;
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

function getStatValue(
  state: GameState,
  countryId: string,
  key: string,
  contextValue?: string
): number | boolean {
  const country = state.countries[countryId];
  if (!country) return 0;

  switch (key) {
    case 'moraleBase': return country.stats.moraleBase;
    case 'warExhaustion': return country.stats.warExhaustion;
    case 'regimeSecurity': return country.stats.regimeSecurity;
    case 'treasuryPoints':
    case 'gdp': return country.stats.treasuryPoints;
    case 'propagandaSaturation': return country.stats.propagandaSaturation;
    case 'defenseBudget': return country.stats.defenseBudget;
    case 'atWar': return state.wars.some(w => w.belligerents.includes(countryId));
    case 'notAtWar': return !state.wars.some(w => w.belligerents.includes(countryId));
    case 'atWarWith':
      return contextValue
        ? state.wars.some(w => w.belligerents.includes(countryId) && w.belligerents.includes(contextValue))
        : false;
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
  const actual = getStatValue(
    state,
    countryId,
    req.key,
    typeof req.value === 'string' ? req.value : undefined
  );

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

  const active = state.activeEvents.find(e => e.eventId === eventId && !e.resolved);
  state.eventContextNationId = active?.contextNationId ?? pickDiplomaticPartner(state, targetCountryId) ?? 'usa';

  for (const effect of choice.effects) {
    applyEffect(state, country, effect.stat, effect.target, effect.delta, active);
  }

  if (choice.followUpEventId) {
    const followEvent = getEventById(choice.followUpEventId);
    const followNation = followEvent?.triggerConditions.targetCountry;
    // Never schedule another nation's fatal collapse onto the player
    const followIsForeignFatal =
      !!followEvent &&
      followNation !== undefined &&
      followNation !== targetCountryId &&
      followEvent.choices.every(c => c.effects.some(e => e.stat === 'gameOver'));

    if (!followIsForeignFatal) {
      const followTurn = state.turn + 1 + Math.floor(Math.random() * 2);
      state.pendingFollowUps.push({
        eventId: choice.followUpEventId,
        triggerTurn: followTurn,
        targetCountryId,
      });
      if (followEvent) {
        state.history.push(
          `Turn ${state.turn}: Aftermath brewing — ${followEvent.title} expected around turn ${followTurn}.`
        );
      }
    }
  }

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
  delta: number,
  active?: ActiveEvent
): void {
  if (stat === 'gameOver') {
    // Only the player collapsing ends the campaign — NPC regime falls are world events
    if (country.id === state.playerCountryId) {
      state.gameOver = true;
      state.gameOverReason = `${country.name} has collapsed.`;
    } else {
      state.collapsedNations ??= [];
      if (!state.collapsedNations.includes(country.id)) {
        state.collapsedNations.push(country.id);
        state.history.push(
          `Turn ${state.turn}: ${country.name} collapses — chaos consumes the regime (you may keep playing).`
        );
      }
    }
    return;
  }

  const stats = country.stats;
  const dev = country.militaryDev;

  switch (stat) {
    case 'treasuryPoints':
    case 'gdp': {
      let tpDelta = stat === 'gdp' ? Math.round(delta / 8) : delta;
      if (tpDelta === 0 && active?.contextAmount) tpDelta = active.contextAmount;
      stats.treasuryPoints = Math.max(0, stats.treasuryPoints + tpDelta);
      break;
    }
    case 'baseGrowthRate':
    case 'gdpGrowth': stats.baseGrowthRate += delta; break;
    case 'moraleBase': stats.moraleBase = Math.max(0, Math.min(1, stats.moraleBase + delta)); break;
    case 'regimeSecurity': stats.regimeSecurity = Math.max(0, Math.min(1, stats.regimeSecurity + delta)); break;
    case 'warPopularity': stats.warPopularity = Math.max(0, Math.min(1, stats.warPopularity + delta)); break;
    case 'warExhaustion': stats.warExhaustion = Math.max(0, Math.min(1, stats.warExhaustion + delta)); break;
    case 'propagandaSaturation': stats.propagandaSaturation = Math.max(0, Math.min(1, stats.propagandaSaturation + delta)); break;
    case 'defenseBudget': stats.defenseBudget = Math.max(0, stats.defenseBudget + delta); break;
    case 'techLevel': stats.techLevel = Math.max(0, Math.min(1, stats.techLevel + delta)); break;
    case 'troopQuality': stats.troopQuality = Math.max(0, Math.min(1, stats.troopQuality + delta)); break;
    case 'missileDefense': dev.missileDefense = Math.max(1, Math.min(5, dev.missileDefense + delta)); break;
    case 'droneProgram': dev.droneProgram = Math.max(1, Math.min(5, dev.droneProgram + delta)); break;
    case 'unrest': {
      if (active?.contextRegionId && state.regions[active.contextRegionId]) {
        const r = state.regions[active.contextRegionId];
        r.unrest = Math.max(0, Math.min(100, r.unrest + delta));
      }
      break;
    }
    case 'reserve':
      country.stats.treasuryPoints += active?.contextAmount ?? delta;
      break;
    case 'globalOilShock': {
      if (state.globalOilShock) {
        state.globalOilShock.severity = Math.max(0.08, state.globalOilShock.severity + delta);
        if (state.globalOilShock.severity < 0.15) {
          state.globalOilShock.turnsRemaining = Math.max(1, state.globalOilShock.turnsRemaining - 2);
        }
      }
      break;
    }
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

export function applyEventSilentlyForNpc(state: GameState, event: GameEvent, countryId: string): void {
  if ((state.collapsedNations ?? []).includes(countryId)) return;
  if (event.choices.length > 0) {
    const country = state.countries[countryId];
    if (!country) return;
    // Prefer survival/reform choices over instant collapse when multiple options exist
    const nonFatal = event.choices.filter(c => !c.effects.some(e => e.stat === 'gameOver'));
    const pool = nonFatal.length > 0 ? nonFatal : event.choices;
    const choice = pool[Math.floor(Math.random() * pool.length)];
    for (const effect of choice.effects) {
      applyEffect(state, country, effect.stat, effect.target, effect.delta * 0.5);
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
  purgeMisfiredForeignCollapseEvents(state);
  checkPlayerCollapse(state);
  checkNpcCollapseTelegraphs(state);
}

/** Drop NPC collapse/warning events that were incorrectly queued onto the player */
function purgeMisfiredForeignCollapseEvents(state: GameState): void {
  const playerId = state.playerCountryId;
  state.activeEvents = state.activeEvents.filter(ae => {
    if (ae.resolved) return false;
    const ev = getEventById(ae.eventId);
    if (!ev) return true;
    const nationTarget = ev.triggerConditions.targetCountry;
    if (nationTarget && nationTarget !== playerId) {
      // Foreign nation crisis — never belongs on the player's modal queue
      return false;
    }
    return true;
  });

  state.pendingFollowUps = (state.pendingFollowUps ?? []).filter(f => {
    const ev = getEventById(f.eventId);
    if (!ev) return true;
    const nationTarget = ev.triggerConditions.targetCountry;
    if (nationTarget && nationTarget !== playerId) return false;
    const onlyFatal = ev.choices.length > 0 && ev.choices.every(c =>
      c.effects.some(e => e.stat === 'gameOver')
    );
    if (onlyFatal && (f.targetCountryId ?? playerId) !== playerId) return false;
    if (onlyFatal && nationTarget && nationTarget !== playerId) return false;
    return true;
  });
}

function checkPlayerCollapse(state: GameState): void {
  const country = state.countries[state.playerCountryId];
  if (!country) return;

  const collapse = country.collapseCondition;
  if (collapse.type === 'none') return;

  const triggered = isCollapseTriggered(state, state.playerCountryId);

  if (!triggered) {
    if (state.declineMode) {
      state.declineMode = false;
      state.history.push(
        `Turn ${state.turn}: ${country.name} climbs out of decline — strategic breathing room restored.`
      );
    }
    state.telegraphedCollapse = false;
    return;
  }

  if (!state.telegraphedCollapse && collapse.telegraphEventId) {
    const telegraphEvent = getEventById(collapse.telegraphEventId);
    // Only queue telegraph if it is for this nation (or has no nation lock)
    if (
      telegraphEvent &&
      (!telegraphEvent.triggerConditions.targetCountry ||
        telegraphEvent.triggerConditions.targetCountry === state.playerCountryId)
    ) {
      state.activeEvents.push(buildActiveEvent(state, telegraphEvent, state.playerCountryId));
      state.telegraphedCollapse = true;
      state.history.push(`Turn ${state.turn}: WARNING — ${telegraphEvent.title}`);
      return;
    }
  }

  if (collapse.type === 'hard') {
    state.gameOver = true;
    state.gameOverReason = `${country.name} has collapsed.`;
  } else if (collapse.type === 'soft') {
    if (!state.declineMode) {
      state.declineMode = true;
      state.history.push(`Turn ${state.turn}: ${country.name} enters decline/survival mode.`);
    }
  }
}

function checkNpcCollapseTelegraphs(state: GameState): void {
  if (!state.collapseTelegraphedNations) state.collapseTelegraphedNations = [];
  const playerId = state.playerCountryId;

  for (const [countryId, country] of Object.entries(state.countries)) {
    if (countryId === playerId) continue;
    if ((state.collapsedNations ?? []).includes(countryId)) continue;
    const collapse = country.collapseCondition;
    if (collapse.type === 'none') continue;
    if (!isCollapseTriggered(state, countryId)) continue;
    if (state.collapseTelegraphedNations.includes(countryId)) continue;

    const telegraphId = collapse.telegraphEventId;
    if (!telegraphId) continue;

    const telegraphEvent = getEventById(telegraphId);
    if (!telegraphEvent) continue;

    state.collapseTelegraphedNations.push(countryId);
    state.history.push(`Turn ${state.turn}: ${country.name} — ${telegraphEvent.title}`);

    // Informational only for the player — never queue NPC crisis events onto the player modal
    const atWar = state.wars.some(
      w => w.belligerents.includes(countryId) && w.belligerents.includes(playerId)
    );
    const rel = getRelation(state.relations, playerId, countryId);
    if (atWar || Math.abs(rel) > 25) {
      state.history.push(
        `Turn ${state.turn}: Intelligence brief — crisis in ${country.name} may reshape the board.`
      );
    }

    // After telegraph grace for hard NPC collapses, mark them collapsed next pass
    // (telegraph already recorded; finish on subsequent turns while still triggered)
  }

  // Second pass: NPCs who were telegraphed and still triggered become collapsedNations
  for (const countryId of [...state.collapseTelegraphedNations]) {
    if (countryId === playerId) continue;
    if ((state.collapsedNations ?? []).includes(countryId)) continue;
    const country = state.countries[countryId];
    if (!country || country.collapseCondition.type !== 'hard') continue;
    if (!isCollapseTriggered(state, countryId)) continue;

    state.collapsedNations ??= [];
    state.collapsedNations.push(countryId);
    state.history.push(
      `Turn ${state.turn}: ${country.name} collapses — the regime exits the strategic fight.`
    );

    // Pull collapsed nation out of wars
    for (const war of state.wars) {
      if (!war.belligerents.includes(countryId)) continue;
      war.belligerents = war.belligerents.filter(b => b !== countryId);
      delete war.isDefensive[countryId];
    }
    state.wars = state.wars.filter(w => w.belligerents.length >= 2);
    state.fronts = state.fronts.filter(
      f => f.attackerCountryId !== countryId && f.defenderCountryId !== countryId
    );
  }
}

export function triggerUnprovokedStrikeEvent(state: GameState): void {
  triggerEventById(state, 'unprovoked_strike_condemnation', state.playerCountryId);
}

export function triggerEventById(state: GameState, eventId: string, countryId: string): void {
  const event = getEventById(eventId);
  if (!event) return;
  const already = state.activeEvents.some(e => e.eventId === eventId && !e.resolved);
  if (already) return;
  state.activeEvents.push(buildActiveEvent(state, event, countryId));
}

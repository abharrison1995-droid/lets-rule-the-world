import type {
  GameState,
  TheaterDoctrine,
  TheaterHexRuntime,
  TheaterStack,
  TheaterUnitTag,
  WarTheaterState,
} from '../types/game';
import {
  axialNeighbors,
  findTheaterDefForWar,
  getTheaterDef,
  type TheaterDef,
  type TheaterHexDef,
} from '../data/theaterDefs';

/** Shared theater-state queries and stack helpers used across combat, lifecycle, and player actions. */

export function makeStack(countryId: string, strength: number, tags: TheaterUnitTag[], specialists: string[] = []): TheaterStack {
  return { countryId, strength, tags, specialists };
}

/** Open theaters for wars that have defs; close when war ends */
export function syncWarTheaters(state: GameState): void {
  state.warTheaters ??= [];
  state.vassalRegions ??= [];

  const activeWarIds = new Set(state.wars.map(w => w.id));

  for (const theater of state.warTheaters) {
    if (!activeWarIds.has(theater.warId) && !theater.closed) {
      theater.closed = true;
      state.history.push(`Turn ${state.turn}: ${theater.name} freezes — peace lines hold for now.`);
    }
  }

  for (const war of state.wars) {
    const def = findTheaterDefForWar(war.belligerents);
    if (!def) continue;
    const exists = state.warTheaters.some(t => t.warId === war.id && !t.closed);
    if (exists) continue;
    const theater = createTheaterFromWar(state, war.id, def);
    state.warTheaters.push(theater);
    // Only interrupt the player when they are a belligerent — foreign wars
    // (e.g. RU–UA at USA campaign start) still open in the background for reports.
    if (war.belligerents.includes(state.playerCountryId)) {
      state.pendingTheaterNotices ??= [];
      state.pendingTheaterNotices.push(theater.id);
    }
    state.history.push(`Turn ${state.turn}: ${def.name} opens — operational hex board active.`);
  }

  pruneForeignTheaterNotices(state);
}

function seedHexRuntime(def: TheaterDef, state: GameState): Record<string, TheaterHexRuntime> {
  const hexes: Record<string, TheaterHexRuntime> = {};
  for (const h of def.hexes) {
    const region = state.regions[h.regionId];
    const ownerId = region?.controlledBy ?? region?.countryId ?? h.regionId.split('_')[0];
    const homeNation = region?.countryId ?? ownerId;
    const isFrontline =
      h.regionId.startsWith('ukr_east') ||
      h.regionId === 'ukr_south' ||
      h.regionId.startsWith('rus_');

    let stack: TheaterStack | null = null;
    if (ownerId === 'russia' || homeNation === 'russia') {
      const str = isFrontline ? 22 + (h.isCity ? 8 : 0) : 14;
      stack = makeStack('russia', str, ['infantry', 'armor', 'artillery'], h.facilityHint ? [h.facilityHint] : []);
    } else if (ownerId === 'ukraine' || homeNation === 'ukraine') {
      const str = h.isCity ? 28 : isFrontline ? 18 : 12;
      stack = makeStack('ukraine', str, ['infantry', 'drone', 'artillery'], h.facilityHint ? [h.facilityHint] : []);
    }

    hexes[h.id] = {
      ownerId,
      stack,
      contested: false,
      fortLevel: h.terrain === 'fort' || h.isCity ? 1 : 0,
      revealedUntilTurn: 0,
    };
  }

  // Opening pressure: Russian stacks already in a few eastern border hexes of Ukraine
  for (const h of def.hexes) {
    if (h.regionId === 'ukr_east' && (h.q >= 5 || h.cityName === 'Donetsk')) {
      hexes[h.id].ownerId = 'russia';
      hexes[h.id].stack = makeStack('russia', 24, ['infantry', 'armor'], []);
      hexes[h.id].contested = true;
    }
  }

  return hexes;
}

function createTheaterFromWar(state: GameState, warId: string, def: TheaterDef): WarTheaterState {
  const war = state.wars.find(w => w.id === warId);
  const doctrineByCountry: Record<string, TheaterDoctrine> = {};
  for (const id of war?.belligerents ?? def.primaryBelligerents) {
    doctrineByCountry[id] = id === war?.initiatorId ? 'attack' : 'hold';
  }

  return {
    id: `theater_${def.id}_${warId}`,
    warId,
    defId: def.id,
    name: def.name,
    hexes: seedHexRuntime(def, state),
    doctrineByCountry,
    resolveMode: 'play_out',
    impulsesThisWorldTurn: 0,
    pendingFate: null,
    closed: false,
    playerDoctrineAi: true,
    combatLog: [],
  };
}

/** Drop theater popups for wars the player is not fighting. */
export function pruneForeignTheaterNotices(state: GameState): void {
  state.pendingTheaterNotices = (state.pendingTheaterNotices ?? []).filter(id => {
    const theater = (state.warTheaters ?? []).find(t => t.id === id);
    if (!theater || theater.closed) return false;
    const war = state.wars.find(w => w.id === theater.warId);
    return Boolean(war?.belligerents.includes(state.playerCountryId));
  });
}

export function getActiveTheaters(state: GameState): WarTheaterState[] {
  return (state.warTheaters ?? []).filter(t => !t.closed);
}

export function getTheater(state: GameState, theaterId: string): WarTheaterState | undefined {
  return (state.warTheaters ?? []).find(t => t.id === theaterId);
}

export function isRegionInActiveTheater(state: GameState, regionId: string): boolean {
  for (const t of getActiveTheaters(state)) {
    const def = getTheaterDef(t.defId);
    if (def?.regionIds.includes(regionId)) return true;
  }
  return false;
}

export function canSeeHex(
  state: GameState,
  theater: WarTheaterState,
  hexDef: TheaterHexDef,
  viewerId: string
): boolean {
  const runtime = theater.hexes[hexDef.id];
  if (!runtime) return false;
  if (runtime.ownerId === viewerId) return true;
  if (runtime.stack?.countryId === viewerId) return true;
  if (runtime.contested) return true;
  if (runtime.revealedUntilTurn >= state.turn) return true;

  for (const [nq, nr] of axialNeighbors(hexDef.q, hexDef.r)) {
    const neighbour = getTheaterDef(theater.defId)?.hexes.find(h => h.q === nq && h.r === nr);
    if (!neighbour) continue;
    const nrt = theater.hexes[neighbour.id];
    if (nrt && (nrt.ownerId === viewerId || nrt.stack?.countryId === viewerId)) return true;
  }
  return false;
}

export function getTheaterForWar(state: GameState, warId: string): WarTheaterState | undefined {
  return getActiveTheaters(state).find(t => t.warId === warId);
}

export function dismissTheaterNotice(state: GameState, theaterId: string): void {
  state.pendingTheaterNotices = (state.pendingTheaterNotices ?? []).filter(id => id !== theaterId);
}

export function acknowledgeAllTheaterNotices(state: GameState): void {
  state.pendingTheaterNotices = [];
}

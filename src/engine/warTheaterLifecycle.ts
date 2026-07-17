import type { GameState, PeaceTermsType, WarTheaterState } from '../types/game';
import { axialKey, axialNeighbors, getTheaterDef, hexesForRegion } from '../data/theaterDefs';
import { modifyRelation } from '../data/relations';
import { getActiveTheaters, getTheater, makeStack, syncWarTheaters } from './warTheaterCore';
import { resolveTheaterImpulse } from './warTheaterCombat';

/** Theater turn-tick, region fate (vassal/absorb), and peace settlement. */

export function resolveRegionFate(
  state: GameState,
  theaterId: string,
  choice: 'vassal' | 'absorb'
): string | null {
  const theater = getTheater(state, theaterId);
  const fate = theater?.pendingFate;
  if (!theater || !fate) return 'No region fate pending.';

  const region = state.regions[fate.regionId];
  if (!region) return 'Region missing.';

  state.vassalRegions = (state.vassalRegions ?? []).filter(v => v.regionId !== fate.regionId);

  if (choice === 'vassal') {
    state.vassalRegions.push({
      regionId: fate.regionId,
      overlordId: fate.conquerorId,
      subjectNationId: fate.subjectNationId,
      formedTurn: state.turn,
    });
    region.controlledBy = fate.conquerorId;
    region.unrest = Math.max(region.unrest, 28);
    modifyRelation(state.relations, fate.subjectNationId, fate.conquerorId, -10);
    state.history.push(
      `Turn ${state.turn}: ${state.countries[fate.conquerorId]?.name} installs a vassal administration in ${region.name} (tribute + subject resentment).`
    );
  } else {
    region.controlledBy = fate.conquerorId;
    region.unrest = Math.min(100, region.unrest + 55);
    region.garrison.troops = Math.max(300, Math.floor(region.garrison.troops * 0.55));
    modifyRelation(state.relations, fate.subjectNationId, fate.conquerorId, -22);
    if (fate.conquerorId === state.playerCountryId) {
      state.internationalPariahTurns = Math.max(state.internationalPariahTurns ?? 0, 4);
    }
    // Neighbors of the annexed home nation resent annexation
    for (const nId of region.neighbours) {
      const neighbor = state.regions[nId];
      if (!neighbor || neighbor.countryId === fate.conquerorId) continue;
      if (neighbor.countryId === fate.subjectNationId) continue;
      modifyRelation(state.relations, neighbor.countryId, fate.conquerorId, -4);
    }
    state.history.push(
      `Turn ${state.turn}: ${state.countries[fate.conquerorId]?.name} absorbs ${region.name} into direct control (unrest spike${fate.conquerorId === state.playerCountryId ? ', pariah status' : ''}).`
    );
  }

  theater.pendingFate = null;
  return null;
}

/** Tribute, unrest floor, and subject resentment for vassal holdings */
export function tickVassalRegions(state: GameState): void {
  for (const v of state.vassalRegions ?? []) {
    const region = state.regions[v.regionId];
    const overlord = state.countries[v.overlordId];
    const subject = state.countries[v.subjectNationId];
    if (!region || !overlord) continue;

    region.controlledBy = v.overlordId;
    region.unrest = Math.max(region.unrest, 22);

    const tribute = Math.min(
      6,
      Math.max(1, Math.round((region.industryValue || 10) * 0.04))
    );
    if (subject && subject.stats.treasuryPoints > tribute) {
      subject.stats.treasuryPoints -= tribute;
      overlord.stats.treasuryPoints += tribute * 0.85;
    } else {
      overlord.stats.treasuryPoints += tribute * 0.4;
    }

    modifyRelation(state.relations, v.subjectNationId, v.overlordId, -1);
    if (Math.random() < 0.15) {
      region.unrest = Math.min(100, region.unrest + 6);
    }
  }
}

function clearTheaterContested(theater: WarTheaterState): void {
  for (const rt of Object.values(theater.hexes)) {
    rt.contested = false;
  }
}

export function getRegionHexControl(
  theater: WarTheaterState,
  regionId: string
): { total: number; byOwner: Record<string, number> } {
  const regionHexes = hexesForRegion(theater.defId, regionId);
  const byOwner: Record<string, number> = {};
  for (const h of regionHexes) {
    const owner = theater.hexes[h.id]?.ownerId ?? '?';
    byOwner[owner] = (byOwner[owner] ?? 0) + 1;
  }
  return { total: regionHexes.length, byOwner };
}

function syncRegionsFromHexMajority(state: GameState, theater: WarTheaterState): void {
  const def = getTheaterDef(theater.defId);
  if (!def) return;
  for (const regionId of def.regionIds) {
    const region = state.regions[regionId];
    if (!region) continue;
    const { total, byOwner } = getRegionHexControl(theater, regionId);
    if (total === 0) continue;
    let best = '';
    let bestN = 0;
    for (const [owner, n] of Object.entries(byOwner)) {
      if (n > bestN) {
        best = owner;
        bestN = n;
      }
    }
    if (best && bestN > total / 2) {
      region.controlledBy = best;
    }
  }
}

function restoreTheaterToHomeNations(state: GameState, theater: WarTheaterState): void {
  const def = getTheaterDef(theater.defId);
  if (!def) return;
  for (const h of def.hexes) {
    const region = state.regions[h.regionId];
    const home = region?.countryId;
    if (!home) continue;
    const rt = theater.hexes[h.id];
    if (!rt) continue;
    rt.ownerId = home;
    rt.contested = false;
    if (rt.stack && rt.stack.countryId !== home) {
      rt.stack = makeStack(
        home,
        Math.max(8, Math.floor(rt.stack.strength * 0.55)),
        rt.stack.tags,
        rt.stack.specialists
      );
    }
  }
  for (const regionId of def.regionIds) {
    const region = state.regions[regionId];
    if (region) region.controlledBy = region.countryId;
  }
}

function demilitarizeBorderHexes(theater: WarTheaterState): string[] {
  const def = getTheaterDef(theater.defId);
  if (!def) return [];
  const byAxial = new Map(def.hexes.map(h => [axialKey(h.q, h.r), h]));
  const dmz: string[] = [];

  for (const h of def.hexes) {
    const rt = theater.hexes[h.id];
    if (!rt) continue;
    const onBorder = axialNeighbors(h.q, h.r).some(([nq, nr]) => {
      const other = byAxial.get(axialKey(nq, nr));
      if (!other) return false;
      const ort = theater.hexes[other.id];
      return !!ort && ort.ownerId !== rt.ownerId;
    });
    if (!onBorder) continue;
    dmz.push(h.id);
    rt.stack = null;
    rt.contested = false;
    rt.fortLevel = Math.max(0, rt.fortLevel - 1);
  }
  return dmz;
}

/** Share of theater hexes owned by countryId (0–1) */
export function getTheaterControlShare(theater: WarTheaterState, countryId: string): number {
  const ids = Object.keys(theater.hexes);
  if (ids.length === 0) return 0;
  let owned = 0;
  for (const id of ids) {
    if (theater.hexes[id]?.ownerId === countryId) owned += 1;
  }
  return owned / ids.length;
}

/**
 * Write freeze / cede / DMZ / white peace onto the open theater for a war,
 * then close the board and record a settlement.
 */
export function applyTheaterPeaceSettlement(
  state: GameState,
  warId: string,
  terms: PeaceTermsType
): void {
  state.theaterSettlements ??= [];
  const theater = (state.warTheaters ?? []).find(t => t.warId === warId && !t.closed);
  if (!theater) return;

  const def = getTheaterDef(theater.defId);
  if (!def) return;

  let dmzHexIds: string[] = [];
  let freezeUntilTurn: number | undefined;

  if (terms === 'white_peace') {
    restoreTheaterToHomeNations(state, theater);
  } else if (terms === 'ceasefire') {
    clearTheaterContested(theater);
    syncRegionsFromHexMajority(state, theater);
    freezeUntilTurn = state.turn + 8;
  } else if (terms === 'freeze_lines' || terms === 'reparations') {
    clearTheaterContested(theater);
    syncRegionsFromHexMajority(state, theater);
  } else if (terms === 'territorial_cede') {
    clearTheaterContested(theater);
    syncRegionsFromHexMajority(state, theater);
  } else if (terms === 'dmz') {
    clearTheaterContested(theater);
    dmzHexIds = demilitarizeBorderHexes(theater);
    syncRegionsFromHexMajority(state, theater);
    freezeUntilTurn = state.turn + 12;
  }

  theater.closed = true;
  theater.pendingFate = null;
  state.theaterSettlements.push({
    warId,
    theaterId: theater.id,
    terms,
    freezeUntilTurn,
    dmzHexIds,
    settledTurn: state.turn,
  });

  const label = terms.replace(/_/g, ' ');
  state.history.push(
    `Turn ${state.turn}: ${theater.name} settled under ${label}` +
      (dmzHexIds.length ? ` (${dmzHexIds.length} DMZ hexes)` : '') +
      (freezeUntilTurn ? ` until turn ${freezeUntilTurn}` : '') +
      '.'
  );
}

/** Called each world turn — doctrine AI always runs; quick resolve doubles impulses */
export function tickWarTheaters(state: GameState): void {
  syncWarTheaters(state);

  for (const theater of getActiveTheaters(state)) {
    theater.impulsesThisWorldTurn = 0;
    theater.playerDoctrineAi ??= true;
    theater.combatLog ??= [];
    if (theater.resolveMode === 'quick_resolve') {
      resolveTheaterImpulse(state, theater.id);
      resolveTheaterImpulse(state, theater.id);
    } else {
      resolveTheaterImpulse(state, theater.id);
    }
  }
}

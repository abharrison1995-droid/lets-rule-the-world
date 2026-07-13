import type {
  GameState,
  TheaterDoctrine,
  TheaterHexRuntime,
  TheaterResolveMode,
  TheaterStack,
  TheaterUnitTag,
  WarTheaterState,
} from '../types/game';
import {
  axialNeighbors,
  findTheaterDefForWar,
  getTheaterDef,
  hexesForRegion,
  type TheaterDef,
  type TheaterHexDef,
} from '../data/theaterDefs';
import { getEffectiveSpendCost } from './fiscal';

const TERRAIN_DEF_BONUS: Record<string, number> = {
  plains: 0,
  forest: 0.12,
  river: 0.1,
  urban: 0.18,
  fort: 0.28,
};

const REINFORCE_COST = 4;

function playerCanPay(state: GameState, costTp: number): boolean {
  const country = state.countries[state.playerCountryId];
  if (!country) return false;
  return country.stats.treasuryPoints >= getEffectiveSpendCost(country, costTp);
}

function playerPay(state: GameState, costTp: number): boolean {
  const country = state.countries[state.playerCountryId];
  if (!country) return false;
  const effective = getEffectiveSpendCost(country, costTp);
  if (country.stats.treasuryPoints < effective) return false;
  country.stats.treasuryPoints -= effective;
  return true;
}

function makeStack(countryId: string, strength: number, tags: TheaterUnitTag[], specialists: string[] = []): TheaterStack {
  return { countryId, strength, tags, specialists };
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

export function createTheaterFromWar(state: GameState, warId: string, def: TheaterDef): WarTheaterState {
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
  };
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
    state.history.push(`Turn ${state.turn}: ${def.name} opens — operational hex board active.`);
  }
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

function supplyModifier(theater: WarTheaterState, countryId: string): number {
  const doctrine = theater.doctrineByCountry[countryId] ?? 'hold';
  if (doctrine === 'withdraw') return 0.85;
  if (doctrine === 'attack') return 0.95;
  return 1;
}

function contextRoll(atk: number, def: number): number {
  // High drama but weighted: mean biased by power ratio
  const ratio = atk / Math.max(1, def);
  const bias = Math.tanh((ratio - 1) * 1.2) * 0.35;
  const drama = (Math.random() + Math.random() + Math.random()) / 3; // ~bell curve 0–1
  return drama + bias;
}

export function resolveHexBattle(
  state: GameState,
  theater: WarTheaterState,
  hexDef: TheaterHexDef,
  attackerId: string,
  fromHexId: string
): string {
  const def = getTheaterDef(theater.defId);
  if (!def) return 'Theater data missing.';

  const target = theater.hexes[hexDef.id];
  const from = theater.hexes[fromHexId];
  if (!target || !from?.stack || from.stack.countryId !== attackerId) {
    return 'No attacking stack.';
  }
  if (target.ownerId === attackerId && !target.contested) {
    return 'Hex already friendly.';
  }

  const defenderId = target.stack?.countryId ?? target.ownerId;
  const attacker = state.countries[attackerId];
  const defender = state.countries[defenderId];
  if (!attacker || !defender) return 'Invalid belligerent.';

  const atkBase =
    from.stack.strength *
    (1 + attacker.militaryDev.troopQuality * 0.08) *
    (1 + (from.stack.tags.includes('armor') ? 0.1 : 0)) *
    (1 + (from.stack.tags.includes('artillery') ? 0.08 : 0)) *
    supplyModifier(theater, attackerId);

  const defStackStr = target.stack?.strength ?? 8;
  const defBase =
    defStackStr *
    (1 + defender.militaryDev.troopQuality * 0.08) *
    (1 + (TERRAIN_DEF_BONUS[hexDef.terrain] ?? 0)) *
    (1 + target.fortLevel * 0.15) *
    (1 + (hexDef.isCity ? 0.12 : 0)) *
    supplyModifier(theater, defenderId);

  const roll = contextRoll(atkBase, defBase);
  const atkScore = atkBase * (0.65 + roll * 0.7);
  const defScore = defBase * (0.65 + (1 - roll) * 0.5 + Math.random() * 0.15);

  const atkLoss = Math.max(2, Math.round(defScore * 0.12));
  const defLoss = Math.max(3, Math.round(atkScore * 0.14));

  from.stack.strength = Math.max(0, from.stack.strength - atkLoss);
  if (target.stack) {
    target.stack.strength = Math.max(0, target.stack.strength - defLoss);
  }

  attacker.stats.warExhaustion = Math.min(1, attacker.stats.warExhaustion + atkLoss * 0.0015);
  defender.stats.warExhaustion = Math.min(1, defender.stats.warExhaustion + defLoss * 0.002);

  let result: string;

  if (atkScore > defScore * 1.05) {
    const remnants = target.stack && target.stack.strength > 4 ? Math.floor(target.stack.strength * 0.4) : 0;
    target.ownerId = attackerId;
    target.contested = remnants > 0;
    target.stack = makeStack(
      attackerId,
      Math.max(6, Math.floor(from.stack.strength * 0.55)),
      from.stack.tags,
      hexDef.facilityHint ? [hexDef.facilityHint] : []
    );
    from.stack.strength = Math.max(4, Math.floor(from.stack.strength * 0.45));
    if (remnants > 0) {
      // Defender shattered in place as contested pressure
      target.contested = true;
    }

    if (hexDef.isCity) {
      defender.stats.warExhaustion = Math.min(1, defender.stats.warExhaustion + 0.04);
      defender.stats.moraleBase = Math.max(0.1, defender.stats.moraleBase - 0.03);
      attacker.stats.moraleBase = Math.min(0.95, attacker.stats.moraleBase + 0.015);
      state.history.push(
        `Turn ${state.turn}: ${attacker.name} seizes ${hexDef.cityName ?? 'city'} in ${theater.name}.`
      );
    }

    result = `${attacker.name} takes hex${hexDef.cityName ? ` (${hexDef.cityName})` : ''} — ATK ${Math.round(atkScore)} vs DEF ${Math.round(defScore)}.`;
    checkRegionCapture(state, theater, hexDef.regionId, attackerId);
  } else {
    target.contested = true;
    if (target.stack && target.stack.strength <= 0) {
      target.stack = makeStack(defenderId, 6, ['infantry'], []);
    }
    if (from.stack.strength <= 0) {
      from.stack = null;
    }
    result = `${defender.name} holds hex${hexDef.cityName ? ` (${hexDef.cityName})` : ''} — ATK ${Math.round(atkScore)} vs DEF ${Math.round(defScore)}.`;
  }

  target.revealedUntilTurn = state.turn + 1;
  return result;
}

function checkRegionCapture(
  state: GameState,
  theater: WarTheaterState,
  regionId: string,
  conquerorId: string
): void {
  const def = getTheaterDef(theater.defId);
  if (!def) return;
  const regionHexes = hexesForRegion(theater.defId, regionId);
  if (regionHexes.length === 0) return;

  const allOwned = regionHexes.every(h => theater.hexes[h.id]?.ownerId === conquerorId);
  if (!allOwned) return;

  const region = state.regions[regionId];
  if (!region || region.controlledBy === conquerorId) return;

  const subjectNationId = region.countryId;
  region.controlledBy = conquerorId;
  region.unrest = Math.min(100, region.unrest + 40);
  region.garrison.troops = Math.max(500, Math.floor(region.garrison.troops * 0.35));

  state.history.push(
    `Turn ${state.turn}: ${state.countries[conquerorId]?.name} completes operational control of ${region.name}.`
  );

  if (conquerorId === state.playerCountryId) {
    theater.pendingFate = {
      theaterId: theater.id,
      regionId,
      conquerorId,
      subjectNationId,
    };
  } else {
    // NPC: prefer absorb of foreign soil; vassal rarely
    resolveRegionFate(state, theater.id, Math.random() < 0.25 ? 'vassal' : 'absorb');
  }
}

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
    state.history.push(
      `Turn ${state.turn}: ${state.countries[fate.conquerorId]?.name} installs a vassal administration in ${region.name}.`
    );
  } else {
    state.history.push(
      `Turn ${state.turn}: ${state.countries[fate.conquerorId]?.name} absorbs ${region.name} into direct control.`
    );
  }

  theater.pendingFate = null;
  return null;
}

export function playerTheaterMove(
  state: GameState,
  theaterId: string,
  fromHexId: string,
  toHexId: string
): string | null {
  const theater = getTheater(state, theaterId);
  const def = theater ? getTheaterDef(theater.defId) : undefined;
  if (!theater || !def) return 'Theater not found.';
  if (theater.pendingFate) return 'Resolve captured region fate first.';

  const fromDef = def.hexes.find(h => h.id === fromHexId);
  const toDef = def.hexes.find(h => h.id === toHexId);
  if (!fromDef || !toDef) return 'Invalid hex.';

  const adjacent = axialNeighbors(fromDef.q, fromDef.r).some(([q, r]) => q === toDef.q && r === toDef.r);
  if (!adjacent) return 'Can only move to adjacent hexes.';

  const from = theater.hexes[fromHexId];
  const to = theater.hexes[toHexId];
  if (!from?.stack || from.stack.countryId !== state.playerCountryId) return 'No friendly stack there.';

  if (to.ownerId !== state.playerCountryId && to.stack && to.stack.countryId !== state.playerCountryId) {
    return resolveHexBattle(state, theater, toDef, state.playerCountryId, fromHexId);
  }

  // Peaceful move / reinforce friendly empty
  if (!to.stack || to.stack.countryId === state.playerCountryId) {
    const moving = Math.floor(from.stack.strength * 0.6);
    from.stack.strength = Math.max(4, from.stack.strength - moving);
    if (to.stack && to.stack.countryId === state.playerCountryId) {
      to.stack.strength += moving;
    } else {
      to.stack = makeStack(state.playerCountryId, moving, from.stack.tags, [...from.stack.specialists]);
      to.ownerId = state.playerCountryId;
    }
    return `Moved ${moving} strength to adjacent hex.`;
  }

  return resolveHexBattle(state, theater, toDef, state.playerCountryId, fromHexId);
}

export function playerReinforceTheater(
  state: GameState,
  theaterId: string,
  hexId: string
): string | null {
  const theater = getTheater(state, theaterId);
  if (!theater) return 'Theater not found.';
  const hex = theater.hexes[hexId];
  if (!hex || hex.ownerId !== state.playerCountryId) return 'Must reinforce a hex you control.';
  if (!playerCanPay(state, REINFORCE_COST)) return 'Insufficient treasury.';
  playerPay(state, REINFORCE_COST);

  if (!hex.stack) {
    hex.stack = makeStack(state.playerCountryId, 10, ['infantry'], []);
  } else {
    hex.stack.strength += 10;
    if (!hex.stack.tags.includes('infantry')) hex.stack.tags.push('infantry');
  }
  return `Reinforced hex (+10 strength, −${REINFORCE_COST} TP).`;
}

export function setTheaterDoctrine(
  state: GameState,
  theaterId: string,
  doctrine: TheaterDoctrine
): void {
  const theater = getTheater(state, theaterId);
  if (!theater) return;
  theater.doctrineByCountry[state.playerCountryId] = doctrine;
}

export function setTheaterResolveMode(
  state: GameState,
  theaterId: string,
  mode: TheaterResolveMode
): void {
  const theater = getTheater(state, theaterId);
  if (!theater) return;
  theater.resolveMode = mode;
}

function enemyHexTargets(
  theater: WarTheaterState,
  def: TheaterDef,
  countryId: string
): Array<{ from: TheaterHexDef; to: TheaterHexDef }> {
  const pairs: Array<{ from: TheaterHexDef; to: TheaterHexDef }> = [];
  for (const h of def.hexes) {
    const rt = theater.hexes[h.id];
    if (!rt?.stack || rt.stack.countryId !== countryId || rt.stack.strength < 8) continue;
    for (const [nq, nr] of axialNeighbors(h.q, h.r)) {
      const n = def.hexes.find(x => x.q === nq && x.r === nr);
      if (!n) continue;
      const nrt = theater.hexes[n.id];
      if (!nrt) continue;
      if (nrt.ownerId !== countryId) {
        pairs.push({ from: h, to: n });
      }
    }
  }
  return pairs;
}

function runDoctrineImpulse(state: GameState, theater: WarTheaterState, countryId: string): void {
  const def = getTheaterDef(theater.defId);
  if (!def) return;
  if (countryId === state.playerCountryId && theater.resolveMode === 'play_out') {
    // Player micro — only auto-fill if they set attack and we do a light support impulse
  }

  const doctrine = theater.doctrineByCountry[countryId] ?? 'hold';
  if (doctrine === 'hold') return;

  const pairs = enemyHexTargets(theater, def, countryId);
  if (pairs.length === 0) return;

  const attacks = doctrine === 'attack' ? Math.min(3, pairs.length) : Math.min(1, pairs.length);
  // Prefer city / contested
  pairs.sort((a, b) => {
    const score = (p: typeof a) =>
      (p.to.isCity ? 5 : 0) + (theater.hexes[p.to.id]?.contested ? 2 : 0) + Math.random();
    return score(b) - score(a);
  });

  for (let i = 0; i < attacks; i++) {
    const { from, to } = pairs[i];
    if (doctrine === 'withdraw') {
      // Pull strength back toward home regions
      const rt = theater.hexes[from.id];
      if (rt?.stack && rt.stack.strength > 10) {
        rt.stack.strength = Math.max(6, Math.floor(rt.stack.strength * 0.85));
      }
      continue;
    }
    resolveHexBattle(state, theater, to, countryId, from.id);
  }
}

/** One operational impulse for all actors on a theater */
export function resolveTheaterImpulse(state: GameState, theaterId: string): void {
  const theater = getTheater(state, theaterId);
  if (!theater || theater.closed || theater.pendingFate) return;

  const war = state.wars.find(w => w.id === theater.warId);
  const actors = new Set<string>([
    ...(war?.belligerents ?? []),
    ...Object.values(theater.hexes)
      .map(h => h.stack?.countryId)
      .filter((id): id is string => !!id),
  ]);

  for (const countryId of actors) {
    if (countryId === state.playerCountryId && theater.resolveMode === 'play_out') continue;
    runDoctrineImpulse(state, theater, countryId);
  }

  // Player with attack doctrine still gets one auto pulse even in play_out as "supporting fires"
  if (
    theater.resolveMode === 'play_out' &&
    theater.doctrineByCountry[state.playerCountryId] === 'attack'
  ) {
    // leave micro to player — no forced attacks
  }

  theater.impulsesThisWorldTurn += 1;
}

/** Called each world turn — quick resolve runs impulses; play_out expects player actions + light AI */
export function tickWarTheaters(state: GameState): void {
  syncWarTheaters(state);

  for (const theater of getActiveTheaters(state)) {
    theater.impulsesThisWorldTurn = 0;
    if (theater.resolveMode === 'quick_resolve') {
      resolveTheaterImpulse(state, theater.id);
      resolveTheaterImpulse(state, theater.id);
    } else {
      // Enemy + ally AI act once; player micros separately
      resolveTheaterImpulse(state, theater.id);
    }
  }
}

/** Strikes allocate damage onto hexes inside the target region */
export function applyStrikeToTheaterHexes(
  state: GameState,
  attackerId: string,
  targetRegionId: string,
  strikePower: number
): void {
  for (const theater of getActiveTheaters(state)) {
    const def = getTheaterDef(theater.defId);
    if (!def?.regionIds.includes(targetRegionId)) continue;
    const targets = hexesForRegion(theater.defId, targetRegionId)
      .map(h => ({ def: h, rt: theater.hexes[h.id] }))
      .filter(x => x.rt && x.rt.ownerId !== attackerId);

    if (targets.length === 0) continue;
    targets.sort((a, b) => (b.def.isCity ? 1 : 0) - (a.def.isCity ? 1 : 0));
    const hit = targets.slice(0, Math.min(3, targets.length));
    const dmgEach = Math.max(3, Math.round((strikePower * 0.35) / hit.length));

    for (const { def: h, rt } of hit) {
      if (!rt) continue;
      if (rt.stack) {
        rt.stack.strength = Math.max(0, rt.stack.strength - dmgEach);
        if (rt.stack.strength <= 0) rt.stack = null;
      }
      rt.contested = true;
      rt.revealedUntilTurn = state.turn + 2;
      if (h.isCity) {
        const owner = state.countries[rt.ownerId];
        if (owner) owner.stats.warExhaustion = Math.min(1, owner.stats.warExhaustion + 0.01);
      }
    }
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

export function playerCanInterveneInTheater(state: GameState, theaterId: string): boolean {
  const theater = getTheater(state, theaterId);
  if (!theater || theater.closed) return false;
  const war = state.wars.find(w => w.id === theater.warId);
  if (!war) return false;
  if (war.belligerents.includes(state.playerCountryId)) return true;
  // Third party with hostile or allied interest can send expeditionary (escalation)
  return true;
}

export function playerDeployExpeditionary(
  state: GameState,
  theaterId: string,
  hexId: string,
  supportCountryId: string
): string | null {
  const theater = getTheater(state, theaterId);
  const def = theater ? getTheaterDef(theater.defId) : undefined;
  if (!theater || !def) return 'Theater not found.';

  const hexDef = def.hexes.find(h => h.id === hexId);
  const rt = theater.hexes[hexId];
  if (!hexDef || !rt) return 'Invalid hex.';
  if (rt.ownerId !== supportCountryId && rt.stack?.countryId !== supportCountryId) {
    return 'Expeditionary forces must deploy into a partner-held hex.';
  }
  if (!playerCanPay(state, 8)) return 'Insufficient treasury for expeditionary deployment.';
  playerPay(state, 8);

  const existing = rt.stack;
  if (existing && existing.countryId === supportCountryId) {
    existing.strength += 12;
    if (!existing.tags.includes('air')) existing.tags.push('air');
    existing.specialists.push('expeditionary');
  } else {
    rt.stack = makeStack(supportCountryId, 12, ['infantry', 'air'], ['expeditionary']);
    rt.ownerId = supportCountryId;
  }

  // Soft escalation if not already at war
  const war = state.wars.find(w => w.id === theater.warId);
  if (war && !war.belligerents.includes(state.playerCountryId)) {
    state.history.push(
      `Turn ${state.turn}: ${state.countries[state.playerCountryId]?.name} deploys expeditionary forces into ${theater.name} in support of ${state.countries[supportCountryId]?.name}.`
    );
  }
  return 'Expeditionary detachment deployed.';
}

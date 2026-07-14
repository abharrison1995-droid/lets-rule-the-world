import type {
  GameState,
  PeaceTermsType,
  TheaterDoctrine,
  TheaterHexRuntime,
  TheaterResolveMode,
  TheaterStack,
  TheaterUnitTag,
  WarTheaterState,
} from '../types/game';
import {
  axialKey,
  axialNeighbors,
  findTheaterDefForWar,
  getTheaterDef,
  hexesForRegion,
  type TheaterDef,
  type TheaterHexDef,
} from '../data/theaterDefs';
import { modifyRelation } from '../data/relations';
import { getEffectiveSpendCost } from './fiscal';

const TERRAIN_DEF_BONUS: Record<string, number> = {
  plains: 0,
  forest: 0.14,
  river: 0.12,
  urban: 0.2,
  fort: 0.32,
};

/** Pass 2 weight order: stack > fort/city > terrain > air/drone > morale/exhaust > supply */
const W = {
  stack: 1,
  fortCity: 0.22,
  terrain: 0.16,
  airDrone: 0.12,
  moraleExhaust: 0.1,
  supply: 0.08,
} as const;

const REINFORCE_COST = 4;
const AID_REINFORCE_COST = 5;
const INTERVENTION_THRESHOLD = 100;
const INTERVENTION_PER_DEPLOY = 28;

export interface HexBattlePreview {
  atkPower: number;
  defPower: number;
  ratio: number;
  winChance: number;
  label: 'Strongly favored' | 'Favored' | 'Even' | 'Uphill' | 'Long shot';
  breakdown: string[];
  /** Expected strength loss if battle resolves near forecast */
  estAtkLoss: number;
  estDefLoss: number;
}

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
    playerDoctrineAi: true,
    combatLog: [],
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
    state.pendingTheaterNotices ??= [];
    state.pendingTheaterNotices.push(theater.id);
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
  if (doctrine === 'withdraw') return 0.9;
  if (doctrine === 'attack') return 0.96;
  return 1;
}

function doctrineAtkMult(theater: WarTheaterState, countryId: string): number {
  const doctrine = theater.doctrineByCountry[countryId] ?? 'hold';
  if (doctrine === 'attack') return 1.14;
  if (doctrine === 'withdraw') return 0.82;
  return 1;
}

function doctrineDefMult(theater: WarTheaterState, countryId: string): number {
  const doctrine = theater.doctrineByCountry[countryId] ?? 'hold';
  if (doctrine === 'hold') return 1.16;
  if (doctrine === 'withdraw') return 0.9;
  if (doctrine === 'attack') return 0.92;
  return 1;
}

function contextRoll(atk: number, def: number): number {
  const ratio = atk / Math.max(1, def);
  const bias = Math.tanh((ratio - 1) * 1.35) * 0.4;
  const drama = (Math.random() + Math.random() + Math.random()) / 3;
  return Math.max(0.05, Math.min(0.95, drama + bias));
}

function computeBattlePowers(
  state: GameState,
  theater: WarTheaterState,
  hexDef: TheaterHexDef,
  attackerId: string,
  fromHexId: string
): { atkPower: number; defPower: number; defenderId: string; breakdown: string[] } | null {
  const target = theater.hexes[hexDef.id];
  const from = theater.hexes[fromHexId];
  if (!target || !from?.stack || from.stack.countryId !== attackerId) return null;

  const defenderId = target.stack?.countryId ?? target.ownerId;
  const attacker = state.countries[attackerId];
  const defender = state.countries[defenderId];
  if (!attacker || !defender) return null;

  const breakdown: string[] = [];
  const atkTags = from.stack.tags;
  const defTags = target.stack?.tags ?? [];

  let atkPower = from.stack.strength * W.stack;
  breakdown.push(`ATK stack ${Math.round(from.stack.strength)}`);
  atkPower *= 1 + attacker.militaryDev.troopQuality * 0.07;
  atkPower *= doctrineAtkMult(theater, attackerId);
  if (theater.doctrineByCountry[attackerId] === 'attack') breakdown.push('doctrine: attack');

  if (atkTags.includes('armor')) {
    const armorBonus = hexDef.terrain === 'plains' || hexDef.terrain === 'urban' ? 1.22 : hexDef.terrain === 'forest' ? 1.05 : 1.12;
    atkPower *= armorBonus;
    breakdown.push(`armor ×${armorBonus.toFixed(2)}`);
  }
  if (atkTags.includes('artillery')) {
    const artyBonus = target.fortLevel > 0 || hexDef.isCity ? 1.2 : 1.1;
    atkPower *= artyBonus;
    breakdown.push(`artillery ×${artyBonus.toFixed(2)}`);
  }
  if (atkTags.includes('air') || atkTags.includes('drone')) {
    const airBonus = hexDef.isCity ? 1 + W.airDrone * 1.4 : 1 + W.airDrone;
    atkPower *= airBonus;
    breakdown.push(hexDef.isCity ? 'air/drone (city)' : 'air/drone');
  }

  const atkMorale = 1 + (attacker.stats.moraleBase - 0.5) * W.moraleExhaust * 2.2
    - attacker.stats.warExhaustion * W.moraleExhaust * 1.2;
  atkPower *= Math.max(0.65, atkMorale);
  atkPower *= supplyModifier(theater, attackerId);

  const defStr = target.stack?.strength ?? 8;
  let defPower = defStr * W.stack;
  breakdown.push(`DEF stack ${Math.round(defStr)}`);
  defPower *= 1 + defender.militaryDev.troopQuality * 0.07;
  defPower *= doctrineDefMult(theater, defenderId);
  if (theater.doctrineByCountry[defenderId] === 'hold') breakdown.push('doctrine: hold');

  const terrainBonus = TERRAIN_DEF_BONUS[hexDef.terrain] ?? 0;
  defPower *= 1 + terrainBonus * (W.terrain / 0.16) * 1.15;
  if (terrainBonus > 0) breakdown.push(`${hexDef.terrain} terrain`);

  const fortCity = target.fortLevel * 0.18 + (hexDef.isCity ? 0.22 : 0);
  defPower *= 1 + fortCity * (W.fortCity / 0.22);
  if (hexDef.isCity) breakdown.push('city defense');
  if (target.fortLevel > 0) breakdown.push(`fort ×${target.fortLevel}`);

  if (defTags.includes('armor') && (hexDef.terrain === 'plains' || hexDef.isCity)) {
    defPower *= 1.1;
    breakdown.push('def armor');
  }
  if (defTags.includes('air') || defTags.includes('drone')) {
    defPower *= 1 + W.airDrone * 0.75;
  }

  const defMorale = 1 + (defender.stats.moraleBase - 0.5) * W.moraleExhaust * 2.2
    - defender.stats.warExhaustion * W.moraleExhaust * 1.2;
  defPower *= Math.max(0.65, defMorale);
  defPower *= supplyModifier(theater, defenderId);

  return { atkPower, defPower, defenderId, breakdown };
}

function forecastCasualties(atkPower: number, defPower: number, atkStr: number, defStr: number): {
  estAtkLoss: number;
  estDefLoss: number;
} {
  const ratio = atkPower / Math.max(1, defPower);
  const winChance = Math.max(0.08, Math.min(0.92, 1 / (1 + Math.exp(-(ratio - 1) * 2.6))));
  const atkLoss = Math.max(2, Math.round(defStr * (0.18 + (1 - winChance) * 0.28)));
  const defLoss = Math.max(3, Math.round(atkStr * (0.16 + winChance * 0.32)));
  return {
    estAtkLoss: Math.min(atkStr - 1, atkLoss),
    estDefLoss: Math.min(defStr, defLoss),
  };
}

function labelFromRatio(ratio: number): HexBattlePreview['label'] {
  if (ratio >= 1.75) return 'Strongly favored';
  if (ratio >= 1.25) return 'Favored';
  if (ratio >= 0.85) return 'Even';
  if (ratio >= 0.6) return 'Uphill';
  return 'Long shot';
}

export function previewHexBattle(
  state: GameState,
  theaterId: string,
  fromHexId: string,
  toHexId: string
): HexBattlePreview | null {
  const theater = getTheater(state, theaterId);
  const def = theater ? getTheaterDef(theater.defId) : undefined;
  const hexDef = def?.hexes.find(h => h.id === toHexId);
  if (!theater || !hexDef) return null;

  const powers = computeBattlePowers(state, theater, hexDef, state.playerCountryId, fromHexId);
  if (!powers) return null;

  const from = theater.hexes[fromHexId];
  const to = theater.hexes[toHexId];
  const atkStr = from?.stack?.strength ?? 10;
  const defStr = to?.stack?.strength ?? 8;
  const ratio = powers.atkPower / Math.max(1, powers.defPower);
  const winChance = Math.max(0.08, Math.min(0.92, 1 / (1 + Math.exp(-(ratio - 1) * 2.6))));
  const losses = forecastCasualties(powers.atkPower, powers.defPower, atkStr, defStr);

  return {
    atkPower: powers.atkPower,
    defPower: powers.defPower,
    ratio,
    winChance,
    label: labelFromRatio(ratio),
    breakdown: powers.breakdown,
    estAtkLoss: losses.estAtkLoss,
    estDefLoss: losses.estDefLoss,
  };
}

function pushCombatLog(theater: WarTheaterState, line: string): void {
  theater.combatLog = [line, ...(theater.combatLog ?? [])].slice(0, 8);
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

  const powers = computeBattlePowers(state, theater, hexDef, attackerId, fromHexId);
  if (!powers) return 'Invalid belligerent.';

  const { atkPower: atkBase, defPower: defBase, defenderId } = powers;
  const attacker = state.countries[attackerId]!;
  const defender = state.countries[defenderId]!;

  const roll = contextRoll(atkBase, defBase);
  const atkScore = atkBase * (0.55 + roll * 0.9);
  const defScore = defBase * (0.55 + (1 - roll) * 0.9);

  const margin = atkScore / Math.max(1, defScore);
  const atkLoss = Math.max(2, Math.round(defBase * (0.1 + (margin < 1 ? 0.14 : 0.06))));
  const defLoss = Math.max(3, Math.round(atkBase * (0.1 + (margin > 1 ? 0.16 : 0.07))));

  from.stack.strength = Math.max(0, from.stack.strength - atkLoss);
  if (target.stack) {
    target.stack.strength = Math.max(0, target.stack.strength - defLoss);
  }

  attacker.stats.warExhaustion = Math.min(1, attacker.stats.warExhaustion + atkLoss * 0.0018);
  defender.stats.warExhaustion = Math.min(1, defender.stats.warExhaustion + defLoss * 0.0022);

  const ratio = atkBase / Math.max(1, defBase);
  const place = hexDef.cityName ? ` ${hexDef.cityName}` : ' the hex';
  let result: string;

  if (margin >= 1.45) {
    // Decisive breakthrough
    target.ownerId = attackerId;
    target.contested = false;
    const survivors = Math.max(8, Math.floor(from.stack.strength * 0.72));
    target.stack = makeStack(
      attackerId,
      survivors,
      from.stack.tags,
      hexDef.facilityHint ? [hexDef.facilityHint] : []
    );
    from.stack.strength = Math.max(3, Math.floor(from.stack.strength * 0.35));
    if (target.fortLevel > 0) target.fortLevel = Math.max(0, target.fortLevel - 1);
    result = `Breakthrough — ${attacker.name} smashes through${place} (${labelFromRatio(ratio)}, ${Math.round(atkScore)}–${Math.round(defScore)}).`;
    if (hexDef.isCity) {
      defender.stats.warExhaustion = Math.min(1, defender.stats.warExhaustion + 0.05);
      defender.stats.moraleBase = Math.max(0.1, defender.stats.moraleBase - 0.04);
      attacker.stats.moraleBase = Math.min(0.95, attacker.stats.moraleBase + 0.02);
      state.history.push(`Turn ${state.turn}: ${attacker.name} decisively seizes ${hexDef.cityName} in ${theater.name}.`);
      checkCapitalCollapseRisk(state, theater, hexDef, defenderId);
    }
    checkRegionCapture(state, theater, hexDef.regionId, attackerId);
  } else if (margin >= 1.05) {
    // Clear take
    target.ownerId = attackerId;
    target.contested = false;
    target.stack = makeStack(
      attackerId,
      Math.max(6, Math.floor(from.stack.strength * 0.55)),
      from.stack.tags,
      hexDef.facilityHint ? [hexDef.facilityHint] : []
    );
    from.stack.strength = Math.max(4, Math.floor(from.stack.strength * 0.4));
    result = `${attacker.name} takes${place} (${labelFromRatio(ratio)}, ${Math.round(atkScore)}–${Math.round(defScore)}).`;
    if (hexDef.isCity) {
      defender.stats.warExhaustion = Math.min(1, defender.stats.warExhaustion + 0.035);
      defender.stats.moraleBase = Math.max(0.1, defender.stats.moraleBase - 0.025);
      attacker.stats.moraleBase = Math.min(0.95, attacker.stats.moraleBase + 0.012);
      state.history.push(`Turn ${state.turn}: ${attacker.name} seizes ${hexDef.cityName} in ${theater.name}.`);
      checkCapitalCollapseRisk(state, theater, hexDef, defenderId);
    }
    checkRegionCapture(state, theater, hexDef.regionId, attackerId);
  } else if (margin >= 0.85) {
    // Bloody stalemate — contested, both mauled
    target.contested = true;
    if (target.stack && target.stack.strength <= 0) {
      target.stack = makeStack(defenderId, 5, ['infantry'], []);
    }
    if (from.stack.strength <= 0) from.stack = null;
    result = `Bloody stalemate at${place} — no breakthrough (${labelFromRatio(ratio)}, ${Math.round(atkScore)}–${Math.round(defScore)}).`;
  } else if (margin >= 0.65) {
    // Repulse
    target.contested = true;
    if (target.stack && target.stack.strength <= 0) {
      target.stack = makeStack(defenderId, 6, ['infantry'], []);
    }
    if (from.stack.strength <= 0) from.stack = null;
    result = `${defender.name} repulses the assault on${place} (${labelFromRatio(ratio)}, ${Math.round(atkScore)}–${Math.round(defScore)}).`;
  } else {
    // Rout — attacker shattered
    target.contested = false;
    if (from.stack.strength <= 4) {
      from.stack = null;
      result = `Rout — ${attacker.name} shattered before${place} (${labelFromRatio(ratio)}, ${Math.round(atkScore)}–${Math.round(defScore)}).`;
    } else {
      from.stack.strength = Math.max(3, Math.floor(from.stack.strength * 0.55));
      result = `Crushing repulse at${place} — ${attacker.name} recoils (${labelFromRatio(ratio)}, ${Math.round(atkScore)}–${Math.round(defScore)}).`;
    }
    if (target.stack && target.stack.strength <= 0) {
      target.stack = makeStack(defenderId, 7, ['infantry'], []);
    }
  }

  pushCombatLog(theater, `T${state.turn}: ${result}`);
  state.history.push(`Turn ${state.turn}: ${theater.name} — ${result}`);
  target.revealedUntilTurn = state.turn + 1;
  return result;
}

function checkCapitalCollapseRisk(
  state: GameState,
  theater: WarTheaterState,
  hexDef: TheaterHexDef,
  defenderId: string
): void {
  // Alpha: Kyiv (or any capital-tagged city) loss feeds collapse telegraphs + hard risk event line
  const isCapital = hexDef.cityName === 'Kyiv' || hexDef.facilityHint === 'capital';
  if (!isCapital) return;
  const defender = state.countries[defenderId];
  if (!defender) return;
  defender.stats.moraleBase = Math.max(0.08, defender.stats.moraleBase - 0.08);
  defender.stats.regimeSecurity = Math.max(0.1, defender.stats.regimeSecurity - 0.1);
  if (!state.collapseTelegraphedNations.includes(defenderId)) {
    state.collapseTelegraphedNations.push(defenderId);
  }
  state.history.push(
    `Turn ${state.turn}: COLLAPSE RISK — ${defender.name} capital falls in ${theater.name}; regime telegraphs soar.`
  );
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

  const doctrine = theater.doctrineByCountry[countryId] ?? 'hold';
  if (doctrine === 'hold') return;

  const pairs = enemyHexTargets(theater, def, countryId);
  if (pairs.length === 0) return;

  const attacks = doctrine === 'attack' ? Math.min(3, pairs.length) : Math.min(1, pairs.length);
  pairs.sort((a, b) => {
    const score = (p: typeof a) => {
      const previewRatio = (() => {
        const powers = computeBattlePowers(state, theater, p.to, countryId, p.from.id);
        if (!powers) return 1;
        return powers.atkPower / Math.max(1, powers.defPower);
      })();
      return (p.to.isCity ? 5 : 0) + (theater.hexes[p.to.id]?.contested ? 2 : 0) + previewRatio * 3;
    };
    return score(b) - score(a);
  });

  for (let i = 0; i < attacks; i++) {
    const { from, to } = pairs[i];
    if (doctrine === 'withdraw') {
      const rt = theater.hexes[from.id];
      if (rt?.stack && rt.stack.strength > 10) {
        rt.stack.strength = Math.max(6, Math.floor(rt.stack.strength * 0.85));
      }
      continue;
    }
    // Prefer favourable attacks; still press cities when attack doctrine
    const powers = computeBattlePowers(state, theater, to, countryId, from.id);
    const ratio = powers ? powers.atkPower / Math.max(1, powers.defPower) : 1;
    if (ratio < 0.85 && !to.isCity) continue;
    resolveHexBattle(state, theater, to, countryId, from.id);
  }
}

/** One operational impulse for all actors on a theater */
export function resolveTheaterImpulse(state: GameState, theaterId: string): void {
  const theater = getTheater(state, theaterId);
  if (!theater || theater.closed || theater.pendingFate) return;

  theater.playerDoctrineAi ??= true;
  theater.combatLog ??= [];

  const war = state.wars.find(w => w.id === theater.warId);
  const actors = new Set<string>([
    ...(war?.belligerents ?? []),
    ...Object.values(theater.hexes)
      .map(h => h.stack?.countryId)
      .filter((id): id is string => !!id),
  ]);

  for (const countryId of actors) {
    const isPlayer = countryId === state.playerCountryId;
    if (isPlayer && !theater.playerDoctrineAi) continue;
    runDoctrineImpulse(state, theater, countryId);
  }

  theater.impulsesThisWorldTurn += 1;
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

  const war = state.wars.find(w => w.id === theater.warId);
  state.history.push(
    `Turn ${state.turn}: ${state.countries[state.playerCountryId]?.name} deploys expeditionary forces into ${theater.name} in support of ${state.countries[supportCountryId]?.name}.`
  );

  if (war && !war.belligerents.includes(state.playerCountryId)) {
    bumpInterventionMeter(state, war.id, INTERVENTION_PER_DEPLOY);
  }

  return 'Expeditionary detachment deployed.';
}

export function getInterventionMeter(state: GameState, warId: string): number {
  return state.interventionMeters?.[warId] ?? 0;
}

function bumpInterventionMeter(state: GameState, warId: string, amount: number): void {
  state.interventionMeters ??= {};
  const next = Math.min(INTERVENTION_THRESHOLD, (state.interventionMeters[warId] ?? 0) + amount);
  state.interventionMeters[warId] = next;
  state.history.push(
    `Turn ${state.turn}: Intervention meter ${Math.round(next)}/${INTERVENTION_THRESHOLD} for this war.`
  );
  if (next >= INTERVENTION_THRESHOLD) {
    const war = state.wars.find(w => w.id === warId);
    if (war && !war.belligerents.includes(state.playerCountryId)) {
      // Soft pull-in at threshold — join as co-belligerent
      war.belligerents.push(state.playerCountryId);
      war.isDefensive[state.playerCountryId] = false;
      state.interventionMeters[warId] = 0;
      state.history.push(
        `Turn ${state.turn}: Intervention threshold reached — ${state.countries[state.playerCountryId]?.name} is pulled into the war.`
      );
    }
  }
}

export type TheaterAidPackage = 'reinforce' | 'weapons_armor' | 'weapons_drone';

/** Aid stub — reinforce recipient stacks and/or unlock weapon tags */
export function playerSendTheaterAid(
  state: GameState,
  theaterId: string,
  recipientId: string,
  pkg: TheaterAidPackage
): string | null {
  const theater = getTheater(state, theaterId);
  if (!theater || theater.closed) return 'Theater not found.';

  const cost = pkg === 'reinforce' ? AID_REINFORCE_COST : AID_REINFORCE_COST + 2;
  if (!playerCanPay(state, cost)) return 'Insufficient treasury for aid package.';
  playerPay(state, cost);

  const friendly = Object.entries(theater.hexes).filter(
    ([, rt]) => rt.ownerId === recipientId || rt.stack?.countryId === recipientId
  );
  if (friendly.length === 0) return 'No recipient hexes to aid.';

  friendly.sort((a, b) => (b[1].stack?.strength ?? 0) - (a[1].stack?.strength ?? 0));
  const targets = friendly.slice(0, pkg === 'reinforce' ? 3 : 2);

  for (const [, rt] of targets) {
    if (!rt.stack) {
      rt.stack = makeStack(recipientId, 8, ['infantry'], ['aid']);
    } else {
      if (pkg === 'reinforce') rt.stack.strength += 8;
      if (pkg === 'weapons_armor' && !rt.stack.tags.includes('armor')) rt.stack.tags.push('armor');
      if (pkg === 'weapons_drone' && !rt.stack.tags.includes('drone')) rt.stack.tags.push('drone');
      if (pkg !== 'reinforce') rt.stack.strength += 4;
      rt.stack.specialists.push(`aid_${pkg}`);
    }
  }

  const labels: Record<TheaterAidPackage, string> = {
    reinforce: 'reinforcement convoy',
    weapons_armor: 'armor package',
    weapons_drone: 'drone package',
  };
  state.history.push(
    `Turn ${state.turn}: ${state.countries[state.playerCountryId]?.name} sends ${labels[pkg]} to ${state.countries[recipientId]?.name} in ${theater.name}.`
  );
  return `Aid delivered: ${labels[pkg]} (−${cost} TP).`;
}

export function setPlayerDoctrineAi(state: GameState, theaterId: string, enabled: boolean): void {
  const theater = getTheater(state, theaterId);
  if (!theater) return;
  theater.playerDoctrineAi = enabled;
}

export function dismissTheaterNotice(state: GameState, theaterId: string): void {
  state.pendingTheaterNotices = (state.pendingTheaterNotices ?? []).filter(id => id !== theaterId);
}

export function acknowledgeAllTheaterNotices(state: GameState): void {
  state.pendingTheaterNotices = [];
}

export function getTheaterForWar(state: GameState, warId: string): WarTheaterState | undefined {
  return getActiveTheaters(state).find(t => t.warId === warId);
}

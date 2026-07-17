import type { GameState, WarTheaterState } from '../types/game';
import { axialNeighbors, getTheaterDef, hexesForRegion, type TheaterDef, type TheaterHexDef } from '../data/theaterDefs';
import { getActiveTheaters, getTheater, makeStack } from './warTheaterCore';
import { resolveRegionFate } from './warTheaterLifecycle';

/** Hex battle math, resolution, and the per-turn doctrine-AI impulse. */

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

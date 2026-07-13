import type { GameState, Country } from '../types/game';
import { REGIONS } from '../data/regions';
import { getHemisphereForCountry } from '../data/hemispheres';

export type StrikeType = 'drone' | 'cruise' | 'ballistic' | 'icbm';
export type StrikeRange = 'adjacent' | 'regional' | 'theatre' | 'intercontinental';

export interface StrikeOption {
  type: StrikeType;
  label: string;
  description: string;
  cost: number;
  power: number;
  energyCost: number;
  available: boolean;
  blockReason?: string;
}

const COUNTRY_ADJACENCY = buildCountryAdjacency();

function buildCountryAdjacency(): Map<string, Set<string>> {
  const adj = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    if (a === b) return;
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a)!.add(b);
    adj.get(b)!.add(a);
  };
  for (const region of Object.values(REGIONS)) {
    for (const nid of region.neighbours) {
      const neighbour = REGIONS[nid];
      if (neighbour) link(region.countryId, neighbour.countryId);
    }
  }
  return adj;
}

function getCountryDistance(fromCountryId: string, toCountryId: string): number {
  if (fromCountryId === toCountryId) return 0;
  const visited = new Set<string>([fromCountryId]);
  const queue: Array<{ id: string; dist: number }> = [{ id: fromCountryId, dist: 0 }];
  while (queue.length > 0) {
    const { id, dist } = queue.shift()!;
    const neighbours = COUNTRY_ADJACENCY.get(id);
    if (!neighbours) continue;
    for (const n of neighbours) {
      if (n === toCountryId) return dist + 1;
      if (!visited.has(n)) {
        visited.add(n);
        queue.push({ id: n, dist: dist + 1 });
      }
    }
  }
  return 99;
}

export function getStrikeRange(
  state: GameState,
  attackerId: string,
  targetRegionId: string
): StrikeRange {
  const region = state.regions[targetRegionId];
  if (!region) return 'intercontinental';

  const targetCountryId = region.controlledBy;
  const distance = getCountryDistance(attackerId, targetCountryId);
  const sameHemisphere =
    getHemisphereForCountry(attackerId) === getHemisphereForCountry(targetCountryId);

  if (distance <= 1) return 'adjacent';
  if (distance === 2) return 'regional';
  if (sameHemisphere) return 'theatre';
  return 'intercontinental';
}

const RANGE_ORDER: StrikeRange[] = ['adjacent', 'regional', 'theatre', 'intercontinental'];

function rangeIndex(r: StrikeRange): number {
  return RANGE_ORDER.indexOf(r);
}

const STRIKE_DEFS: Record<
  StrikeType,
  {
    label: string;
    description: string;
    baseCost: number;
    basePower: number;
    energyCost: number;
    minRange: StrikeRange;
    maxRange: StrikeRange;
    minStrikeCap?: number;
  }
> = {
  drone: {
    label: 'Loitering Drone Strike',
    description: 'Cheap precision strike — best for nearby targets.',
    baseCost: 8,
    basePower: 2,
    energyCost: 1,
    minRange: 'adjacent',
    maxRange: 'regional',
  },
  cruise: {
    label: 'Cruise Missile (Tomahawk-class)',
    description: 'Long-range conventional missile — moderate cost and damage.',
    baseCost: 28,
    basePower: 4,
    energyCost: 1,
    minRange: 'adjacent',
    maxRange: 'theatre',
  },
  ballistic: {
    label: 'Ballistic Missile Strike',
    description: 'Heavy theatre-range strike — breaks hardened targets.',
    baseCost: 52,
    basePower: 6.5,
    energyCost: 2,
    minRange: 'regional',
    maxRange: 'intercontinental',
    minStrikeCap: 3,
  },
  icbm: {
    label: 'ICBM Strike',
    description: 'Intercontinental strike — devastating, ruinously expensive.',
    baseCost: 95,
    basePower: 9,
    energyCost: 2,
    minRange: 'theatre',
    maxRange: 'intercontinental',
    minStrikeCap: 4,
  },
};

function isRangeInBand(
  range: StrikeRange,
  minRange: StrikeRange,
  maxRange: StrikeRange
): boolean {
  const idx = rangeIndex(range);
  return idx >= rangeIndex(minRange) && idx <= rangeIndex(maxRange);
}

export function getStrikeOptions(
  state: GameState,
  attackerId: string,
  targetRegionId: string
): StrikeOption[] {
  const attacker = state.countries[attackerId] as Country | undefined;
  const range = getStrikeRange(state, attackerId, targetRegionId);
  const strikeCap = attacker?.militaryDev.strikeCapability ?? 1;
  const droneLvl = attacker?.militaryDev.droneProgram ?? 1;
  const tech = attacker?.stats.techLevel ?? 0.5;

  return (Object.keys(STRIKE_DEFS) as StrikeType[]).map(type => {
    const def = STRIKE_DEFS[type];
    let available = isRangeInBand(range, def.minRange, def.maxRange);
    let blockReason: string | undefined;

    if (def.minStrikeCap && strikeCap < def.minStrikeCap) {
      available = false;
      blockReason = `Requires strike capability ${def.minStrikeCap}+ (yours: ${strikeCap}).`;
    }

    if (type === 'drone' && droneLvl < 2) {
      available = false;
      blockReason = 'Requires drone program level 2+.';
    }

    if (!isRangeInBand(range, def.minRange, def.maxRange)) {
      available = false;
      const rangeLabels: Record<StrikeRange, string> = {
        adjacent: 'bordering',
        regional: 'nearby theatre',
        theatre: 'same hemisphere',
        intercontinental: 'intercontinental',
      };
      blockReason = `Out of range (${rangeLabels[range]} — needs ${rangeLabels[def.minRange]} to ${rangeLabels[def.maxRange]}).`;
    }

    const capDiscount = (5 - strikeCap) * (type === 'drone' ? 1.5 : 3);
    const cost = Math.round(def.baseCost + capDiscount);

    const power =
      def.basePower +
      strikeCap * 0.4 +
      (type === 'drone' ? droneLvl * 0.35 : 0) +
      tech * 1.5;

    return {
      type,
      label: def.label,
      description: def.description,
      cost,
      power,
      energyCost: def.energyCost,
      available,
      blockReason,
    };
  });
}

export function computeStrikePower(attacker: Country, type: StrikeType, basePower: number): number {
  return (
    basePower +
    attacker.militaryDev.strikeCapability * 0.3 +
    (type === 'drone' ? attacker.militaryDev.droneProgram * 0.2 : 0)
  );
}

export function getStrikeRangeLabel(range: StrikeRange): string {
  const labels: Record<StrikeRange, string> = {
    adjacent: 'Bordering',
    regional: 'Regional',
    theatre: 'Theatre',
    intercontinental: 'Intercontinental',
  };
  return labels[range];
}

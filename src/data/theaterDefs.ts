import type { HexTerrain } from '../types/game';

/** Static hex definition for a war theater board */
export interface TheaterHexDef {
  id: string;
  q: number;
  r: number;
  regionId: string;
  terrain: HexTerrain;
  isCity: boolean;
  cityName?: string;
  /** Shown when viewer has intel on the hex */
  facilityHint?: string;
}

export interface TheaterDef {
  id: string;
  name: string;
  /** Nation ids that seed the theater board (belligerents when war matches) */
  primaryBelligerents: [string, string];
  regionIds: string[];
  hexes: TheaterHexDef[];
}

const AXIAL_DIRS: Array<[number, number]> = [
  [1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1],
];

export function axialKey(q: number, r: number): string {
  return `${q},${r}`;
}

export function axialNeighbors(q: number, r: number): Array<[number, number]> {
  return AXIAL_DIRS.map(([dq, dr]) => [q + dq, r + dr]);
}

function hashTerrain(q: number, r: number, regionId: string): HexTerrain {
  const n = Math.abs((q * 73856093) ^ (r * 19349663) ^ regionId.length * 83492791);
  if (regionId.includes('kyiv') || regionId.endsWith('_east')) {
    if (n % 7 === 0) return 'urban';
    if (n % 5 === 0) return 'fort';
  }
  if (regionId.includes('south') || regionId.includes('crimea')) {
    if (n % 6 === 0) return 'river';
  }
  if (n % 8 === 0) return 'forest';
  if (n % 11 === 0) return 'river';
  if (n % 13 === 0) return 'fort';
  if (n % 9 === 0) return 'urban';
  return 'plains';
}

/** Assign parent region from axial coords (priority: specific cities/bands first). */
function paintRegion(q: number, r: number): string | null {
  if (q >= -3 && q <= -1 && r >= -3 && r <= -1) return 'ukr_kyiv';
  if (q >= -2 && q <= 2 && r >= -8 && r <= -5) return 'rus_west';
  if (q >= 3 && q <= 7 && r >= -7 && r <= -4) return 'rus_south';
  if (q >= 4 && q <= 8 && r >= -2 && r <= 1) return 'rus_crimea';
  if (q >= -5 && q <= -1 && r >= -6 && r <= -4) return 'ukr_north';
  if (q >= -6 && q <= -3 && r >= -3 && r <= 0) return 'ukr_west';
  if (q >= 2 && q <= 6 && r >= -4 && r <= 0) return 'ukr_east';
  if (q >= 0 && q <= 4 && r >= 1 && r <= 4) return 'ukr_south';
  if (q >= -2 && q <= 2 && r >= -4 && r <= 1) return 'ukr_central';
  return null;
}

/**
 * Dense operational board (~100–120 hexes) nested under existing regions.
 * Axial layout is operational, not a geo projection.
 */
function buildUkraineHexBoard(): TheaterHexDef[] {
  const hexes: TheaterHexDef[] = [];

  for (let q = -6; q <= 8; q++) {
    for (let r = -8; r <= 4; r++) {
      const regionId = paintRegion(q, r);
      if (!regionId) continue;
      hexes.push({
        id: `th_ua_${q}_${r}`,
        q,
        r,
        regionId,
        terrain: hashTerrain(q, r, regionId),
        isCity: false,
      });
    }
  }

  const cities: Array<{ q: number; r: number; name: string; regionId: string; facility?: string }> = [
    { q: -2, r: -2, name: 'Kyiv', regionId: 'ukr_kyiv', facility: 'arms_plant' },
    { q: 4, r: -3, name: 'Kharkiv', regionId: 'ukr_east', facility: 'arms_plant' },
    { q: 3, r: -2, name: 'Donetsk', regionId: 'ukr_east' },
    { q: 2, r: 2, name: 'Odesa', regionId: 'ukr_south', facility: 'oil_gas' },
    { q: 5, r: 0, name: 'Sevastopol', regionId: 'rus_crimea', facility: 'missile_defense' },
    { q: -4, r: -2, name: 'Lviv', regionId: 'ukr_west' },
    { q: 0, r: -1, name: 'Dnipro', regionId: 'ukr_central', facility: 'drone_factory' },
    { q: 1, r: -5, name: 'Belgorod', regionId: 'rus_west' },
    { q: 5, r: -5, name: 'Rostov', regionId: 'rus_south' },
  ];

  for (const c of cities) {
    let hex = hexes.find(h => h.q === c.q && h.r === c.r);
    if (!hex) {
      hex = {
        id: `th_ua_${c.q}_${c.r}`,
        q: c.q,
        r: c.r,
        regionId: c.regionId,
        terrain: 'urban',
        isCity: true,
        cityName: c.name,
        facilityHint: c.facility,
      };
      hexes.push(hex);
    } else {
      hex.isCity = true;
      hex.cityName = c.name;
      hex.regionId = c.regionId;
      hex.terrain = 'urban';
      hex.facilityHint = c.facility;
    }
  }

  return hexes;
}

const UKRAINE_HEXES = buildUkraineHexBoard();

export const THEATER_DEFS: Record<string, TheaterDef> = {
  ukraine_front: {
    id: 'ukraine_front',
    name: 'Ukraine Theater',
    primaryBelligerents: ['russia', 'ukraine'],
    regionIds: [
      'ukr_west', 'ukr_central', 'ukr_east', 'ukr_south', 'ukr_north', 'ukr_kyiv',
      'rus_west', 'rus_south', 'rus_crimea',
    ],
    hexes: UKRAINE_HEXES,
  },
};

export function getTheaterDef(defId: string): TheaterDef | undefined {
  return THEATER_DEFS[defId];
}

export function findTheaterDefForWar(belligerents: string[]): TheaterDef | undefined {
  return Object.values(THEATER_DEFS).find(def =>
    def.primaryBelligerents.every(id => belligerents.includes(id))
  );
}

export function getHexDef(theaterDefId: string, hexId: string): TheaterHexDef | undefined {
  return THEATER_DEFS[theaterDefId]?.hexes.find(h => h.id === hexId);
}

export function hexesForRegion(theaterDefId: string, regionId: string): TheaterHexDef[] {
  return (THEATER_DEFS[theaterDefId]?.hexes ?? []).filter(h => h.regionId === regionId);
}

/** Flat-top hex pixel center */
export function hexToPixel(q: number, r: number, size: number): [number, number] {
  const x = size * (3 / 2) * q;
  const y = size * (Math.sqrt(3) / 2 * q + Math.sqrt(3) * r);
  return [x, y];
}

export function hexPolygonPoints(cx: number, cy: number, size: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 6; i++) {
    const angle = (Math.PI / 180) * (60 * i);
    pts.push(`${cx + size * Math.cos(angle)},${cy + size * Math.sin(angle)}`);
  }
  return pts.join(' ');
}

export const HEX_TERRAIN_LABELS: Record<HexTerrain, string> = {
  urban: 'Urban',
  plains: 'Plains',
  forest: 'Forest',
  river: 'River',
  fort: 'Fortified',
};

/**
 * Generate accurate world-map SVG silhouettes from world-atlas (Natural Earth 110m).
 * Run: npx tsx scripts/geo/generate-coastlines.ts
 */
import fs from 'fs';
import path from 'path';
import { feature } from 'topojson-client';
import type { Topology, GeometryCollection } from 'topojson-specification';
import type { Feature, MultiPolygon, Polygon, Position } from 'geojson';

const W = 1200;
const H = 520;
const LON_MIN = -180;
const LON_MAX = 190;
const LAT_MIN = -56;
const LAT_MAX = 78;

/** Keep only mainland / regional polygons for countries with overseas scraps. */
const CORE_BOX: Record<string, { lon: [number, number]; lat: [number, number] }> = {
  usa: { lon: [-170, -66], lat: [18, 72] },
  france: { lon: [-6, 10], lat: [41, 52] },
  netherlands: { lon: [3, 8], lat: [50, 54] },
  england: { lon: [-9, 2], lat: [49, 61] },
  spain: { lon: [-10, 5], lat: [35, 44] },
  portugal: { lon: [-10, -6], lat: [36, 43] },
  denmark: { lon: [7, 16], lat: [54, 58] },
  norway: { lon: [4, 32], lat: [57, 72] },
  russia: { lon: [19, 190], lat: [41, 82] },
};

/** ISO 3166-1 numeric → game country id */
const ISO_TO_ID: Record<string, string> = {
  '840': 'usa',
  '124': 'canada',
  '484': 'mexico',
  '192': 'cuba',
  '170': 'colombia',
  '862': 'venezuela',
  '076': 'brazil',
  '032': 'argentina',
  '152': 'chile',
  '604': 'peru',
  '218': 'ecuador',
  '068': 'bolivia',
  '858': 'uruguay',
  '600': 'paraguay',
  '826': 'england',
  '250': 'france',
  '276': 'germany',
  '724': 'spain',
  '380': 'italy',
  '616': 'poland',
  '752': 'sweden',
  '528': 'netherlands',
  '056': 'belgium',
  '620': 'portugal',
  '578': 'norway',
  '246': 'finland',
  '040': 'austria',
  '300': 'greece',
  '642': 'romania',
  '203': 'czechia',
  '372': 'ireland',
  '208': 'denmark',
  '756': 'switzerland',
  '112': 'belarus',
  '643': 'russia',
  '804': 'ukraine',
  '792': 'turkey',
  '376': 'israel',
  '818': 'egypt',
  '012': 'algeria',
  '504': 'morocco',
  '434': 'libya',
  '566': 'nigeria',
  '231': 'ethiopia',
  '710': 'south_africa',
  '404': 'kenya',
  '288': 'ghana',
  '024': 'angola',
  '834': 'tanzania',
  '180': 'drc',
  '682': 'saudi_arabia',
  '368': 'iraq',
  '784': 'uae',
  '364': 'iran',
  '760': 'syria',
  '400': 'jordan',
  '586': 'pakistan',
  '356': 'india',
  '050': 'bangladesh',
  '004': 'afghanistan',
  '398': 'kazakhstan',
  '860': 'uzbekistan',
  '156': 'china',
  '704': 'vietnam',
  '608': 'philippines',
  '360': 'indonesia',
  '458': 'malaysia',
  '764': 'thailand',
  '104': 'myanmar',
  '496': 'mongolia',
  '158': 'taiwan',
  '408': 'north_korea',
  '410': 'south_korea',
  '392': 'japan',
  '036': 'australia',
  '554': 'new_zealand',
};

const LAND_NEIGHBORS: Array<[string, string]> = [
  ['canada', 'usa'],
  ['usa', 'mexico'],
  ['colombia', 'venezuela'],
  ['venezuela', 'brazil'],
  ['brazil', 'argentina'],
  ['brazil', 'bolivia'],
  ['brazil', 'peru'],
  ['brazil', 'paraguay'],
  ['chile', 'argentina'],
  ['chile', 'peru'],
  ['peru', 'ecuador'],
  ['peru', 'bolivia'],
  ['bolivia', 'paraguay'],
  ['argentina', 'uruguay'],
  ['argentina', 'paraguay'],
  ['spain', 'france'],
  ['spain', 'portugal'],
  ['england', 'france'],
  ['france', 'germany'],
  ['france', 'italy'],
  ['france', 'belgium'],
  ['france', 'switzerland'],
  ['germany', 'poland'],
  ['germany', 'netherlands'],
  ['germany', 'belgium'],
  ['germany', 'austria'],
  ['germany', 'switzerland'],
  ['germany', 'czechia'],
  ['germany', 'denmark'],
  ['poland', 'ukraine'],
  ['poland', 'czechia'],
  ['poland', 'belarus'],
  ['ukraine', 'russia'],
  ['ukraine', 'belarus'],
  ['ukraine', 'romania'],
  ['russia', 'kazakhstan'],
  ['russia', 'china'],
  ['russia', 'finland'],
  ['russia', 'belarus'],
  ['russia', 'mongolia'],
  ['iraq', 'saudi_arabia'],
  ['iraq', 'iran'],
  ['iraq', 'syria'],
  ['iraq', 'jordan'],
  ['iran', 'saudi_arabia'],
  ['iran', 'pakistan'],
  ['iran', 'afghanistan'],
  ['pakistan', 'india'],
  ['pakistan', 'afghanistan'],
  ['india', 'bangladesh'],
  ['india', 'china'],
  ['saudi_arabia', 'uae'],
  ['saudi_arabia', 'jordan'],
  ['turkey', 'iraq'],
  ['turkey', 'syria'],
  ['turkey', 'iran'],
  ['syria', 'jordan'],
  ['syria', 'israel'],
  ['china', 'north_korea'],
  ['china', 'vietnam'],
  ['china', 'mongolia'],
  ['china', 'myanmar'],
  ['china', 'kazakhstan'],
  ['north_korea', 'south_korea'],
  ['thailand', 'myanmar'],
  ['thailand', 'malaysia'],
  ['malaysia', 'indonesia'],
  ['morocco', 'algeria'],
  ['algeria', 'libya'],
  ['libya', 'egypt'],
  ['kenya', 'tanzania'],
  ['kenya', 'ethiopia'],
  ['drc', 'angola'],
  ['drc', 'tanzania'],
  ['uzbekistan', 'kazakhstan'],
  ['netherlands', 'belgium'],
  ['austria', 'czechia'],
  ['austria', 'switzerland'],
  ['sweden', 'norway'],
  ['finland', 'norway'],
  ['finland', 'sweden'],
  ['colombia', 'peru'],
  ['colombia', 'brazil'],
  ['brazil', 'chile'],
  ['vietnam', 'thailand'],
  ['india', 'myanmar'],
  ['india', 'afghanistan'],
  ['china', 'pakistan'],
  ['china', 'japan'],
];

function round(n: number): number {
  return Math.round(n * 10) / 10;
}

function project(lon: number, lat: number): [number, number] {
  let x = ((lon - LON_MIN) / (LON_MAX - LON_MIN)) * W;
  let y = ((LAT_MAX - lat) / (LAT_MAX - LAT_MIN)) * H;
  x = Math.min(W, Math.max(0, x));
  y = Math.min(H, Math.max(0, y));
  return [round(x), round(y)];
}

function ringCentroidLonLat(ring: Position[]): [number, number] {
  let lon = 0;
  let lat = 0;
  const n = Math.max(1, ring.length - 1);
  for (let i = 0; i < n; i++) {
    lon += ring[i][0];
    lat += ring[i][1];
  }
  return [lon / n, lat / n];
}

function inCore(id: string, lon: number, lat: number): boolean {
  const box = CORE_BOX[id];
  if (!box) return true;
  return lon >= box.lon[0] && lon <= box.lon[1] && lat >= box.lat[0] && lat <= box.lat[1];
}

function ringArea(ring: Array<[number, number]>): number {
  let a = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    a += ring[i][0] * ring[i + 1][1] - ring[i + 1][0] * ring[i][1];
  }
  return Math.abs(a / 2);
}

function centroid(ring: Array<[number, number]>): [number, number] {
  let x = 0;
  let y = 0;
  let n = 0;
  for (let i = 0; i < ring.length - 1; i++) {
    x += ring[i][0];
    y += ring[i][1];
    n++;
  }
  return [round(x / Math.max(1, n)), round(y / Math.max(1, n))];
}

function simplifyRing(raw: Array<[number, number]>, maxPts: number): Array<[number, number]> {
  // Drop closing duplicate
  let ring = raw.slice(0, -1);
  // Filter points that project outside a soft margin (keep most)
  ring = ring.filter(([x, y]) => x > -40 && x < W + 40 && y > -40 && y < H + 40);
  if (ring.length < 4) return raw.slice(0, -1);

  if (ring.length <= maxPts) return ring;

  // Even sample, always keep first
  const out: Array<[number, number]> = [];
  const step = (ring.length - 1) / (maxPts - 1);
  for (let i = 0; i < maxPts; i++) {
    out.push(ring[Math.min(ring.length - 1, Math.round(i * step))]);
  }
  return out;
}

function projectRing(coords: Position[]): Array<[number, number]> {
  return coords.map(([lon, lat]) => project(lon, lat));
}

function geometryToPath(
  id: string,
  geom: Polygon | MultiPolygon
): { path: string; label: [number, number] } | null {
  const polys: Position[][][] =
    geom.type === 'Polygon' ? [geom.coordinates] : geom.coordinates;

  const projected = polys
    .filter(poly => {
      const [lon, lat] = ringCentroidLonLat(poly[0]);
      return inCore(id, lon, lat);
    })
    .map(poly => {
      const outer = projectRing(poly[0]);
      const simplified = simplifyRing(outer, 80);
      return { pts: simplified, area: ringArea([...simplified, simplified[0]]) };
    })
    .filter(p => p.pts.length >= 3 && p.area > 4)
    .sort((a, b) => b.area - a.area);

  if (projected.length === 0) return null;

  const keep = projected.filter((p, i) => i === 0 || p.area > projected[0].area * 0.03).slice(0, 6);

  const path = keep
    .map(({ pts }) => `M ${pts.map(([x, y]) => `${x},${y}`).join(' L ')} Z`)
    .join(' ');

  const label = centroid(keep[0].pts);
  return { path, label };
}

function main() {
  const topoPath = path.resolve('scripts/geo/countries-110m.json');
  const topo = JSON.parse(fs.readFileSync(topoPath, 'utf8')) as Topology<{
    countries: GeometryCollection;
  }>;

  const collection = feature(topo, topo.objects.countries) as GeoJSON.FeatureCollection;
  const byIso = new Map<string, Feature>();
  for (const f of collection.features) {
    if (f.id != null) byIso.set(String(f.id).padStart(3, '0'), f);
  }

  const coasts: Record<string, { path: string; label: [number, number] }> = {};
  const missing: string[] = [];

  for (const [iso, id] of Object.entries(ISO_TO_ID)) {
    const f = byIso.get(iso);
    if (!f || !f.geometry || (f.geometry.type !== 'Polygon' && f.geometry.type !== 'MultiPolygon')) {
      missing.push(`${id} (${iso})`);
      continue;
    }
    const built = geometryToPath(id, f.geometry);
    if (!built) {
      missing.push(`${id} empty`);
      continue;
    }
    // Clamp labels into board
    built.label[0] = Math.min(W - 8, Math.max(8, built.label[0]));
    built.label[1] = Math.min(H - 8, Math.max(8, built.label[1]));
    coasts[id] = built;
  }

  if (missing.length) {
    console.warn('Missing geometries:', missing.join(', '));
  }

  // Filter neighbors that both exist
  const ids = new Set(Object.keys(coasts));
  const neighbors = LAND_NEIGHBORS.filter(([a, b]) => ids.has(a) && ids.has(b));

  const lines: string[] = [];
  lines.push('/** AUTO-GENERATED from Natural Earth 110m — do not hand-edit. */');
  lines.push('/** Run: npx tsx scripts/geo/generate-coastlines.ts */');
  lines.push('');
  lines.push('export type CoastDef = { path: string; label: [number, number] };');
  lines.push('');
  lines.push('export const WORLD_COASTLINES: Record<string, CoastDef> = {');
  for (const id of Object.keys(coasts).sort()) {
    const c = coasts[id];
    lines.push(`  ${id}: {`);
    lines.push(`    path: ${JSON.stringify(c.path)},`);
    lines.push(`    label: [${c.label[0]}, ${c.label[1]}],`);
    lines.push('  },');
  }
  lines.push('};');
  lines.push('');
  lines.push('export function getWorldCoastline(countryId: string): CoastDef | undefined {');
  lines.push('  return WORLD_COASTLINES[countryId];');
  lines.push('}');
  lines.push('');
  lines.push('/** Land pairs that intentionally share borders (AABB overlap expected). */');
  lines.push('export const WORLD_LAND_NEIGHBORS: Array<[string, string]> = [');
  for (const [a, b] of neighbors) {
    lines.push(`  ['${a}', '${b}'],`);
  }
  lines.push('];');
  lines.push('');
  lines.push('export function areWorldLandNeighbors(a: string, b: string): boolean {');
  lines.push('  return WORLD_LAND_NEIGHBORS.some(');
  lines.push('    ([x, y]) => (x === a && y === b) || (x === b && y === a)');
  lines.push('  );');
  lines.push('}');
  lines.push('');

  const out = path.resolve('src/data/worldCoastlines.ts');
  fs.writeFileSync(out, lines.join('\n'), 'utf8');
  console.log(`Wrote ${Object.keys(coasts).length} coastlines → ${out}`);
}

main();

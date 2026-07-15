/**
 * Sanity — every catalog nation has denser coastline geometry.
 */
import { COUNTRIES } from '../src/data/countries.ts';
import { WORLD_COASTLINES } from '../src/data/worldCoastlines.ts';
import { WORLD_MAP_HEIGHT, WORLD_MAP_WIDTH } from '../src/data/worldMap.ts';

function points(path: string): Array<[number, number]> {
  return [...path.matchAll(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/g)].map(m => [
    Number(m[1]),
    Number(m[2]),
  ]);
}

let failed = 0;
const nationIds = Object.keys(COUNTRIES);
for (const id of nationIds) {
  if (!WORLD_COASTLINES[id]) {
    console.error('missing coastline', id);
    failed++;
    continue;
  }
  const pts = points(COUNTRIES[id].worldMapPath);
  if (pts.length < 8) {
    console.error('too coarse', id, pts.length);
    failed++;
  }
  for (const [x, y] of pts) {
    if (x < 0 || y < 0 || x > WORLD_MAP_WIDTH || y > WORLD_MAP_HEIGHT) {
      console.error('oob', id, x, y);
      failed++;
      break;
    }
  }
}

const avg =
  nationIds.reduce((s, id) => s + points(COUNTRIES[id].worldMapPath).length, 0) / nationIds.length;

console.log(
  failed
    ? `smoke-coastlines FAIL (${failed})`
    : `smoke-coastlines OK — ${nationIds.length} nations, avg ${avg.toFixed(1)} verts`
);
if (failed) process.exitCode = 1;

import type { Country, Region } from '../types/game';

/** Compute a tight viewBox around visible countries for hemisphere zoom */
export function computeHemisphereViewBox(countries: Country[], pad = 28): string {
  if (countries.length === 0) return '0 0 900 400';

  const xs = countries.map(c => c.worldMapLabel[0]);
  const ys = countries.map(c => c.worldMapLabel[1]);
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  const maxX = Math.max(...xs) + pad;
  const maxY = Math.max(...ys) + pad;

  let w = maxX - minX;
  let h = maxY - minY;

  // Single-nation hemispheres (Americas): pad to a squarer frame for mobile fill
  if (countries.length <= 2) {
    const size = Math.max(w, h, 160);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    return `${cx - size / 2} ${cy - size / 2} ${size} ${size}`;
  }

  // Multi-nation: add vertical padding so slice crop feels less extreme
  const aspect = w / h;
  if (aspect > 2) {
    const targetH = w / 1.35;
    const extra = (targetH - h) / 2;
    return `${minX} ${minY - extra} ${w} ${targetH}`;
  }

  return `${minX} ${minY} ${w} ${h}`;
}

/** Auto-fit national map viewBox to regions + neighbour strip */
export function getNationalViewBox(regions: Region[], pad = 32): string {
  if (regions.length === 0) return '0 0 500 350';

  const xs = regions.map(r => r.center[0]);
  const ys = regions.map(r => r.center[1]);
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  const w = Math.max(...xs) + pad - minX;
  const h = Math.max(...ys) + pad - minY;

  return `${minX} ${minY} ${w} ${h}`;
}

/** Short region label for cramped mobile tiles */
export function shortRegionName(name: string): string {
  const first = name.split(/[\s&]/)[0];
  return first.length > 9 ? `${first.slice(0, 8)}…` : first;
}

import type { Region } from '../types/game';

/** Parse SVG path absolute M/L coordinates into a bbox. */
function pathExtents(path: string): { minX: number; minY: number; maxX: number; maxY: number } | null {
  const pts = [...path.matchAll(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/g)].map(m => [
    Number(m[1]),
    Number(m[2]),
  ]);
  if (pts.length === 0) return null;
  const xs = pts.map(p => p[0]);
  const ys = pts.map(p => p[1]);
  return { minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
}

/** Auto-fit national map viewBox to region path geometry (not just centers). */
export function getNationalViewBox(regions: Region[], pad = 32): string {
  if (regions.length === 0) return '0 0 500 350';

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const region of regions) {
    const box = pathExtents(region.mapPath);
    if (box) {
      minX = Math.min(minX, box.minX);
      minY = Math.min(minY, box.minY);
      maxX = Math.max(maxX, box.maxX);
      maxY = Math.max(maxY, box.maxY);
    } else {
      minX = Math.min(minX, region.center[0]);
      minY = Math.min(minY, region.center[1]);
      maxX = Math.max(maxX, region.center[0]);
      maxY = Math.max(maxY, region.center[1]);
    }
  }

  return `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`;
}

/** Short region label for cramped mobile tiles */
export function shortRegionName(name: string): string {
  const first = name.split(/[\s&]/)[0];
  return first.length > 9 ? `${first.slice(0, 8)}…` : first;
}

/**
 * Region map label: first word, unless that word collides with a sibling's
 * first word on the same map (e.g. "Great Lakes" vs "Great Plains" both
 * reading as "Great") — then fall back to the full name so regions stay
 * distinguishable.
 */
export function regionMapLabel(region: Region, siblings: Region[], isMobile: boolean): string {
  const first = region.name.split(/[\s&]/)[0];
  const collides = siblings.some(s => s.id !== region.id && s.name.split(/[\s&]/)[0] === first);
  const label = collides ? region.name : first;
  if (!isMobile) return label;
  return label.length > 9 ? `${label.slice(0, 8)}…` : label;
}

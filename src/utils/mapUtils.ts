import type { Front, Region } from '../types/game';

export interface NationalLayout {
  viewBox: string;
  width: number;
  height: number;
}

const DEFAULT_LAYOUT: NationalLayout = { viewBox: '0 0 500 350', width: 500, height: 350 };

const LAYOUT_OVERRIDES: Record<string, NationalLayout> = {
  russia: { viewBox: '50 40 400 200', width: 500, height: 320 },
  usa: { viewBox: '20 60 280 230', width: 500, height: 350 },
  china: { viewBox: '140 150 280 180', width: 500, height: 350 },
  india: { viewBox: '140 20 220 320', width: 500, height: 350 },
  israel: { viewBox: '90 80 120 150', width: 500, height: 350 },
  ukraine: { viewBox: '38 78 122 202', width: 500, height: 350 },
  saudi_arabia: { viewBox: '85 88 250 150', width: 500, height: 350 },
  egypt: { viewBox: '85 62 240 143', width: 500, height: 350 },
};

export function getNationalLayout(countryId: string, regions: Region[]): NationalLayout {
  if (LAYOUT_OVERRIDES[countryId]) return LAYOUT_OVERRIDES[countryId];
  if (regions.length === 0) return DEFAULT_LAYOUT;

  const xs = regions.flatMap(r => [r.center[0]]);
  const ys = regions.flatMap(r => [r.center[1]]);
  const pad = 40;
  const minX = Math.min(...xs) - pad;
  const minY = Math.min(...ys) - pad;
  const maxX = Math.max(...xs) + pad;
  const maxY = Math.max(...ys) + pad;

  return {
    viewBox: `${minX} ${minY} ${maxX - minX} ${maxY - minY}`,
    width: 500,
    height: 350,
  };
}

export function getFrontMidpoint(front: Front, regions: Record<string, Region>): [number, number] | null {
  const atk = regions[front.attackerRegionId];
  const def = regions[front.defenderRegionId];
  if (!atk || !def) return null;
  return [(atk.center[0] + def.center[0]) / 2, (atk.center[1] + def.center[1]) / 2];
}

export function getFrontAngle(front: Front, regions: Record<string, Region>): number {
  const atk = regions[front.attackerRegionId];
  const def = regions[front.defenderRegionId];
  if (!atk || !def) return 0;
  const dx = def.center[0] - atk.center[0];
  const dy = def.center[1] - atk.center[1];
  return (Math.atan2(dy, dx) * 180) / Math.PI;
}

export function getPressureColor(pressure: number): string {
  if (pressure > 40) return '#ef4444';
  if (pressure > 15) return '#f97316';
  if (pressure < -40) return '#3b82f6';
  if (pressure < -15) return '#60a5fa';
  return '#94a3b8';
}

export function getPressureArrowPath(pressure: number): string {
  if (pressure > 5) return 'M -8,0 L 6,0 M 2,-4 L 8,0 L 2,4';
  if (pressure < -5) return 'M 8,0 L -6,0 M -2,-4 L -8,0 L -2,4';
  return 'M -6,0 L 6,0';
}

export function isRegionFlipped(region: Region, currentTurn: number): boolean {
  return region.lastFlippedTurn === currentTurn;
}

export function getRegionStyle(
  region: Region,
  ownerColor: string,
  currentTurn: number,
  isSelected: boolean
): { fill: string; className: string; stroke: string; strokeWidth: number } {
  const isDisputed = region.controlledBy !== region.countryId;
  const flipped = isRegionFlipped(region, currentTurn);
  return {
    fill: isDisputed ? '#b45309' : ownerColor,
    className: [flipped ? 'region-flipped' : '', isDisputed ? 'region-occupied' : '', isSelected ? 'region-selected' : '']
      .filter(Boolean)
      .join(' '),
    stroke: isSelected ? '#fbbf24' : isDisputed ? '#f59e0b' : '#1e293b',
    strokeWidth: isSelected ? 2.5 : isDisputed ? 1.5 : 1,
  };
}

/** Find active front region pairs for border highlighting */
export function getFrontBorderPairs(
  fronts: Front[],
  regionIds: Set<string>
): Array<{ a: string; b: string; pressure: number }> {
  return fronts
    .filter(f => regionIds.has(f.attackerRegionId) || regionIds.has(f.defenderRegionId))
    .map(f => ({ a: f.attackerRegionId, b: f.defenderRegionId, pressure: f.pressure }));
}

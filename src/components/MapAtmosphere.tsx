import { useId } from 'react';
import type { Terrain } from '../types/game';

/** Shared SVG atmosphere for strategic maps — sea-ink ocean, foam meridians, terrain hatch. */
export function useMapAtmosphereId(prefix = 'map') {
  const uid = useId().replace(/:/g, '');
  return `${prefix}-${uid}`;
}

interface MapAtmosphereDefsProps {
  id: string;
}

export function MapAtmosphereDefs({ id }: MapAtmosphereDefsProps) {
  return (
    <defs>
      <linearGradient id={`${id}-ocean`} x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stopColor="#0a1a18" />
        <stop offset="45%" stopColor="#0f2420" />
        <stop offset="100%" stopColor="#081412" />
      </linearGradient>
      <radialGradient id={`${id}-glow`} cx="50%" cy="40%" r="65%">
        <stop offset="0%" stopColor="rgba(180, 210, 200, 0.10)" />
        <stop offset="55%" stopColor="rgba(40, 90, 78, 0.05)" />
        <stop offset="100%" stopColor="rgba(8, 16, 14, 0)" />
      </radialGradient>
      <pattern id={`${id}-grain`} width="6" height="6" patternUnits="userSpaceOnUse">
        <circle cx="1" cy="1.5" r="0.45" fill="rgba(200, 220, 210, 0.07)" />
        <circle cx="4.2" cy="3.8" r="0.35" fill="rgba(200, 220, 210, 0.05)" />
      </pattern>
      <pattern id={`${id}-hatch-mtn`} width="8" height="8" patternUnits="userSpaceOnUse">
        <path d="M0 8 L8 0" stroke="rgba(12, 22, 20, 0.35)" strokeWidth="1.1" />
        <path d="M-2 4 L4 -2 M4 10 L10 4" stroke="rgba(12, 22, 20, 0.22)" strokeWidth="0.8" />
      </pattern>
      <pattern id={`${id}-hatch-desert`} width="10" height="10" patternUnits="userSpaceOnUse">
        <circle cx="2" cy="3" r="0.7" fill="rgba(201, 169, 106, 0.12)" />
        <circle cx="7" cy="7" r="0.55" fill="rgba(201, 169, 106, 0.09)" />
      </pattern>
      <pattern id={`${id}-hatch-urban`} width="6" height="6" patternUnits="userSpaceOnUse">
        <path d="M0 3 H6 M3 0 V6" stroke="rgba(12, 22, 20, 0.18)" strokeWidth="0.6" />
      </pattern>
      <pattern id={`${id}-hatch-coast`} width="12" height="4" patternUnits="userSpaceOnUse">
        <path d="M0 2 Q3 0 6 2 T12 2" fill="none" stroke="rgba(200, 217, 208, 0.14)" strokeWidth="0.7" />
      </pattern>
      <filter id={`${id}-land-inner`} x="-2%" y="-2%" width="104%" height="104%">
        <feDropShadow dx="0" dy="0.6" stdDeviation="0.4" floodColor="#06100e" floodOpacity="0.45" />
      </filter>
    </defs>
  );
}

interface MapOceanProps {
  id: string;
  x?: number;
  y?: number;
  width: number;
  height: number;
  /** denser meridians for national close-ups */
  dense?: boolean;
}

export function MapOcean({ id, x = 0, y = 0, width, height, dense = false }: MapOceanProps) {
  const step = dense ? 36 : 50;
  const vLines = Math.ceil(width / step) + 1;
  const hLines = Math.ceil(height / step) + 1;

  return (
    <g className="map-ocean" pointerEvents="none">
      <rect x={x} y={y} width={width} height={height} fill={`url(#${id}-ocean)`} />
      <rect x={x} y={y} width={width} height={height} fill={`url(#${id}-glow)`} />
      {Array.from({ length: vLines }, (_, i) => {
        const lx = x + i * step;
        return (
          <line
            key={`m${i}`}
            x1={lx}
            y1={y}
            x2={lx}
            y2={y + height}
            stroke="rgba(180, 200, 190, 0.06)"
            strokeWidth="1"
          />
        );
      })}
      {Array.from({ length: hLines }, (_, i) => {
        const ly = y + i * step;
        return (
          <line
            key={`p${i}`}
            x1={x}
            y1={ly}
            x2={x + width}
            y2={ly}
            stroke="rgba(180, 200, 190, 0.05)"
            strokeWidth="1"
          />
        );
      })}
      <rect x={x} y={y} width={width} height={height} fill={`url(#${id}-grain)`} />
    </g>
  );
}

export function terrainHatchUrl(id: string, terrain: Terrain): string | null {
  switch (terrain) {
    case 'mountain':
      return `url(#${id}-hatch-mtn)`;
    case 'desert':
      return `url(#${id}-hatch-desert)`;
    case 'urban':
      return `url(#${id}-hatch-urban)`;
    case 'coastal':
      return `url(#${id}-hatch-coast)`;
    default:
      return null;
  }
}

export const MAP_STROKE = {
  ink: '#0a1412',
  brass: '#c9a96a',
  war: '#c45c4a',
  disputed: '#d4a04a',
  neighbourDash: '#5a726a',
} as const;

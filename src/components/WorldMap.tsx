import type { GameState } from '../types/game';
import { getBlocColor } from '../engine/diplomacy';
import { getRelation } from '../data/relations';
import { WORLD_VIEWBOX, MAP_BACKGROUNDS, getWorldShape } from '../data/worldMap';

interface WorldMapProps {
  state: GameState;
  onCountryClick: (countryId: string) => void;
  hoveredCountryId?: string | null;
  onHoverCountry?: (id: string | null) => void;
}

export function WorldMap({ state, onCountryClick, hoveredCountryId, onHoverCountry }: WorldMapProps) {
  const { width, height } = WORLD_VIEWBOX;
  const countries = Object.values(state.countries);

  return (
    <div className="map-container world-map">
      <svg viewBox={`0 0 ${width} ${height}`} className="map-svg world-map-svg" preserveAspectRatio="xMidYMid meet">
        <rect width={width} height={height} fill={MAP_BACKGROUNDS.ocean} />

        {/* Graticule */}
        {Array.from({ length: 11 }, (_, i) => (
          <line key={`h${i}`} x1="0" y1={i * 50} x2={width} y2={i * 50} stroke={MAP_BACKGROUNDS.graticule} strokeWidth="0.4" />
        ))}
        {Array.from({ length: 21 }, (_, i) => (
          <line key={`v${i}`} x1={i * 50} y1="0" x2={i * 50} y2={height} stroke={MAP_BACKGROUNDS.graticule} strokeWidth="0.4" />
        ))}

        {/* Continent landmass hints */}
        {MAP_BACKGROUNDS.continents.map((path, i) => (
          <path key={`cont${i}`} d={path} fill={MAP_BACKGROUNDS.landmass} stroke="none" opacity="0.6" />
        ))}

        {/* War connection lines between belligerents */}
        {state.wars.flatMap(war => {
          const pairs: Array<[string, string]> = [];
          const bells = war.belligerents;
          for (let i = 0; i < bells.length; i++) {
            for (let j = i + 1; j < bells.length; j++) {
              if (state.countries[bells[i]] && state.countries[bells[j]]) {
                pairs.push([bells[i], bells[j]]);
              }
            }
          }
          return pairs.map(([a, b]) => {
            const shapeA = getWorldShape(a) ?? { label: state.countries[a].worldMapLabel };
            const shapeB = getWorldShape(b) ?? { label: state.countries[b].worldMapLabel };
            const labelA = 'label' in shapeA ? shapeA.label : state.countries[a].worldMapLabel;
            const labelB = 'label' in shapeB ? shapeB.label : state.countries[b].worldMapLabel;
            return (
              <line
                key={`war_${war.id}_${a}_${b}`}
                x1={labelA[0]}
                y1={labelA[1]}
                x2={labelB[0]}
                y2={labelB[1]}
                stroke="#ef4444"
                strokeWidth="1"
                strokeDasharray="6 4"
                opacity="0.35"
                pointerEvents="none"
              />
            );
          });
        })}

        {countries.map(country => {
          const shape = getWorldShape(country.id);
          const pathD = shape?.path ?? country.worldMapPath;
          const labelPos = shape?.label ?? country.worldMapLabel;
          const fill = getBlocColor(state, country.id);
          const isPlayer = country.id === state.playerCountryId;
          const atWar = state.wars.some(w => w.belligerents.includes(country.id));
          const isHovered = hoveredCountryId === country.id;
          const relation = country.id !== state.playerCountryId
            ? getRelation(state.relations, state.playerCountryId, country.id)
            : 0;

          return (
            <g
              key={country.id}
              className={`country-group ${isHovered ? 'hovered' : ''}`}
              onClick={() => onCountryClick(country.id)}
              onMouseEnter={() => onHoverCountry?.(country.id)}
              onMouseLeave={() => onHoverCountry?.(null)}
            >
              <path
                d={pathD}
                fill={fill}
                stroke={isPlayer ? '#fbbf24' : atWar ? '#ef4444' : isHovered ? '#e2e8f0' : '#334155'}
                strokeWidth={isPlayer ? 2.5 : isHovered ? 2 : atWar ? 1.5 : 0.8}
                opacity={country.playable ? 0.9 : 0.55}
                className="country-path"
              />
              {/* Larger hit target for small nations (Israel, UK, etc.) */}
              {shape?.hitRadius && (
                <circle
                  cx={labelPos[0]}
                  cy={labelPos[1]}
                  r={shape.hitRadius}
                  fill="transparent"
                  pointerEvents="all"
                />
              )}
              {/* Diplomacy relation ring on hover */}
              {isHovered && country.id !== state.playerCountryId && (
                <circle
                  cx={labelPos[0]}
                  cy={labelPos[1]}
                  r="14"
                  fill="none"
                  stroke={relation > 30 ? '#22c55e' : relation < -30 ? '#ef4444' : '#94a3b8'}
                  strokeWidth="2"
                  opacity="0.7"
                  pointerEvents="none"
                />
              )}
              <text
                x={labelPos[0]}
                y={labelPos[1]}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#e2e8f0"
                fontSize={country.id === 'israel' ? 7 : 9}
                fontWeight={isPlayer ? 'bold' : 'normal'}
                pointerEvents="none"
                className="country-label"
              >
                {shape?.labelShort ?? (country.name.length > 12 ? country.name.split(' ')[0] : country.name)}
              </text>
              {atWar && (
                <circle cx={labelPos[0] + 12} cy={labelPos[1] - 10} r="3" fill="#ef4444" className="war-pulse" />
              )}
            </g>
          );
        })}

        {/* Event pins */}
        {state.activeEvents
          .filter(e => !e.resolved && e.targetCountryId)
          .slice(0, 5)
          .map(evt => {
            const shape = getWorldShape(evt.targetCountryId!);
            const country = state.countries[evt.targetCountryId!];
            if (!country) return null;
            const pos = shape?.label ?? country.worldMapLabel;
            return (
              <g key={evt.eventId} pointerEvents="none">
                <circle cx={pos[0] + 14} cy={pos[1] - 12} r="5" fill="#f59e0b" className="event-pin" />
                <text x={pos[0] + 14} y={pos[1] - 10} textAnchor="middle" fill="#000" fontSize="7" fontWeight="bold">!</text>
              </g>
            );
          })}
      </svg>

      {hoveredCountryId && hoveredCountryId !== state.playerCountryId && (
        <div className="map-tooltip">
          <strong>{state.countries[hoveredCountryId]?.name}</strong>
          <span>Relations: {getRelation(state.relations, state.playerCountryId, hoveredCountryId)}</span>
        </div>
      )}
    </div>
  );
}

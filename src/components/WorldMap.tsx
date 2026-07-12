import type { GameState } from '../types/game';
import { getBlocColor } from '../engine/diplomacy';

interface WorldMapProps {
  state: GameState;
  onCountryClick: (countryId: string) => void;
}

export function WorldMap({ state, onCountryClick }: WorldMapProps) {
  const playableCountries = Object.values(state.countries);

  return (
    <div className="map-container world-map">
      <svg viewBox="0 0 900 400" className="map-svg">
        <rect width="900" height="400" fill="#0c1929" />
        {/* Ocean grid lines */}
        {Array.from({ length: 9 }, (_, i) => (
          <line key={`h${i}`} x1="0" y1={i * 50} x2="900" y2={i * 50} stroke="#1a2a3a" strokeWidth="0.5" />
        ))}
        {Array.from({ length: 18 }, (_, i) => (
          <line key={`v${i}`} x1={i * 50} y1="0" x2={i * 50} y2="400" stroke="#1a2a3a" strokeWidth="0.5" />
        ))}

        {playableCountries.map(country => {
          const fill = getBlocColor(state, country.id);
          const isPlayer = country.id === state.playerCountryId;
          const atWar = state.wars.some(w => w.belligerents.includes(country.id));

          return (
            <g key={country.id} className="country-group" onClick={() => onCountryClick(country.id)}>
              <path
                d={country.worldMapPath}
                fill={fill}
                stroke={isPlayer ? '#fbbf24' : atWar ? '#ef4444' : '#334155'}
                strokeWidth={isPlayer ? 2.5 : 1}
                opacity={country.playable ? 0.85 : 0.5}
                className="country-path"
              />
              <text
                x={country.worldMapLabel[0]}
                y={country.worldMapLabel[1]}
                textAnchor="middle"
                fill="#e2e8f0"
                fontSize="9"
                fontWeight={isPlayer ? 'bold' : 'normal'}
                pointerEvents="none"
              >
                {country.name}
              </text>
            </g>
          );
        })}

        {/* Global event pins */}
        {state.activeEvents
          .filter(e => !e.resolved)
          .slice(0, 3)
          .map((evt, i) => {
            const country = evt.targetCountryId ? state.countries[evt.targetCountryId] : null;
            if (!country) return null;
            return (
              <circle
                key={evt.eventId}
                cx={country.worldMapLabel[0] + 15}
                cy={country.worldMapLabel[1] - 10 - i * 8}
                r="4"
                fill="#f59e0b"
                className="event-pin"
              />
            );
          })}
      </svg>
    </div>
  );
}

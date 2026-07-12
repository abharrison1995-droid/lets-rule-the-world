import type { GameState } from '../types/game';
import { getBlocColor } from '../engine/diplomacy';
import { HEMISPHERES, getCountriesInHemisphere, type HemisphereId } from '../data/hemispheres';
import { useMobileLayout } from '../hooks/useMobileLayout';
import { computeHemisphereViewBox } from '../utils/mapUtils';

const FULL_VIEWBOX = '0 0 900 400';

interface WorldMapProps {
  state: GameState;
  onCountryClick: (countryId: string) => void;
  hemisphere?: HemisphereId;
  onBack?: () => void;
}

export function WorldMap({ state, onCountryClick, hemisphere, onBack }: WorldMapProps) {
  const isMobile = useMobileLayout();
  const allCountries = Object.values(state.countries);
  const visibleIds = hemisphere
    ? getCountriesInHemisphere(allCountries.map(c => c.id), hemisphere)
    : allCountries.map(c => c.id);
  const countries = allCountries.filter(c => visibleIds.includes(c.id));
  const viewBox = hemisphere
    ? computeHemisphereViewBox(countries)
    : FULL_VIEWBOX;
  const title = hemisphere ? HEMISPHERES[hemisphere].title : 'World Map';
  const fillHeight = isMobile && !!hemisphere;

  return (
    <div className={`map-container world-map${hemisphere ? ' world-map--hemisphere' : ''}${fillHeight ? ' world-map--mobile-fill' : ''}`}>
      {hemisphere && onBack && (
        <div className="national-map-header world-map-header">
          <button type="button" className="btn-back" onClick={onBack}>← Overview</button>
          <h2>{title}</h2>
        </div>
      )}

      <div className="map-stage">
        <svg
          viewBox={viewBox}
          className="map-svg world-map-svg"
          preserveAspectRatio={fillHeight ? 'xMidYMid slice' : 'xMidYMid meet'}
        >
          <rect width="900" height="400" fill="#0c1929" />
          {Array.from({ length: 9 }, (_, i) => (
            <line key={`h${i}`} x1="0" y1={i * 50} x2="900" y2={i * 50} stroke="#1a2a3a" strokeWidth="0.5" />
          ))}
          {Array.from({ length: 18 }, (_, i) => (
            <line key={`v${i}`} x1={i * 50} y1="0" x2={i * 50} y2="400" stroke="#1a2a3a" strokeWidth="0.5" />
          ))}

          {state.wars.flatMap(war => {
            const pairs: Array<[string, string]> = [];
            const bells = war.belligerents.filter(b => visibleIds.includes(b));
            for (let i = 0; i < bells.length; i++) {
              for (let j = i + 1; j < bells.length; j++) pairs.push([bells[i], bells[j]]);
            }
            return pairs.map(([a, b]) => {
              const countryA = state.countries[a];
              const countryB = state.countries[b];
              if (!countryA || !countryB) return null;
              return (
                <line
                  key={`war_${war.id}_${a}_${b}`}
                  x1={countryA.worldMapLabel[0]}
                  y1={countryA.worldMapLabel[1]}
                  x2={countryB.worldMapLabel[0]}
                  y2={countryB.worldMapLabel[1]}
                  stroke="#ef4444"
                  strokeWidth={hemisphere ? 2 : 1.5}
                  strokeDasharray="6 4"
                  opacity="0.45"
                  pointerEvents="none"
                />
              );
            });
          })}

          {countries.map(country => {
            const fill = getBlocColor(state, country.id);
            const isPlayer = country.id === state.playerCountryId;
            const atWar = state.wars.some(w => w.belligerents.includes(country.id));
            const label = country.name.length > 12 ? country.name.split(' ')[0] : country.name;
            const fontSize = hemisphere ? (isMobile ? 13 : 11) : 9;
            const strokeW = isPlayer ? 3 : atWar ? 2 : isMobile && hemisphere ? 1.5 : 1;

            return (
              <g key={country.id} className="country-group" onClick={() => onCountryClick(country.id)}>
                <path
                  d={country.worldMapPath}
                  fill={fill}
                  stroke={isPlayer ? '#fbbf24' : atWar ? '#ef4444' : '#334155'}
                  strokeWidth={strokeW}
                  opacity={country.playable ? 0.92 : 0.58}
                  className="country-path"
                />
                <text
                  x={country.worldMapLabel[0]}
                  y={country.worldMapLabel[1]}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fill="#e2e8f0"
                  fontSize={fontSize}
                  fontWeight={isPlayer ? 'bold' : 'normal'}
                  pointerEvents="none"
                  className="country-label"
                >
                  {label}
                </text>
                {atWar && (
                  <circle
                    cx={country.worldMapLabel[0] + 16}
                    cy={country.worldMapLabel[1] - 14}
                    r={isMobile ? 5 : 4}
                    fill="#ef4444"
                    className="war-pulse"
                    pointerEvents="none"
                  />
                )}
              </g>
            );
          })}

          {state.activeEvents
            .filter(e => !e.resolved && e.targetCountryId && visibleIds.includes(e.targetCountryId))
            .slice(0, 5)
            .map(evt => {
              const country = state.countries[evt.targetCountryId!];
              if (!country) return null;
              return (
                <g key={evt.eventId} pointerEvents="none">
                  <circle
                    cx={country.worldMapLabel[0] + 16}
                    cy={country.worldMapLabel[1] - 14}
                    r="6"
                    fill="#f59e0b"
                  />
                  <text
                    x={country.worldMapLabel[0] + 16}
                    y={country.worldMapLabel[1] - 11}
                    textAnchor="middle"
                    fill="#000"
                    fontSize="8"
                    fontWeight="bold"
                  >
                    !
                  </text>
                </g>
              );
            })}
        </svg>
      </div>
    </div>
  );
}

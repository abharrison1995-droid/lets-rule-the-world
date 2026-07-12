import type { GameState, Front } from '../types/game';
import { getRegionsForCountry, getNeighbourStrip } from '../data/regions';
import { getDefenseSystemRating } from '../engine/economy';
import {
  getNationalLayout,
  getFrontMidpoint,
  getFrontAngle,
  getPressureColor,
  getPressureArrowPath,
  getRegionStyle,
  getFrontBorderPairs,
} from '../utils/mapUtils';

interface NationalMapProps {
  state: GameState;
  countryId: string;
  onBack: () => void;
  onRegionClick: (regionId: string) => void;
}

function FrontArrow({ front, state }: { front: Front; state: GameState }) {
  const mid = getFrontMidpoint(front, state.regions);
  if (!mid) return null;
  const angle = getFrontAngle(front, state.regions);
  const color = getPressureColor(front.pressure);
  const arrowPath = getPressureArrowPath(front.pressure);

  return (
    <g transform={`translate(${mid[0]},${mid[1]}) rotate(${angle})`} pointerEvents="none">
      <circle r={8 + Math.abs(front.pressure) / 15} fill={color} opacity="0.15" />
      <path d={arrowPath} stroke={color} strokeWidth="2" fill="none" strokeLinecap="round" />
      <text x="0" y="-12" textAnchor="middle" fill={color} fontSize="6" transform={`rotate(${-angle})`}>
        {Math.round(front.pressure)}
      </text>
    </g>
  );
}

export function NationalMap({ state, countryId, onBack, onRegionClick }: NationalMapProps) {
  const regions = getRegionsForCountry(countryId);
  const neighbourStrip = getNeighbourStrip(countryId);
  const country = state.countries[countryId];
  const layers = state.visibleLayers;
  const selectedRegion = state.selectedRegionId;
  const layout = getNationalLayout(countryId, [...regions, ...neighbourStrip]);
  const regionIdSet = new Set([...regions, ...neighbourStrip].map(r => r.id));

  const relevantFronts = state.fronts.filter(
    f => regionIdSet.has(f.attackerRegionId) || regionIdSet.has(f.defenderRegionId)
  );
  const borderPairs = getFrontBorderPairs(relevantFronts, regionIdSet);

  if (regions.length === 0) {
    return (
      <div className="map-container national-map">
        <div className="national-map-header">
          <button className="btn-back" onClick={onBack}>← World Map</button>
          <h2>{country?.name}</h2>
        </div>
        <p className="muted no-regions-msg">No regional map data for this nation.</p>
      </div>
    );
  }

  return (
    <div className="map-container national-map">
      <div className="national-map-header">
        <button className="btn-back" onClick={onBack}>← World Map</button>
        <h2>{country?.name}</h2>
        {relevantFronts.length > 0 && (
          <span className="front-count">{relevantFronts.length} active front{relevantFronts.length > 1 ? 's' : ''}</span>
        )}
      </div>

      <svg viewBox={layout.viewBox} className="map-svg national-map-svg" preserveAspectRatio="xMidYMid meet">
        <defs>
          <pattern id="mapGrid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1a2a3a" strokeWidth="0.3" />
          </pattern>
        </defs>
        <rect x="-100" y="-100" width="800" height="600" fill="#0f1d2e" />
        <rect x="-100" y="-100" width="800" height="600" fill="url(#mapGrid)" opacity="0.5" />

        {neighbourStrip.map(region => (
          <g key={`nb_${region.id}`} className="neighbour-region" opacity={0.4}>
            <path d={region.mapPath} fill="#475569" stroke="#64748b" strokeWidth="0.8" strokeDasharray="3 2" />
          </g>
        ))}

        {borderPairs.map(({ a, b, pressure }) => {
          const regA = state.regions[a];
          const regB = state.regions[b];
          if (!regA || !regB) return null;
          return (
            <line
              key={`border_${a}_${b}`}
              x1={regA.center[0]}
              y1={regA.center[1]}
              x2={regB.center[0]}
              y2={regB.center[1]}
              stroke={getPressureColor(pressure)}
              strokeWidth={2 + Math.abs(pressure) / 25}
              opacity={0.6}
              pointerEvents="none"
              className="front-border-glow"
            />
          );
        })}

        {regions.map(region => {
          const owner = state.countries[region.controlledBy];
          const style = getRegionStyle(region, owner?.color ?? '#334155', state.turn, selectedRegion === region.id);
          return (
            <g key={region.id} onClick={() => onRegionClick(region.id)} className={`region-group ${style.className}`}>
              <path d={region.mapPath} fill={style.fill} stroke={style.stroke} strokeWidth={style.strokeWidth} opacity={0.88} />
              <text x={region.center[0]} y={region.center[1]} textAnchor="middle" dominantBaseline="middle" fill="#f1f5f9" fontSize="8" pointerEvents="none">
                {region.name.split(' ')[0]}
              </text>
            </g>
          );
        })}

        {relevantFronts.map(front => (
          <FrontArrow key={front.id} front={front} state={state} />
        ))}

        {/* Neighbour labels on top so they stay readable */}
        {neighbourStrip.map(region => (
          <text
            key={`nb_label_${region.id}`}
            x={region.center[0]}
            y={region.center[1]}
            fill="#94a3b8"
            fontSize="7"
            textAnchor="middle"
            pointerEvents="none"
            opacity={0.85}
          >
            {region.name}
          </text>
        ))}

        {layers.includes('military') && regions.map(region => (
          <g key={`mil_${region.id}`} pointerEvents="none">
            <circle cx={region.center[0] + 12} cy={region.center[1] - 10} r="6" fill="#ef4444" opacity="0.85" />
            <text x={region.center[0] + 12} y={region.center[1] - 7} textAnchor="middle" fill="white" fontSize="5" fontWeight="bold">
              {Math.round(region.garrison.troops / 1000)}k
            </text>
          </g>
        ))}

        {layers.includes('airDefense') && regions.map(region => {
          const rating = getDefenseSystemRating(region);
          if (rating === 0) return null;
          return (
            <g key={`ad_${region.id}`}>
              <circle cx={region.center[0] - 12} cy={region.center[1] - 10} r="6" fill="#3b82f6" opacity="0.85" />
              <text x={region.center[0] - 12} y={region.center[1] - 7} textAnchor="middle" fill="white" fontSize="5">{rating}</text>
              {state.showDefenseRanges && (
                <circle cx={region.center[0]} cy={region.center[1]} r={rating * 12} fill="none" stroke="#3b82f6" strokeWidth="0.6" opacity="0.25" />
              )}
            </g>
          );
        })}

        {layers.includes('drones') && regions.map(region => {
          if ((state.countries[region.controlledBy]?.militaryDev.droneProgram ?? 0) < 3) return null;
          return (
            <g key={`drone_${region.id}`} pointerEvents="none">
              <polygon points={`${region.center[0]},${region.center[1] + 10} ${region.center[0] - 5},${region.center[1] + 18} ${region.center[0] + 5},${region.center[1] + 18}`} fill="#a855f7" opacity="0.75" />
            </g>
          );
        })}

        {layers.includes('alliances') && regions.map(region => {
          const ownerAlliances = state.alliances.filter(a => a.members.includes(region.controlledBy));
          if (ownerAlliances.length === 0) return null;
          return (
            <g key={`ally_${region.id}`} pointerEvents="none">
              <rect x={region.center[0] - 8} y={region.center[1] + 8} width="16" height="7" fill="#3b82f6" opacity="0.65" rx="2" />
              <text x={region.center[0]} y={region.center[1] + 13} textAnchor="middle" fill="white" fontSize="4.5" fontWeight="bold">
                {ownerAlliances[0].id.toUpperCase().slice(0, 4)}
              </text>
            </g>
          );
        })}

        {layers.includes('events') && state.activeEvents
          .filter(e => !e.resolved && e.targetCountryId === countryId)
          .map((evt, i) => (
            <g key={evt.eventId} pointerEvents="none">
              <circle cx={30 + i * 18} cy={22} r="7" fill="#f59e0b" />
              <text x={30 + i * 18} y={24} textAnchor="middle" fill="#000" fontSize="8" fontWeight="bold">!</text>
            </g>
          ))}

        {layers.includes('economic') && regions.map(region => (
          <g key={`eco_${region.id}`} pointerEvents="none">
            <rect x={region.center[0] - 10} y={region.center[1] + 10} width="20" height="5" fill="#22c55e" opacity={Math.min(1, region.industryValue / 800)} rx="1" />
          </g>
        ))}

        {regions.filter(r => r.unrest > 20).map(region => (
          <g key={`unrest_${region.id}`} pointerEvents="none">
            <text x={region.center[0]} y={region.center[1] + 22} textAnchor="middle" fill="#f59e0b" fontSize="7">⚠{region.unrest}%</text>
          </g>
        ))}

        {state.strikeAnimations.map(anim => {
          const target = state.regions[anim.targetRegionId];
          if (!target || !regionIdSet.has(anim.targetRegionId)) return null;
          return (
            <g key={anim.id} pointerEvents="none" className="strike-animation">
              <circle cx={target.center[0]} cy={target.center[1]} r="8" fill="none" stroke={anim.intercepted ? '#3b82f6' : '#ef4444'} strokeWidth="2.5">
                <animate attributeName="r" from="4" to="24" dur="0.8s" repeatCount="3" />
                <animate attributeName="opacity" from="1" to="0" dur="0.8s" repeatCount="3" />
              </circle>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

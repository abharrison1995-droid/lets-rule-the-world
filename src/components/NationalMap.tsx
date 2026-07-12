import type { GameState } from '../types/game';
import { getRegionsForCountry, getNeighbourStrip } from '../data/regions';
import { getDefenseSystemRating } from '../engine/economy';

interface NationalMapProps {
  state: GameState;
  countryId: string;
  onBack: () => void;
  onRegionClick: (regionId: string) => void;
}

export function NationalMap({ state, countryId, onBack, onRegionClick }: NationalMapProps) {
  const regions = getRegionsForCountry(countryId);
  const neighbourStrip = getNeighbourStrip(countryId);
  const country = state.countries[countryId];
  const layers = state.visibleLayers;
  const selectedRegion = state.selectedRegionId;

  // Fronts involving this country's regions
  const relevantFronts = state.fronts.filter(
    f =>
      regions.some(r => r.id === f.attackerRegionId || r.id === f.defenderRegionId) ||
      neighbourStrip.some(r => r.id === f.attackerRegionId || r.id === f.defenderRegionId)
  );

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

      <svg viewBox="0 0 500 350" className="map-svg">
        <rect width="500" height="350" fill="#0f1d2e" />

        {neighbourStrip.map(region => (
          <g key={`nb_${region.id}`} opacity={0.35}>
            <path d={region.mapPath} fill="#475569" stroke="#64748b" strokeWidth="0.5" />
            <text x={region.center[0]} y={region.center[1]} fill="#94a3b8" fontSize="7" textAnchor="middle">
              {region.name}
            </text>
          </g>
        ))}

        {regions.map(region => {
          const owner = state.countries[region.controlledBy];
          const isDisputed = region.controlledBy !== region.countryId;
          const isSelected = selectedRegion === region.id;
          const fill = isDisputed ? '#b45309' : (owner?.color ?? '#334155');

          return (
            <g key={region.id} onClick={() => onRegionClick(region.id)} className="region-group">
              <path
                d={region.mapPath}
                fill={fill}
                stroke={isSelected ? '#fbbf24' : '#1e293b'}
                strokeWidth={isSelected ? 2 : 1}
                opacity={0.85}
              />
              <text x={region.center[0]} y={region.center[1]} textAnchor="middle" fill="#f1f5f9" fontSize="8" pointerEvents="none">
                {region.name}
              </text>
            </g>
          );
        })}

        {/* Front lines */}
        {relevantFronts.map(front => {
          const atk = state.regions[front.attackerRegionId];
          const def = state.regions[front.defenderRegionId];
          if (!atk || !def) return null;
          return (
            <line
              key={front.id}
              x1={atk.center[0]}
              y1={atk.center[1]}
              x2={def.center[0]}
              y2={def.center[1]}
              stroke="#ef4444"
              strokeWidth={1 + Math.abs(front.pressure) / 30}
              strokeDasharray="4 2"
              opacity={0.7}
              pointerEvents="none"
            />
          );
        })}

        {layers.includes('military') && regions.map(region => (
          <g key={`mil_${region.id}`} pointerEvents="none">
            <circle cx={region.center[0] + 12} cy={region.center[1] - 8} r="5" fill="#ef4444" opacity="0.8" />
            <text x={region.center[0] + 12} y={region.center[1] - 5} textAnchor="middle" fill="white" fontSize="5">
              {Math.round(region.garrison.troops / 1000)}k
            </text>
          </g>
        ))}

        {layers.includes('airDefense') && regions.map(region => {
          const rating = getDefenseSystemRating(region);
          if (rating === 0) return null;
          return (
            <g key={`ad_${region.id}`}>
              <circle cx={region.center[0] - 12} cy={region.center[1] - 8} r="5" fill="#3b82f6" opacity="0.8" />
              <text x={region.center[0] - 12} y={region.center[1] - 5} textAnchor="middle" fill="white" fontSize="5">
                {rating}
              </text>
              {state.showDefenseRanges && (
                <circle cx={region.center[0]} cy={region.center[1]} r={rating * 15} fill="none" stroke="#3b82f6" strokeWidth="0.5" opacity="0.3" />
              )}
            </g>
          );
        })}

        {layers.includes('drones') && regions.map(region => {
          const hasDrones = state.countries[region.controlledBy]?.militaryDev.droneProgram >= 3;
          if (!hasDrones) return null;
          return (
            <g key={`drone_${region.id}`} pointerEvents="none">
              <polygon
                points={`${region.center[0]},${region.center[1] + 10} ${region.center[0] - 4},${region.center[1] + 16} ${region.center[0] + 4},${region.center[1] + 16}`}
                fill="#a855f7" opacity="0.7"
              />
            </g>
          );
        })}

        {layers.includes('alliances') && regions.map(region => {
          const ownerAlliances = state.alliances.filter(a => a.members.includes(region.controlledBy));
          if (ownerAlliances.length === 0) return null;
          return (
            <g key={`ally_${region.id}`} pointerEvents="none">
              <rect x={region.center[0] - 6} y={region.center[1] + 6} width="12" height="6" fill="#3b82f6" opacity="0.6" rx="1" />
              <text x={region.center[0]} y={region.center[1] + 11} textAnchor="middle" fill="white" fontSize="4">
                {ownerAlliances[0].id.toUpperCase().slice(0, 3)}
              </text>
            </g>
          );
        })}

        {layers.includes('events') && state.activeEvents
          .filter(e => !e.resolved && e.targetCountryId === countryId)
          .map((evt, i) => (
            <g key={evt.eventId} pointerEvents="none">
              <circle cx={250} cy={20 + i * 12} r="5" fill="#f59e0b" />
              <text x={260} y={22 + i * 12} fill="#f59e0b" fontSize="7">!</text>
            </g>
          ))}

        {layers.includes('economic') && regions.map(region => (
          <g key={`eco_${region.id}`} pointerEvents="none">
            <rect x={region.center[0] - 8} y={region.center[1] + 8} width="16" height="4" fill="#22c55e" opacity={Math.min(1, region.industryValue / 1000)} rx="1" />
          </g>
        ))}

        {regions.filter(r => r.unrest > 20).map(region => (
          <g key={`unrest_${region.id}`} pointerEvents="none">
            <text x={region.center[0]} y={region.center[1] + 20} textAnchor="middle" fill="#f59e0b" fontSize="7">
              ⚠ {region.unrest}%
            </text>
          </g>
        ))}

        {state.strikeAnimations.map(anim => {
          const target = state.regions[anim.targetRegionId];
          if (!target) return null;
          return (
            <g key={anim.id} pointerEvents="none">
              <circle cx={target.center[0]} cy={target.center[1]} r="12" fill="none" stroke={anim.intercepted ? '#3b82f6' : '#ef4444'} strokeWidth="2" opacity="0.8">
                <animate attributeName="r" from="5" to="20" dur="1s" repeatCount="2" />
                <animate attributeName="opacity" from="1" to="0" dur="1s" repeatCount="2" />
              </circle>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

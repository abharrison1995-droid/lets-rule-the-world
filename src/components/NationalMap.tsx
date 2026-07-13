import type { GameState, Region, Front, LayerCategory } from '../types/game';
import { getRegionsForCountry, getNeighbourStrip } from '../data/regions';
import { getDefenseSystemRating } from '../engine/economy';
import { FACILITY_DEFINITIONS } from '../engine/facilities';
import { useMobileLayout } from '../hooks/useMobileLayout';
import { getNationalViewBox, shortRegionName } from '../utils/mapUtils';
import { PanZoomMap, useMapInteraction } from './PanZoomMap';

interface NationalMapProps {
  state: GameState;
  countryId: string;
  onBack: () => void;
  onRegionClick: (regionId: string) => void;
  backLabel?: string;
}

function NationalMapSvg({
  state,
  countryId,
  regions,
  neighbourStrip,
  relevantFronts,
  viewBox,
  isMobile,
  layers,
  selectedRegion,
  badgeR,
  badgeFont,
  badgeOffsetX,
  badgeOffsetY,
  regionFontSize,
  regionStroke,
  onRegionClick,
}: {
  state: GameState;
  countryId: string;
  regions: Region[];
  neighbourStrip: Region[];
  relevantFronts: Front[];
  viewBox: string;
  isMobile: boolean;
  layers: LayerCategory[];
  selectedRegion: string | null;
  badgeR: number;
  badgeFont: number;
  badgeOffsetX: number;
  badgeOffsetY: number;
  regionFontSize: number;
  regionStroke: number;
  onRegionClick: (regionId: string) => void;
}) {
  const { blockClickRef } = useMapInteraction();

  const handleRegionClick = (regionId: string) => {
    if (blockClickRef.current) return;
    onRegionClick(regionId);
  };

  return (
    <svg viewBox={viewBox} className="map-svg national-map-svg" preserveAspectRatio="xMidYMid meet">
      <rect x="-200" y="-200" width="900" height="700" fill="#0f1d2e" />

      {neighbourStrip.map(region => (
        <g key={`nb_${region.id}`} className="neighbour-region" opacity={0.35}>
          <path d={region.mapPath} fill="#475569" stroke="#64748b" strokeWidth="0.8" strokeDasharray="3 2" />
        </g>
      ))}

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
            strokeWidth={1.5 + Math.abs(front.pressure) / 25}
            strokeDasharray="4 2"
            opacity={0.65}
            pointerEvents="none"
          />
        );
      })}

      {regions.map(region => {
        const owner = state.countries[region.controlledBy];
        const isDisputed = region.controlledBy !== region.countryId;
        const isSelected = selectedRegion === region.id;
        const fill = isDisputed ? '#b45309' : (owner?.color ?? '#334155');

        return (
          <g key={region.id} onClick={() => handleRegionClick(region.id)} className="region-group">
            <path
              d={region.mapPath}
              fill={fill}
              stroke={isSelected ? '#fbbf24' : isDisputed ? '#f59e0b' : '#1e293b'}
              strokeWidth={isSelected ? 2.5 : regionStroke}
              opacity={0.9}
            />
            <text
              x={region.center[0]}
              y={region.center[1]}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#f1f5f9"
              fontSize={regionFontSize}
              fontWeight={isSelected ? 'bold' : 'normal'}
              pointerEvents="none"
              className="region-label"
            >
              {isMobile ? shortRegionName(region.name) : region.name.split(' ')[0]}
            </text>
          </g>
        );
      })}

      {neighbourStrip.map(region => (
        <text
          key={`nb_label_${region.id}`}
          x={region.center[0]}
          y={region.center[1]}
          fill="#94a3b8"
          fontSize={isMobile ? 8 : 7}
          textAnchor="middle"
          dominantBaseline="middle"
          pointerEvents="none"
          opacity={0.9}
        >
          {shortRegionName(region.name)}
        </text>
      ))}

      {layers.includes('military') && regions.map(region => (
        <g key={`mil_${region.id}`} pointerEvents="none" className="map-badge">
          <circle cx={region.center[0] + badgeOffsetX} cy={region.center[1] + badgeOffsetY} r={badgeR} fill="#ef4444" opacity="0.88" />
          <text x={region.center[0] + badgeOffsetX} y={region.center[1] + badgeOffsetY + 1} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={badgeFont} fontWeight="bold">
            {Math.round(region.garrison.troops / 1000)}k
          </text>
        </g>
      ))}

      {layers.includes('airDefense') && regions.map(region => {
        const rating = getDefenseSystemRating(region);
        if (rating === 0) return null;
        return (
          <g key={`ad_${region.id}`} className="map-badge">
            <circle cx={region.center[0] - badgeOffsetX} cy={region.center[1] + badgeOffsetY} r={badgeR} fill="#3b82f6" opacity="0.88" />
            <text x={region.center[0] - badgeOffsetX} y={region.center[1] + badgeOffsetY + 1} textAnchor="middle" dominantBaseline="middle" fill="white" fontSize={badgeFont}>{rating}</text>
            {state.showDefenseRanges && (
              <circle cx={region.center[0]} cy={region.center[1]} r={rating * 12} fill="none" stroke="#3b82f6" strokeWidth="0.5" opacity="0.25" />
            )}
          </g>
        );
      })}

      {layers.includes('drones') && regions.map(region => {
        if ((state.countries[region.controlledBy]?.militaryDev.droneProgram ?? 0) < 3) return null;
        return (
          <g key={`drone_${region.id}`} pointerEvents="none">
            <polygon points={`${region.center[0]},${region.center[1] + 12} ${region.center[0] - 5},${region.center[1] + 20} ${region.center[0] + 5},${region.center[1] + 20}`} fill="#a855f7" opacity="0.75" />
          </g>
        );
      })}

      {layers.includes('alliances') && regions.map(region => {
        const ownerAlliances = state.alliances.filter(a => a.members.includes(region.controlledBy));
        if (ownerAlliances.length === 0) return null;
        return (
          <g key={`ally_${region.id}`} pointerEvents="none" className="map-badge">
            <rect x={region.center[0] - 8} y={region.center[1] + 10} width="16" height="7" fill="#3b82f6" opacity="0.65" rx="2" />
            <text x={region.center[0]} y={region.center[1] + 15} textAnchor="middle" fill="white" fontSize="5" fontWeight="bold">
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

      {layers.includes('economic') && regions.map(region => {
        const built = region.facilities ?? [];
        const pending = (state.facilityBuilds ?? []).filter(
          b => b.regionId === region.id && b.completeTurn > state.turn
        );
        if (built.length === 0 && pending.length === 0) {
          return (
            <g key={`eco_${region.id}`} pointerEvents="none">
              <rect x={region.center[0] - 10} y={region.center[1] + 12} width="20" height="5" fill="#22c55e" opacity={Math.min(1, region.industryValue / 1000)} rx="1" />
            </g>
          );
        }
        return (
          <g key={`fac_${region.id}`} pointerEvents="none">
            {built.map((f, i) => (
              <text
                key={f.id}
                x={region.center[0] - 6 + i * 10}
                y={region.center[1] + 18}
                fontSize={isMobile ? 9 : 8}
                textAnchor="middle"
              >
                {FACILITY_DEFINITIONS[f.type].icon}
              </text>
            ))}
            {pending.map((b, i) => (
              <text
                key={b.id}
                x={region.center[0] + built.length * 10 + i * 8}
                y={region.center[1] + 18}
                fontSize={isMobile ? 8 : 7}
                fill="#fbbf24"
                textAnchor="middle"
              >
                🏗
              </text>
            ))}
          </g>
        );
      })}

      {regions.filter(r => r.unrest > 20).map(region => (
        <g key={`unrest_${region.id}`} pointerEvents="none">
          <text x={region.center[0]} y={region.center[1] + 22} textAnchor="middle" fill="#f59e0b" fontSize={isMobile ? 8 : 7}>⚠{region.unrest}%</text>
        </g>
      ))}

      {state.strikeAnimations.map(anim => {
        const target = state.regions[anim.targetRegionId];
        if (!target) return null;
        return (
          <g key={anim.id} pointerEvents="none">
            <circle cx={target.center[0]} cy={target.center[1]} r="12" fill="none" stroke={anim.intercepted ? '#3b82f6' : '#ef4444'} strokeWidth="2" opacity="0.8">
              <animate attributeName="r" from="5" to="22" dur="1s" repeatCount="2" />
              <animate attributeName="opacity" from="1" to="0" dur="1s" repeatCount="2" />
            </circle>
          </g>
        );
      })}
    </svg>
  );
}

export function NationalMap({ state, countryId, onBack, onRegionClick, backLabel = '← World Map' }: NationalMapProps) {
  const isMobile = useMobileLayout();
  const regions = getRegionsForCountry(countryId);
  const neighbourStrip = getNeighbourStrip(countryId);
  const country = state.countries[countryId];
  const layers = state.visibleLayers;
  const selectedRegion = state.selectedRegionId;
  const allMapRegions = [...regions, ...neighbourStrip];
  const viewBox = getNationalViewBox(allMapRegions, isMobile ? 36 : 32);

  const relevantFronts = state.fronts.filter(
    f =>
      regions.some(r => r.id === f.attackerRegionId || r.id === f.defenderRegionId) ||
      neighbourStrip.some(r => r.id === f.attackerRegionId || r.id === f.defenderRegionId)
  );

  const badgeR = isMobile ? 7 : 5;
  const badgeFont = isMobile ? 6 : 5;
  const badgeOffsetX = isMobile ? 14 : 12;
  const badgeOffsetY = isMobile ? -10 : -8;
  const regionFontSize = isMobile ? 10 : 8;
  const regionStroke = isMobile ? 1.5 : 1;

  if (regions.length === 0) {
    return (
      <div className="map-container national-map">
        <div className="national-map-header">
          <button className="btn-back" onClick={onBack}>{backLabel}</button>
          <h2>{country?.name}</h2>
        </div>
        <p className="muted no-regions-msg">No regional map data for this nation.</p>
      </div>
    );
  }

  return (
    <div className={`map-container national-map${isMobile ? ' national-map--mobile-fill' : ''}`}>
      <div className="national-map-header">
        <button className="btn-back" onClick={onBack}>{backLabel}</button>
        <h2>{country?.name}</h2>
        {relevantFronts.length > 0 && (
          <span className="front-count">{relevantFronts.length} active front{relevantFronts.length > 1 ? 's' : ''}</span>
        )}
      </div>

      <PanZoomMap enabled={isMobile}>
        <NationalMapSvg
          state={state}
          countryId={countryId}
          regions={regions}
          neighbourStrip={neighbourStrip}
          relevantFronts={relevantFronts}
          viewBox={viewBox}
          isMobile={isMobile}
          layers={layers}
          selectedRegion={selectedRegion}
          badgeR={badgeR}
          badgeFont={badgeFont}
          badgeOffsetX={badgeOffsetX}
          badgeOffsetY={badgeOffsetY}
          regionFontSize={regionFontSize}
          regionStroke={regionStroke}
          onRegionClick={onRegionClick}
        />
      </PanZoomMap>
    </div>
  );
}

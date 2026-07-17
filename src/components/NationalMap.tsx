import type { GameState, Region, Front, LayerCategory, FacilityType } from '../types/game';
import { getRegionsForCountry, getNeighbourStrip } from '../data/regions';
import { getDefenseSystemRating } from '../engine/economy';
import { useMobileLayout } from '../hooks/useMobileLayout';
import { getNationalViewBox, regionMapLabel } from '../utils/mapUtils';
import { PanZoomMap, useMapInteraction } from './PanZoomMap';
import {
  MapAtmosphereDefs,
  MapOcean,
  MAP_STROKE,
  terrainHatchUrl,
  useMapAtmosphereId,
} from './MapAtmosphere';

interface NationalMapProps {
  state: GameState;
  countryId: string;
  onBack: () => void;
  onRegionClick: (regionId: string) => void;
  backLabel?: string;
}

function FacilityMark({
  type,
  x,
  y,
  pending,
}: {
  type: FacilityType;
  x: number;
  y: number;
  pending?: boolean;
}) {
  const stroke = pending ? MAP_STROKE.brass : '#c8d9d0';
  const fill = pending ? 'rgba(201, 169, 106, 0.35)' : 'rgba(90, 158, 130, 0.45)';
  if (type === 'drone_factory') {
    return (
      <polygon
        points={`${x},${y - 4} ${x + 4},${y + 3} ${x - 4},${y + 3}`}
        fill={fill}
        stroke={stroke}
        strokeWidth="0.7"
      />
    );
  }
  if (type === 'missile_defense') {
    return <circle cx={x} cy={y} r="3.2" fill={fill} stroke={stroke} strokeWidth="0.7" />;
  }
  if (type === 'oil_gas') {
    return (
      <ellipse
        cx={x}
        cy={y}
        rx="3.4"
        ry="2.4"
        fill={fill}
        stroke={stroke}
        strokeWidth="0.7"
      />
    );
  }
  return (
    <rect
      x={x - 3}
      y={y - 3}
      width="6"
      height="6"
      rx="0.8"
      fill={fill}
      stroke={stroke}
      strokeWidth="0.7"
    />
  );
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
  const atmId = useMapAtmosphereId('nat');

  const handleRegionClick = (regionId: string) => {
    if (blockClickRef.current) return;
    onRegionClick(regionId);
  };

  return (
    <svg viewBox={viewBox} className="map-svg national-map-svg" preserveAspectRatio="xMidYMid meet">
      <MapAtmosphereDefs id={atmId} />
      <MapOcean id={atmId} x={-200} y={-200} width={900} height={700} dense />

      {neighbourStrip.map(region => (
        <g key={`nb_${region.id}`} className="neighbour-region" opacity={0.42}>
          <path
            d={region.mapPath}
            fill="#2a3d38"
            stroke={MAP_STROKE.neighbourDash}
            strokeWidth="1"
            strokeDasharray="3.5 2.5"
            strokeLinejoin="round"
          />
        </g>
      ))}

      {relevantFronts.map(front => {
        const atk = state.regions[front.attackerRegionId];
        const def = state.regions[front.defenderRegionId];
        if (!atk || !def) return null;
        const pressure = Math.abs(front.pressure);
        return (
          <g key={front.id} pointerEvents="none" className="map-front">
            <line
              x1={atk.center[0]}
              y1={atk.center[1]}
              x2={def.center[0]}
              y2={def.center[1]}
              stroke={MAP_STROKE.war}
              strokeWidth={2.2 + pressure / 20}
              opacity={0.18}
            />
            <line
              x1={atk.center[0]}
              y1={atk.center[1]}
              x2={def.center[0]}
              y2={def.center[1]}
              stroke={MAP_STROKE.war}
              strokeWidth={1.2 + pressure / 28}
              strokeDasharray="4 3"
              opacity={0.7}
              className="map-front-dash"
            />
          </g>
        );
      })}

      {regions.map(region => {
        const owner = state.countries[region.controlledBy];
        const isDisputed = region.controlledBy !== region.countryId;
        const isSelected = selectedRegion === region.id;
        const fill = isDisputed ? '#8a6230' : (owner?.color ?? '#334855');
        const edge = isSelected
          ? MAP_STROKE.brass
          : isDisputed
            ? MAP_STROKE.disputed
            : MAP_STROKE.ink;
        const hatch = terrainHatchUrl(atmId, region.terrain);

        return (
          <g
            key={region.id}
            onClick={() => handleRegionClick(region.id)}
            className={`region-group${isSelected ? ' is-selected' : ''}${isDisputed ? ' is-disputed' : ''}`}
          >
            <path
              d={region.mapPath}
              fill="none"
              stroke={MAP_STROKE.ink}
              strokeWidth={(isSelected ? 2.4 : regionStroke) + 1.2}
              strokeLinejoin="round"
              pointerEvents="none"
            />
            <path
              d={region.mapPath}
              fill={fill}
              stroke={edge}
              strokeWidth={isSelected ? 2.4 : regionStroke}
              strokeLinejoin="round"
              opacity={0.92}
              filter={`url(#${atmId}-land-inner)`}
            />
            {hatch && (
              <path d={region.mapPath} fill={hatch} stroke="none" pointerEvents="none" opacity={0.85} />
            )}
          </g>
        );
      })}

      {/* Labels render in their own pass, after every fill, so a later region's
          shape can never paint over an earlier region's name. */}
      {regions.map(region => (
        <text
          key={`label_${region.id}`}
          x={region.center[0]}
          y={region.center[1]}
          textAnchor="middle"
          dominantBaseline="middle"
          fill={selectedRegion === region.id ? MAP_STROKE.brass : '#e8eee9'}
          fontSize={regionFontSize}
          fontWeight={selectedRegion === region.id ? 700 : 500}
          pointerEvents="none"
          className="region-label map-label"
        >
          {regionMapLabel(region, regions, isMobile)}
        </text>
      ))}

      {neighbourStrip.map(region => (
        <text
          key={`nb_label_${region.id}`}
          x={region.center[0]}
          y={region.center[1]}
          fill="#8fa399"
          fontSize={isMobile ? 8 : 7}
          textAnchor="middle"
          dominantBaseline="middle"
          pointerEvents="none"
          opacity={0.85}
          className="map-label map-label--muted"
        >
          {regionMapLabel(region, neighbourStrip, true)}
        </text>
      ))}

      {layers.includes('military') &&
        regions.map(region => (
          <g key={`mil_${region.id}`} pointerEvents="none" className="map-badge map-badge--mil">
            <circle
              cx={region.center[0] + badgeOffsetX}
              cy={region.center[1] + badgeOffsetY}
              r={badgeR}
              fill="rgba(196, 92, 74, 0.88)"
              stroke={MAP_STROKE.ink}
              strokeWidth="0.7"
            />
            <text
              x={region.center[0] + badgeOffsetX}
              y={region.center[1] + badgeOffsetY + 1}
              textAnchor="middle"
              dominantBaseline="middle"
              fill="#f4ece8"
              fontSize={badgeFont}
              fontWeight="bold"
            >
              {Math.round(region.garrison.troops / 1000)}k
            </text>
          </g>
        ))}

      {layers.includes('airDefense') &&
        regions.map(region => {
          const rating = getDefenseSystemRating(region);
          if (rating === 0) return null;
          return (
            <g key={`ad_${region.id}`} className="map-badge map-badge--ad">
              <circle
                cx={region.center[0] - badgeOffsetX}
                cy={region.center[1] + badgeOffsetY}
                r={badgeR}
                fill="rgba(74, 122, 154, 0.9)"
                stroke={MAP_STROKE.ink}
                strokeWidth="0.7"
              />
              <text
                x={region.center[0] - badgeOffsetX}
                y={region.center[1] + badgeOffsetY + 1}
                textAnchor="middle"
                dominantBaseline="middle"
                fill="#e8eee9"
                fontSize={badgeFont}
              >
                {rating}
              </text>
              {state.showDefenseRanges && (
                <circle
                  cx={region.center[0]}
                  cy={region.center[1]}
                  r={rating * 12}
                  fill="none"
                  stroke="rgba(74, 122, 154, 0.35)"
                  strokeWidth="0.8"
                  strokeDasharray="3 2"
                />
              )}
            </g>
          );
        })}

      {layers.includes('drones') &&
        regions.map(region => {
          if ((state.countries[region.controlledBy]?.militaryDev.droneProgram ?? 0) < 3) return null;
          return (
            <g key={`drone_${region.id}`} pointerEvents="none">
              <polygon
                points={`${region.center[0]},${region.center[1] + 11} ${region.center[0] - 4.5},${region.center[1] + 19} ${region.center[0] + 4.5},${region.center[1] + 19}`}
                fill="rgba(90, 88, 104, 0.85)"
                stroke="#c8d9d0"
                strokeWidth="0.6"
              />
            </g>
          );
        })}

      {layers.includes('alliances') &&
        regions.map(region => {
          const ownerAlliances = state.alliances.filter(a => a.members.includes(region.controlledBy));
          if (ownerAlliances.length === 0) return null;
          return (
            <g key={`ally_${region.id}`} pointerEvents="none" className="map-badge">
              <rect
                x={region.center[0] - 9}
                y={region.center[1] + 10}
                width="18"
                height="7"
                fill="rgba(74, 106, 138, 0.75)"
                stroke={MAP_STROKE.ink}
                strokeWidth="0.5"
                rx="1"
              />
              <text
                x={region.center[0]}
                y={region.center[1] + 15}
                textAnchor="middle"
                fill="#e8eee9"
                fontSize="5"
                fontWeight="bold"
              >
                {ownerAlliances[0].id.toUpperCase().slice(0, 4)}
              </text>
            </g>
          );
        })}

      {layers.includes('events') &&
        state.activeEvents
          .filter(e => !e.resolved && e.targetCountryId === countryId)
          .map((evt, i) => (
            <g key={evt.eventId} pointerEvents="none" className="map-event-marker">
              <circle
                cx={30 + i * 18}
                cy={22}
                r="6.5"
                fill={MAP_STROKE.disputed}
                stroke={MAP_STROKE.ink}
                strokeWidth="0.8"
              />
              <text x={30 + i * 18} y={24} textAnchor="middle" fill="#0c1614" fontSize="8" fontWeight="bold">
                !
              </text>
            </g>
          ))}

      {layers.includes('economic') &&
        regions.map(region => {
          const built = region.facilities ?? [];
          const pending = (state.facilityBuilds ?? []).filter(
            b => b.regionId === region.id && b.completeTurn > state.turn
          );
          if (built.length === 0 && pending.length === 0) {
            return (
              <g key={`eco_${region.id}`} pointerEvents="none">
                <rect
                  x={region.center[0] - 10}
                  y={region.center[1] + 12}
                  width="20"
                  height="4"
                  fill="#5a9e82"
                  opacity={Math.min(1, region.industryValue / 1000)}
                  rx="0.5"
                />
              </g>
            );
          }
          return (
            <g key={`fac_${region.id}`} pointerEvents="none">
              {built.map((f, i) => (
                <FacilityMark
                  key={f.id}
                  type={f.type}
                  x={region.center[0] - 6 + i * 10}
                  y={region.center[1] + 16}
                />
              ))}
              {pending.map((b, i) => (
                <FacilityMark
                  key={b.id}
                  type={b.type}
                  x={region.center[0] + built.length * 10 + i * 8}
                  y={region.center[1] + 16}
                  pending
                />
              ))}
            </g>
          );
        })}

      {regions
        .filter(r => r.unrest > 20)
        .map(region => (
          <g key={`unrest_${region.id}`} pointerEvents="none">
            <text
              x={region.center[0]}
              y={region.center[1] + 22}
              textAnchor="middle"
              fill={MAP_STROKE.disputed}
              fontSize={isMobile ? 8 : 7}
              className="map-label"
            >
              {Math.round(region.unrest)}%
            </text>
          </g>
        ))}

      {state.strikeAnimations.map(anim => {
        const target = state.regions[anim.targetRegionId];
        if (!target) return null;
        return (
          <g key={anim.id} pointerEvents="none">
            <circle
              cx={target.center[0]}
              cy={target.center[1]}
              r="12"
              fill="none"
              stroke={anim.intercepted ? '#4a7a9a' : MAP_STROKE.war}
              strokeWidth="2"
              opacity="0.8"
            >
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
  const badgeOffsetX = isMobile ? 19 : 17;
  const badgeOffsetY = isMobile ? -15 : -13;
  const regionFontSize = isMobile ? 10 : 8;
  const regionStroke = isMobile ? 1.4 : 1.1;

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
    <div className={`map-container national-map national-map--fill`}>
      <div className="national-map-header">
        <button className="btn-back" onClick={onBack}>{backLabel}</button>
        <h2>{country?.name}</h2>
        {relevantFronts.length > 0 && (
          <span className="front-count">{relevantFronts.length} active front{relevantFronts.length > 1 ? 's' : ''}</span>
        )}
      </div>

      <PanZoomMap enabled showHint={isMobile}>
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

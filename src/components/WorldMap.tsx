import type { GameState, Country } from '../types/game';
import { getBlocColor } from '../engine/diplomacy';
import { WORLD_MAP_HEIGHT, WORLD_MAP_VIEWBOX, WORLD_MAP_WIDTH, getWorldMapShortLabel } from '../data/worldMap';
import { useMobileLayout } from '../hooks/useMobileLayout';
import { PanZoomMap, useMapInteraction } from './PanZoomMap';
import {
  MapAtmosphereDefs,
  MapOcean,
  MAP_STROKE,
  useMapAtmosphereId,
} from './MapAtmosphere';

interface WorldMapProps {
  state: GameState;
  onCountryClick: (countryId: string) => void;
}

function WorldMapSvg({
  state,
  countries,
  isMobile,
  onCountryClick,
}: {
  state: GameState;
  countries: Country[];
  isMobile: boolean;
  onCountryClick: (countryId: string) => void;
}) {
  const { blockClickRef } = useMapInteraction();
  const atmId = useMapAtmosphereId('world');
  const visibleIds = countries.map(c => c.id);

  const handleCountryClick = (countryId: string) => {
    if (blockClickRef.current) return;
    onCountryClick(countryId);
  };

  return (
    <svg
      viewBox={WORLD_MAP_VIEWBOX}
      className="map-svg world-map-svg"
      preserveAspectRatio="xMidYMid meet"
    >
      <MapAtmosphereDefs id={atmId} />
      <MapOcean id={atmId} width={WORLD_MAP_WIDTH} height={WORLD_MAP_HEIGHT} />

      {/* Soft continental shelf — denser coastlines read better with a foam fringe */}
      {countries.map(country => (
        <path
          key={`shelf_${country.id}`}
          d={country.worldMapPath}
          fill="none"
          stroke="rgba(180, 210, 200, 0.14)"
          strokeWidth={5.5}
          strokeLinejoin="round"
          pointerEvents="none"
        />
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
              className="map-war-line"
              stroke={MAP_STROKE.war}
              strokeWidth={1.6}
              strokeDasharray="5 5"
              opacity="0.55"
              pointerEvents="none"
            />
          );
        });
      })}

      {countries.map(country => {
        const fill = getBlocColor(state, country.id);
        const isPlayer = country.id === state.playerCountryId;
        const atWar = state.wars.some(w => w.belligerents.includes(country.id));
        const label = getWorldMapShortLabel(country.id, country.name);
        const fontSize = isMobile ? 10 : 9;
        const edge = isPlayer ? MAP_STROKE.brass : atWar ? MAP_STROKE.war : MAP_STROKE.ink;
        const strokeW = isPlayer ? 2.4 : atWar ? 1.8 : 1.1;

        return (
          <g
            key={country.id}
            className={`country-group${isPlayer ? ' is-player' : ''}${atWar ? ' is-war' : ''}`}
            onClick={() => handleCountryClick(country.id)}
          >
            <path
              d={country.worldMapPath}
              fill="none"
              stroke={MAP_STROKE.ink}
              strokeWidth={strokeW + 1.1}
              strokeLinejoin="round"
              opacity={country.playable ? 0.95 : 0.7}
              pointerEvents="none"
            />
            <path
              d={country.worldMapPath}
              fill={fill}
              stroke={edge}
              strokeWidth={strokeW * 0.9}
              strokeLinejoin="round"
              opacity={country.playable ? 0.94 : 0.55}
              className="country-path"
              filter={`url(#${atmId}-land-inner)`}
            />
            <text
              x={country.worldMapLabel[0]}
              y={country.worldMapLabel[1]}
              textAnchor="middle"
              dominantBaseline="middle"
              fill={isPlayer ? MAP_STROKE.brass : '#e8eee9'}
              fontSize={fontSize}
              fontWeight={isPlayer ? 700 : 500}
              pointerEvents="none"
              className="country-label map-label"
            >
              {label}
            </text>
            {atWar && (
              <circle
                cx={country.worldMapLabel[0] + 14}
                cy={country.worldMapLabel[1] - 12}
                r={isMobile ? 4 : 3.5}
                fill={MAP_STROKE.war}
                className="war-pulse"
                pointerEvents="none"
              />
            )}
          </g>
        );
      })}

      {state.activeEvents
        .filter(e => !e.resolved && e.targetCountryId && visibleIds.includes(e.targetCountryId))
        .slice(0, 8)
        .map(evt => {
          const country = state.countries[evt.targetCountryId!];
          if (!country) return null;
          return (
            <g key={evt.eventId} pointerEvents="none" className="map-event-marker">
              <circle
                cx={country.worldMapLabel[0] + 14}
                cy={country.worldMapLabel[1] - 12}
                r="5"
                fill={MAP_STROKE.disputed}
                stroke={MAP_STROKE.ink}
                strokeWidth="0.8"
              />
              <text
                x={country.worldMapLabel[0] + 14}
                y={country.worldMapLabel[1] - 9}
                textAnchor="middle"
                fill="#0c1614"
                fontSize="7"
                fontWeight="bold"
              >
                !
              </text>
            </g>
          );
        })}
    </svg>
  );
}

export function WorldMap({ state, onCountryClick }: WorldMapProps) {
  const isMobile = useMobileLayout();
  const countries = Object.values(state.countries);
  const nationCount = countries.length;
  const npcCount = countries.filter(c => !c.playable).length;

  return (
    <div className="map-container world-map world-map--fill">
      <div className="world-map-header">
        <h2>Strategic Map</h2>
        <span className="world-map-scope">
          {nationCount} nations · {npcCount} NPC · {isMobile ? 'pinch' : 'scroll'} to zoom · drag to pan
        </span>
      </div>

      <PanZoomMap enabled showHint={isMobile}>
        <WorldMapSvg
          state={state}
          countries={countries}
          isMobile={isMobile}
          onCountryClick={onCountryClick}
        />
      </PanZoomMap>
    </div>
  );
}

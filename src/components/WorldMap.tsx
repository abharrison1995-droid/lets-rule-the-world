import type { GameState, Country } from '../types/game';
import { getBlocColor } from '../engine/diplomacy';
import { HEMISPHERES, getCountriesInHemisphere, type HemisphereId } from '../data/hemispheres';
import { useMobileLayout } from '../hooks/useMobileLayout';
import { computeHemisphereViewBox } from '../utils/mapUtils';
import { PanZoomMap, useMapInteraction } from './PanZoomMap';
import {
  MapAtmosphereDefs,
  MapOcean,
  MAP_STROKE,
  useMapAtmosphereId,
} from './MapAtmosphere';

const FULL_VIEWBOX = '0 0 900 400';

interface WorldMapProps {
  state: GameState;
  onCountryClick: (countryId: string) => void;
  hemisphere?: HemisphereId;
  onBack?: () => void;
}

function WorldMapSvg({
  state,
  countries,
  visibleIds,
  viewBox,
  hemisphere,
  isMobile,
  onCountryClick,
}: {
  state: GameState;
  countries: Country[];
  visibleIds: string[];
  viewBox: string;
  hemisphere?: HemisphereId;
  isMobile: boolean;
  onCountryClick: (countryId: string) => void;
}) {
  const { blockClickRef } = useMapInteraction();
  const atmId = useMapAtmosphereId('world');

  const handleCountryClick = (countryId: string) => {
    if (blockClickRef.current) return;
    onCountryClick(countryId);
  };

  return (
    <svg
      viewBox={viewBox}
      className="map-svg world-map-svg"
      preserveAspectRatio="xMidYMid meet"
    >
      <MapAtmosphereDefs id={atmId} />
      <MapOcean id={atmId} width={900} height={400} />

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
              strokeWidth={hemisphere ? 2.2 : 1.6}
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
        const label = country.name.length > 12 ? country.name.split(' ')[0] : country.name;
        const fontSize = hemisphere ? (isMobile ? 13 : 11) : 9;
        const edge = isPlayer ? MAP_STROKE.brass : atWar ? MAP_STROKE.war : MAP_STROKE.ink;
        const strokeW = isPlayer ? 2.4 : atWar ? 1.8 : isMobile && hemisphere ? 1.4 : 1.1;

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
              strokeWidth={strokeW + 1.4}
              strokeLinejoin="round"
              opacity={country.playable ? 0.95 : 0.7}
              pointerEvents="none"
            />
            <path
              d={country.worldMapPath}
              fill={fill}
              stroke={edge}
              strokeWidth={strokeW}
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
                cx={country.worldMapLabel[0] + 16}
                cy={country.worldMapLabel[1] - 14}
                r={isMobile ? 4.5 : 3.5}
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
        .slice(0, 5)
        .map(evt => {
          const country = state.countries[evt.targetCountryId!];
          if (!country) return null;
          return (
            <g key={evt.eventId} pointerEvents="none" className="map-event-marker">
              <circle
                cx={country.worldMapLabel[0] + 16}
                cy={country.worldMapLabel[1] - 14}
                r="5.5"
                fill={MAP_STROKE.disputed}
                stroke={MAP_STROKE.ink}
                strokeWidth="0.8"
              />
              <text
                x={country.worldMapLabel[0] + 16}
                y={country.worldMapLabel[1] - 11}
                textAnchor="middle"
                fill="#0c1614"
                fontSize="8"
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

export function WorldMap({ state, onCountryClick, hemisphere, onBack }: WorldMapProps) {
  const isMobile = useMobileLayout();
  const allCountries = Object.values(state.countries);
  const visibleIds = hemisphere
    ? getCountriesInHemisphere(allCountries.map(c => c.id), hemisphere)
    : allCountries.map(c => c.id);
  const countries = allCountries.filter(c => visibleIds.includes(c.id));
  const viewBox = hemisphere ? computeHemisphereViewBox(countries) : FULL_VIEWBOX;
  const title = hemisphere ? HEMISPHERES[hemisphere].title : 'World Map';
  const panZoomEnabled = isMobile && !!hemisphere;

  return (
    <div className={`map-container world-map${hemisphere ? ' world-map--hemisphere' : ''}${panZoomEnabled ? ' world-map--mobile-fill' : ''}`}>
      {hemisphere && onBack && (
        <div className="national-map-header world-map-header">
          <button type="button" className="btn-back" onClick={onBack}>← Overview</button>
          <h2>{title}</h2>
        </div>
      )}

      <PanZoomMap enabled={panZoomEnabled}>
        <WorldMapSvg
          state={state}
          countries={countries}
          visibleIds={visibleIds}
          viewBox={viewBox}
          hemisphere={hemisphere}
          isMobile={isMobile}
          onCountryClick={onCountryClick}
        />
      </PanZoomMap>
    </div>
  );
}

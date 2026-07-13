import type { GameState, FacilityType } from '../types/game';
import { isAtWarWith } from '../engine/actions';
import type { StrikeType } from '../engine/strikes';
import { getStrikeOptions, getStrikeRange, getStrikeRangeLabel } from '../engine/strikes';
import { formatDisplayCost } from '../engine/treasuryDisplay';
import {
  FACILITY_DEFINITIONS,
  getFacilityDefs,
  hasFacilityInRegion,
  hasPendingBuild,
} from '../engine/facilities';

interface RegionActionPanelProps {
  state: GameState;
  regionId: string;
  onClose: () => void;
  onStrike: (regionId: string, strikeType: StrikeType) => void;
  onBuildFacility: (regionId: string, type: FacilityType) => void;
}

export function RegionActionPanel({ state, regionId, onClose, onStrike, onBuildFacility }: RegionActionPanelProps) {
  const region = state.regions[regionId];
  if (!region) return null;

  const owner = state.countries[region.controlledBy];
  const isEnemy = region.controlledBy !== state.playerCountryId;
  const isOwn = region.controlledBy === state.playerCountryId;
  const atWar = isEnemy && isAtWarWith(state, state.playerCountryId, region.controlledBy);
  const strikeOptions = getStrikeOptions(state, state.playerCountryId, regionId);
  const range = getStrikeRange(state, state.playerCountryId, regionId);
  const facilities = region.facilities ?? [];
  const pendingHere = (state.facilityBuilds ?? []).filter(
    b => b.regionId === regionId && b.completeTurn > state.turn
  );

  return (
    <div className="region-action-panel">
      <div className="panel-header">
        <h3>{region.name}</h3>
        <button className="btn-close" onClick={onClose}>×</button>
      </div>

      <div className="region-info">
        <p><span className="label">Owner:</span> {owner?.name}</p>
        <p><span className="label">Terrain:</span> {region.terrain}</p>
        <p><span className="label">Troops:</span> {region.garrison.troops.toLocaleString()}</p>
        <p><span className="label">Industry:</span> ${region.industryValue}B</p>
        {region.unrest > 0 && <p className="warning-text">Unrest: {region.unrest}%</p>}
        {facilities.length > 0 && (
          <p>
            <span className="label">Facilities:</span>{' '}
            {facilities.map(f => `${FACILITY_DEFINITIONS[f.type].icon} ${FACILITY_DEFINITIONS[f.type].label}`).join(', ')}
          </p>
        )}
        {pendingHere.map(b => (
          <p key={b.id} className="muted small">
            🏗 {FACILITY_DEFINITIONS[b.type].label} — {b.completeTurn - state.turn} turn(s) left
          </p>
        ))}
      </div>

      <div className="region-actions">
        {isEnemy && (
          <>
            <p className="strike-range-label muted small">
              Strike range: <strong>{getStrikeRangeLabel(range)}</strong>
              {!atWar && <span className="warning-text"> · Unprovoked</span>}
            </p>
            {strikeOptions.map(opt => (
              <button
                key={opt.type}
                className={`btn-action strike ${opt.available ? '' : 'disabled-option'}`}
                disabled={!opt.available}
                title={opt.blockReason ?? opt.description}
                onClick={() => onStrike(regionId, opt.type)}
              >
                ⚡ {opt.label} — {formatDisplayCost(opt.cost)}
                {!opt.available && opt.blockReason && (
                  <span className="strike-block-reason"> ({opt.blockReason})</span>
                )}
              </button>
            ))}
          </>
        )}
        {isOwn && (
          <section className="facility-build-section">
            <h4>Regional Construction</h4>
            <p className="muted small">Projects take multiple turns. Track progress in the Intel panel.</p>
            {getFacilityDefs().map(def => {
              const built = hasFacilityInRegion(state, regionId, def.type);
              const pending = hasPendingBuild(state, regionId, def.type);
              return (
                <button
                  key={def.type}
                  className="btn-action"
                  disabled={built || pending}
                  title={def.description}
                  onClick={() => onBuildFacility(regionId, def.type)}
                >
                  {def.icon} {def.label} — {formatDisplayCost(def.cost)} · {def.buildTurns}t
                  {built && ' (built)'}
                  {pending && ' (in progress)'}
                </button>
              );
            })}
          </section>
        )}
        {!isEnemy && !isOwn && (
          <p className="muted">Friendly territory — no hostile actions available.</p>
        )}
      </div>
    </div>
  );
}

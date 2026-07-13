import type { GameState } from '../types/game';
import { isAtWarWith } from '../engine/actions';
import type { StrikeType } from '../engine/strikes';
import { getStrikeOptions, getStrikeRange, getStrikeRangeLabel } from '../engine/strikes';

interface RegionActionPanelProps {
  state: GameState;
  regionId: string;
  onClose: () => void;
  onStrike: (regionId: string, strikeType: StrikeType) => void;
}

export function RegionActionPanel({ state, regionId, onClose, onStrike }: RegionActionPanelProps) {
  const region = state.regions[regionId];
  if (!region) return null;

  const owner = state.countries[region.controlledBy];
  const isEnemy = region.controlledBy !== state.playerCountryId;
  const atWar = isEnemy && isAtWarWith(state, state.playerCountryId, region.controlledBy);
  const strikeOptions = getStrikeOptions(state, state.playerCountryId, regionId);
  const range = getStrikeRange(state, state.playerCountryId, regionId);

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
                ⚡ {opt.label} — ${opt.cost}B
                {!opt.available && opt.blockReason && (
                  <span className="strike-block-reason"> ({opt.blockReason})</span>
                )}
              </button>
            ))}
          </>
        )}
        {!isEnemy && (
          <p className="muted">Friendly territory — no hostile actions available.</p>
        )}
      </div>
    </div>
  );
}

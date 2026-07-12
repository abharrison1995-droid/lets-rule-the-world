import type { GameState } from '../types/game';
import { isAtWarWith } from '../engine/actions';

interface RegionActionPanelProps {
  state: GameState;
  regionId: string;
  onClose: () => void;
  onStrike: (regionId: string) => void;
  onClosePanel: () => void;
}

export function RegionActionPanel({ state, regionId, onClose, onStrike }: RegionActionPanelProps) {
  const region = state.regions[regionId];
  if (!region) return null;

  const owner = state.countries[region.controlledBy];
  const isEnemy = region.controlledBy !== state.playerCountryId;
  const atWar = isEnemy && isAtWarWith(state, state.playerCountryId, region.controlledBy);
  const player = state.countries[state.playerCountryId];
  const strikeCost = 20 + (5 - (player?.militaryDev.strikeCapability ?? 1)) * 5;

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
          <button
            className="btn-action strike"
            onClick={() => onStrike(regionId)}
          >
            {atWar ? '⚡ Missile/Drone Strike' : '⚡ Strike (Unprovoked)'} — ${strikeCost}B
          </button>
        )}
        {!isEnemy && (
          <p className="muted">Friendly territory — no hostile actions available.</p>
        )}
      </div>
    </div>
  );
}

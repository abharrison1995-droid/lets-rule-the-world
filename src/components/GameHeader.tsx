import type { GameState } from '../types/game';
import { formatDisplayGDP } from '../engine/treasuryDisplay';
import { getActionEnergy } from '../engine/actionEnergy';
import { formatModeLabel } from '../data/gameModes';
import { getActiveMissionSummary } from '../engine/usaCampaign';

interface GameHeaderProps {
  state: GameState;
  onEndTurn: () => void;
  onOpenDiplomacy: () => void;
  onOpenEconomy: () => void;
  onOpenTheater?: () => void;
  /** Opens campaign mission sheet (Declare / Install / focus). */
  onOpenMission?: () => void;
  onSave: () => void;
  endTurnDisabled?: boolean;
}

export function GameHeader({
  state,
  onEndTurn,
  onOpenDiplomacy,
  onOpenEconomy,
  onOpenTheater,
  onOpenMission,
  onSave,
  endTurnDisabled = false,
}: GameHeaderProps) {
  const country = state.countries[state.playerCountryId];
  const atWar = state.wars.some(w => w.belligerents.includes(state.playerCountryId));
  const hasTheater = (state.warTheaters ?? []).some(t => !t.closed);
  const energy = getActionEnergy(state);
  const mission = getActiveMissionSummary(state);

  return (
    <header className="game-header">
      <div className="header-left">
        <h1 className="game-title">LET'S RULE THE WORLD</h1>
        <span className="turn-counter">Turn {state.turn}</span>
        <span className="mode-badge">{formatModeLabel(state.gameMode ?? 'sandbox')}</span>
        {mission &&
          (onOpenMission ? (
            <button
              type="button"
              className="mission-badge mission-badge-btn"
              title="Open campaign mission"
              onClick={onOpenMission}
            >
              {mission}
            </button>
          ) : (
            <span className="mission-badge" title="Active campaign mission">
              {mission}
            </span>
          ))}
      </div>

      <div className="header-center">
        <span className="nation-name" style={{ color: country?.color }}>{country?.name}</span>
        <span className="gdp-display">{formatDisplayGDP(country?.stats.treasuryPoints ?? 0)}</span>
        <span className="energy-display" title="Action energy — consequential moves cost energy each turn">
          ⚡ {energy.current}/{energy.max}
        </span>
        {atWar && <span className="war-badge">AT WAR</span>}
      </div>

      <div className="header-right">
        {hasTheater && onOpenTheater && (
          <button className="btn-header theater-btn" onClick={onOpenTheater}>Theater</button>
        )}
        <button className="btn-header" onClick={onOpenEconomy}>Economy</button>
        <button className="btn-header" onClick={onOpenDiplomacy}>Diplomacy</button>
        <button className="btn-header" onClick={onSave}>Save</button>
        <button
          className="btn-end-turn"
          onClick={onEndTurn}
          disabled={endTurnDisabled}
          title={endTurnDisabled ? 'Finish the briefing first' : undefined}
        >
          End Turn ▶
        </button>
      </div>
    </header>
  );
}

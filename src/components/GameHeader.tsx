import type { GameState } from '../types/game';
import { formatDisplayGDP } from '../engine/treasuryDisplay';
import { getActionEnergy } from '../engine/actionEnergy';

interface GameHeaderProps {
  state: GameState;
  onEndTurn: () => void;
  onOpenDiplomacy: () => void;
  onOpenEconomy: () => void;
  onOpenTheater?: () => void;
  onSave: () => void;
}

export function GameHeader({ state, onEndTurn, onOpenDiplomacy, onOpenEconomy, onOpenTheater, onSave }: GameHeaderProps) {
  const country = state.countries[state.playerCountryId];
  const atWar = state.wars.some(w => w.belligerents.includes(state.playerCountryId));
  const hasTheater = (state.warTheaters ?? []).some(t => !t.closed);
  const energy = getActionEnergy(state);

  return (
    <header className="game-header">
      <div className="header-left">
        <h1 className="game-title">LET'S RULE THE WORLD</h1>
        <span className="turn-counter">Turn {state.turn}</span>
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
        <button className="btn-end-turn" onClick={onEndTurn}>End Turn ▶</button>
      </div>
    </header>
  );
}

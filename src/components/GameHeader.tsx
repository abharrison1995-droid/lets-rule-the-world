import type { GameState } from '../types/game';
import { formatGDP } from '../engine/gameState';

interface GameHeaderProps {
  state: GameState;
  onEndTurn: () => void;
  onOpenDiplomacy: () => void;
  onOpenEconomy: () => void;
  onSave: () => void;
}

export function GameHeader({ state, onEndTurn, onOpenDiplomacy, onOpenEconomy, onSave }: GameHeaderProps) {
  const country = state.countries[state.playerCountryId];
  const atWar = state.wars.some(w => w.belligerents.includes(state.playerCountryId));

  return (
    <header className="game-header">
      <div className="header-left">
        <h1 className="game-title">LET'S RULE THE WORLD</h1>
        <span className="turn-counter">Turn {state.turn}</span>
      </div>

      <div className="header-center">
        <span className="nation-name" style={{ color: country?.color }}>{country?.name}</span>
        <span className="gdp-display">{formatGDP(country?.stats.gdp ?? 0)}</span>
        {atWar && <span className="war-badge">AT WAR</span>}
      </div>

      <div className="header-right">
        <button className="btn-header" onClick={onOpenEconomy}>Economy</button>
        <button className="btn-header" onClick={onOpenDiplomacy}>Diplomacy</button>
        <button className="btn-header" onClick={onSave}>Save</button>
        <button className="btn-end-turn" onClick={onEndTurn}>End Turn ▶</button>
      </div>
    </header>
  );
}

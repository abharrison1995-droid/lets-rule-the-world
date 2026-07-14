import type { GameMode } from '../types/game';
import { GAME_MODES } from '../data/gameModes';
import { AtlasBackdrop } from './AtlasBackdrop';

interface ModeSelectProps {
  onSelect: (mode: GameMode) => void;
  onBack: () => void;
}

export function ModeSelect({ onSelect, onBack }: ModeSelectProps) {
  return (
    <div className="title-root mode-select-root">
      <AtlasBackdrop />
      <div className="title-compose mode-select-compose">
        <button type="button" className="mode-select-back" onClick={onBack}>
          ← Title
        </button>
        <p className="end-brand mode-select-brand">
          Let&apos;s Rule <span className="end-brand-emphasis">the World</span>
        </p>
        <h1 className="mode-select-heading">Choose Game Type</h1>
        <p className="title-tagline mode-select-tagline">
          Sandbox keeps the full roster. Campaign narrows the board and scripts the opening war.
        </p>

        <div className="mode-select-options">
          {(['campaign', 'sandbox'] as GameMode[]).map(id => {
            const def = GAME_MODES[id];
            return (
              <button
                key={id}
                type="button"
                className={`mode-option mode-option--${id}`}
                onClick={() => onSelect(id)}
              >
                <span className="mode-option-name">{def.name}</span>
                <span className="mode-option-blurb">{def.blurb}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

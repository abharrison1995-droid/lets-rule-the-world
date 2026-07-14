import type { SaveSummary } from '../engine/saveLoad';
import { formatModeLabel } from '../data/gameModes';
import { AtlasBackdrop } from './AtlasBackdrop';

interface SaveSelectProps {
  saves: SaveSummary[];
  onLoad: (save: SaveSummary) => void;
  onBack: () => void;
  onDelete?: (save: SaveSummary) => void;
}

function formatSavedAt(timestamp: number): string {
  try {
    return new Date(timestamp).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return 'Unknown date';
  }
}

export function SaveSelect({ saves, onLoad, onBack, onDelete }: SaveSelectProps) {
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
        <h1 className="mode-select-heading">Load Game</h1>
        <p className="title-tagline mode-select-tagline">
          Resume a saved run. Each entry shows mode, nation, and turn.
        </p>

        <div className="mode-select-options">
          {saves.length === 0 && (
            <p className="muted" style={{ textAlign: 'center' }}>
              No saved games yet.
            </p>
          )}
          {saves.map(save => (
            <div key={`${save.slotId}-${save.timestamp}`} className="save-slot">
              <div className="save-slot-body">
                <span className="mode-option-name">{save.countryName}</span>
                <span className="mode-option-blurb">{save.description}</span>
                <span className="mode-option-meta">
                  {formatModeLabel(save.gameMode)}
                  <span aria-hidden="true"> · </span>
                  Turn {save.turn}
                  {save.ended ? ' · Ended' : ''}
                  <span aria-hidden="true"> · </span>
                  {formatSavedAt(save.timestamp)}
                </span>
              </div>
              <div className="save-slot-actions">
                <button
                  type="button"
                  className="title-cta title-cta-primary"
                  onClick={() => onLoad(save)}
                >
                  Load
                </button>
                {onDelete && (
                  <button
                    type="button"
                    className="title-cta title-cta-ghost"
                    onClick={() => onDelete(save)}
                  >
                    Delete
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

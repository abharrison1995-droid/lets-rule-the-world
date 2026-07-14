import { useState } from 'react';
import type { SaveSummary } from '../engine/saveLoad';
import { AtlasBackdrop } from './AtlasBackdrop';

interface TitleScreenProps {
  saveSummary: SaveSummary | null;
  onNewGame: () => void;
  onOpenSaves: () => void;
}

/** Full-bleed brand title — mode / campaign / saves follow. */
export function TitleScreen({ saveSummary, onNewGame, onOpenSaves }: TitleScreenProps) {
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);

  const requestNewGame = () => {
    if (saveSummary && !saveSummary.ended) {
      setConfirmOverwrite(true);
      return;
    }
    onNewGame();
  };

  return (
    <div className="title-root">
      <AtlasBackdrop />

      <div className="title-compose">
        <h1 className="title-brand">
          <span className="title-brand-line">Let&apos;s Rule</span>
          <span className="title-brand-line title-brand-emphasis">the World</span>
        </h1>
        <p className="title-tagline">
          Turn-based geopolitical strategy — seize the apparatus, shape the century.
        </p>

        <div className="title-ctas">
          {!confirmOverwrite ? (
            <>
              <button type="button" className="title-cta title-cta-primary" onClick={requestNewGame}>
                New Game
              </button>
              {saveSummary && (
                <button type="button" className="title-cta title-cta-continue" onClick={onOpenSaves}>
                  <span className="title-cta-label">Load Game</span>
                  <span className="title-save-meta">
                    {saveSummary.countryName} · Turn {saveSummary.turn}
                    {saveSummary.ended ? ' · Ended' : ''}
                  </span>
                </button>
              )}
            </>
          ) : (
            <div className="title-overwrite" role="alertdialog" aria-labelledby="overwrite-copy">
              <p id="overwrite-copy">Starting a new game will replace your current save when you commit to a campaign.</p>
              <div className="title-overwrite-actions">
                <button type="button" className="title-cta title-cta-primary" onClick={onNewGame}>
                  Continue to Setup
                </button>
                <button
                  type="button"
                  className="title-cta title-cta-ghost"
                  onClick={() => setConfirmOverwrite(false)}
                >
                  Keep Save
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

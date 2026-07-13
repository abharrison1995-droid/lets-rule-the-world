import { useState, useMemo } from 'react';
import { COUNTRIES } from '../data/countries';
import { getWinCondition } from '../data/winConditions';
import { createInitialState } from '../engine/gameState';
import { NationIntroModal } from './NationIntroModal';

interface NationSelectProps {
  onSelect: (countryId: string) => void;
  onLoad: () => void;
  hasSave: boolean;
}

export function NationSelect({ onSelect, onLoad, hasSave }: NationSelectProps) {
  const playable = Object.values(COUNTRIES).filter(c => c.playable);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const previewState = useMemo(
    () => (previewId ? createInitialState(previewId) : null),
    [previewId]
  );

  return (
    <div className="nation-select">
      <div className="title-screen">
        <h1>LET'S RULE THE WORLD</h1>
        <p className="subtitle">A turn-based geopolitical strategy game</p>

        {hasSave && (
          <button className="btn-load" onClick={onLoad}>Continue Saved Game</button>
        )}

        <h2>Choose Your Nation</h2>
        <p className="muted nation-select-hint">Tap a nation to preview — you can browse as many as you like before committing.</p>
        <div className="nation-grid">
          {playable.map(country => (
            <button
              key={country.id}
              type="button"
              className={`nation-card ${previewId === country.id ? 'selected' : ''}`}
              onClick={() => setPreviewId(country.id)}
              style={{ borderColor: country.color }}
            >
              <span className="nation-card-name" style={{ color: country.color }}>
                {country.name}
              </span>
              <span className="difficulty">
                {'★'.repeat(country.difficultyRating.score)}{'☆'.repeat(10 - country.difficultyRating.score)}
              </span>
              <span className="difficulty-blurb">{country.difficultyRating.blurb}</span>
              <span className="win-condition-blurb">
                🎯 {getWinCondition(country.id)?.description ?? 'Survive and expand.'}
              </span>
            </button>
          ))}
        </div>
      </div>

      {previewState && previewId && (
        <NationIntroModal
          state={previewState}
          mode="preview"
          onBack={() => setPreviewId(null)}
          onContinue={() => onSelect(previewId)}
        />
      )}
    </div>
  );
}

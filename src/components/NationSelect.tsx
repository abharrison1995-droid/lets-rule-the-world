import { useState, useMemo } from 'react';
import type { GameMode } from '../types/game';
import { getWinCondition } from '../data/winConditions';
import { getPlayableCountriesForMode, formatModeLabel } from '../data/gameModes';
import { createInitialState } from '../engine/gameState';
import { NationIntroModal } from './NationIntroModal';

interface NationSelectProps {
  gameMode: GameMode;
  onSelect: (countryId: string) => void;
  onBack: () => void;
}

export function NationSelect({ gameMode, onSelect, onBack }: NationSelectProps) {
  const playable = getPlayableCountriesForMode(gameMode);
  const [previewId, setPreviewId] = useState<string | null>(null);

  const previewState = useMemo(
    () => (previewId ? createInitialState(previewId, gameMode) : null),
    [previewId, gameMode]
  );

  return (
    <div className="nation-select">
      <div className="nation-select-shell">
        <button type="button" className="nation-select-back" onClick={onBack}>
          ← Game Type
        </button>
        <p className="nation-select-mode">{formatModeLabel(gameMode)}</p>
        <h2 className="nation-select-heading">Choose Your Nation</h2>
        <p className="muted nation-select-hint">
          {gameMode === 'campaign'
            ? 'Eastern Escalation seats — Ukraine theater opens hot for every run.'
            : 'Tap a nation to preview — browse freely before committing.'}
        </p>
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
                {'★'.repeat(country.difficultyRating.score)}
                {'☆'.repeat(10 - country.difficultyRating.score)}
              </span>
              <span className="difficulty-blurb">{country.difficultyRating.blurb}</span>
              <span className="win-condition-blurb">
                Goal: {getWinCondition(country.id)?.description ?? 'Survive and expand.'}
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

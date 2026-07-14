import type { GameState } from '../types/game';
import { AtlasBackdrop } from './AtlasBackdrop';

interface EndScreenProps {
  state: GameState;
  onReturnToTitle: () => void;
  onNewGame: () => void;
}

export function EndScreen({ state, onReturnToTitle, onNewGame }: EndScreenProps) {
  const victory = state.playerWon;
  const country = state.countries[state.playerCountryId];
  const countryName = country?.name ?? 'Your nation';
  const reason = victory
    ? (state.winReason ?? 'Strategic objectives secured.')
    : (state.gameOverReason ?? 'The campaign has ended.');

  const warsLed = state.wars.filter(w => w.belligerents.includes(state.playerCountryId)).length;
  const vassals = state.vassalRegions?.filter(v => v.overlordId === state.playerCountryId).length ?? 0;

  return (
    <div className={`end-root ${victory ? 'end-root--victory' : 'end-root--defeat'}`}>
      <AtlasBackdrop variant={victory ? 'victory' : 'defeat'} />

      <div className="end-compose">
        <p className="end-brand">
          Let&apos;s Rule <span className="end-brand-emphasis">the World</span>
        </p>

        <h1 className="end-outcome">{victory ? 'Victory' : 'Collapse'}</h1>

        <p className="end-reason">{reason}</p>

        <p className="end-meta">
          {countryName}
          <span className="end-meta-sep" aria-hidden="true">
            ·
          </span>
          Turn {state.turn}
          {warsLed > 0 && (
            <>
              <span className="end-meta-sep" aria-hidden="true">
                ·
              </span>
              {warsLed} active war{warsLed !== 1 ? 's' : ''}
            </>
          )}
          {vassals > 0 && (
            <>
              <span className="end-meta-sep" aria-hidden="true">
                ·
              </span>
              {vassals} vassal{vassals !== 1 ? 's' : ''}
            </>
          )}
        </p>

        <div className="end-ctas">
          <button type="button" className="title-cta title-cta-primary" onClick={onNewGame}>
            New Game
          </button>
          <button type="button" className="title-cta title-cta-ghost" onClick={onReturnToTitle}>
            Return to Title
          </button>
        </div>
      </div>
    </div>
  );
}

import type { GameState } from '../types/game';
import { NATION_INTROS, getNationStandingBullets } from '../data/nationIntros';

interface NationIntroModalProps {
  state: GameState;
  mode?: 'preview' | 'game_start';
  onBack?: () => void;
  onContinue: () => void;
}

export function NationIntroModal({
  state,
  mode = 'game_start',
  onBack,
  onContinue,
}: NationIntroModalProps) {
  const country = state.countries[state.playerCountryId];
  const intro = NATION_INTROS[state.playerCountryId];
  const bullets = getNationStandingBullets(state, state.playerCountryId);

  if (!country || !intro) return null;

  const isPreview = mode === 'preview';

  return (
    <div className="modal-overlay nation-intro-overlay">
      <div className="modal nation-intro-modal">
        <p className="nation-intro-nation" style={{ color: country.color }}>
          {country.name}
        </p>
        <blockquote className="nation-intro-quote">"{intro.quote}"</blockquote>
        {intro.subtitle && <p className="nation-intro-subtitle">{intro.subtitle}</p>}

        <section className="nation-intro-standing">
          <h3>{isPreview ? 'Opening Standing' : 'Your Standing'}</h3>
          <ul>
            {bullets.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </section>

        <div className="nation-intro-actions">
          {isPreview && onBack && (
            <button type="button" className="btn-header nation-intro-back" onClick={onBack}>
              ← Back to Nations
            </button>
          )}
          <button
            type="button"
            className="btn-end-turn nation-intro-continue"
            onClick={onContinue}
          >
            {isPreview ? 'Choose This Nation ▶' : 'Assume Command ▶'}
          </button>
        </div>
      </div>
    </div>
  );
}

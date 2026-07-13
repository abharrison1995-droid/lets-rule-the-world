import type { GameState } from '../types/game';
import { NATION_INTROS, getNationStandingBullets } from '../data/nationIntros';

interface NationIntroModalProps {
  state: GameState;
  onContinue: () => void;
}

export function NationIntroModal({ state, onContinue }: NationIntroModalProps) {
  const country = state.countries[state.playerCountryId];
  const intro = NATION_INTROS[state.playerCountryId];
  const bullets = getNationStandingBullets(state, state.playerCountryId);

  if (!country || !intro) return null;

  return (
    <div className="modal-overlay nation-intro-overlay">
      <div className="modal nation-intro-modal">
        <p className="nation-intro-nation" style={{ color: country.color }}>
          {country.name}
        </p>
        <blockquote className="nation-intro-quote">"{intro.quote}"</blockquote>
        {intro.subtitle && <p className="nation-intro-subtitle">{intro.subtitle}</p>}

        <section className="nation-intro-standing">
          <h3>Your Standing</h3>
          <ul>
            {bullets.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </section>

        <button className="btn-end-turn nation-intro-continue" onClick={onContinue}>
          Assume Command ▶
        </button>
      </div>
    </div>
  );
}

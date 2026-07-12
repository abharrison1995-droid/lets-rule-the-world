import { COUNTRIES } from '../data/countries';
import { getWinCondition } from '../data/winConditions';

interface NationSelectProps {
  onSelect: (countryId: string) => void;
  onLoad: () => void;
  hasSave: boolean;
}

export function NationSelect({ onSelect, onLoad, hasSave }: NationSelectProps) {
  const playable = Object.values(COUNTRIES).filter(c => c.playable);

  return (
    <div className="nation-select">
      <div className="title-screen">
        <h1>LET'S RULE THE WORLD</h1>
        <p className="subtitle">A turn-based geopolitical strategy game</p>

        {hasSave && (
          <button className="btn-load" onClick={onLoad}>Continue Saved Game</button>
        )}

        <h2>Choose Your Nation</h2>
        <div className="nation-grid">
          {playable.map(country => (
            <button
              key={country.id}
              className="nation-card"
              onClick={() => onSelect(country.id)}
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
    </div>
  );
}

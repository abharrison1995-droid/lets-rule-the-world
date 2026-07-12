import type { GameState } from '../types/game';
import { HEMISPHERES, type HemisphereId } from '../data/hemispheres';

interface HemisphereChooserProps {
  state: GameState;
  onSelect: (hemisphere: HemisphereId) => void;
}

function warCountInHemisphere(state: GameState, hemisphere: HemisphereId): number {
  const ids = new Set(HEMISPHERES[hemisphere].countryIds);
  return state.wars.filter(w => w.belligerents.some(b => ids.has(b))).length;
}

export function HemisphereChooser({ state, onSelect }: HemisphereChooserProps) {
  const playerHemisphere = HEMISPHERES.americas.countryIds.includes(state.playerCountryId)
    ? 'americas'
    : 'eurasia';

  return (
    <div className="map-container hemisphere-chooser">
      <div className="hemisphere-chooser-header">
        <h2>World Map</h2>
        <p className="muted">Choose a region to explore</p>
      </div>

      <div className="hemisphere-cards">
        {(Object.values(HEMISPHERES) as typeof HEMISPHERES.americas[]).map(hem => {
          const wars = warCountInHemisphere(state, hem.id);
          const nationCount = hem.countryIds.filter(id => state.countries[id]).length;
          const isPlayerTheatre = hem.id === playerHemisphere;

          return (
            <button
              key={hem.id}
              type="button"
              className={`hemisphere-card hemisphere-card--${hem.id}${isPlayerTheatre ? ' hemisphere-card--player' : ''}`}
              onClick={() => onSelect(hem.id)}
            >
              <span className="hemisphere-card-title">{hem.title}</span>
              <span className="hemisphere-card-sub">{hem.subtitle}</span>
              <span className="hemisphere-card-meta">
                {nationCount} nations
                {wars > 0 && <span className="hemisphere-card-war"> · {wars} war{wars > 1 ? 's' : ''}</span>}
              </span>
              {isPlayerTheatre && <span className="hemisphere-card-badge">Your theatre</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

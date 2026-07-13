import type { GameState } from '../types/game';
import { getAllRelationsForCountry } from '../engine/diplomacy';
import { isAtWarWith } from '../engine/actions';
import { getWarsRemaining } from '../engine/warDeclaration';

interface PressConferenceScreenProps {
  state: GameState;
  onBack: () => void;
  onRequestWar: (targetId: string) => void;
}

export function PressConferenceScreen({ state, onBack, onRequestWar }: PressConferenceScreenProps) {
  const relations = getAllRelationsForCountry(state, state.playerCountryId);
  const warTargets = relations.filter(r => !isAtWarWith(state, state.playerCountryId, r.countryId));
  const warsRemaining = getWarsRemaining(state, state.playerCountryId);
  const warCap = warsRemaining + state.warsDeclaredThisTurn;

  return (
    <div className="diplomacy-subscreen press-conference-screen">
      <div className="subscreen-header">
        <button className="btn-back" onClick={onBack}>← Back</button>
        <h3>Press Conference</h3>
      </div>

      <p className="press-lead">
        Address the world. Public declarations carry weight — and consequences.
      </p>

      <div className="press-podium">
        <span className="podium-icon">🎙️</span>
        <span className="podium-label">{state.countries[state.playerCountryId]?.name} addresses the press</span>
      </div>

      <section className="panel-section">
        <h4>Declare War</h4>
        <p className="muted">
          {state.warsDeclaredThisTurn} of {warCap} war declaration{warCap !== 1 ? 's' : ''} used this turn
          {warsRemaining > 0 ? ` · ${warsRemaining} remaining` : ' · limit reached'}
        </p>
        {state.internationalPariahTurns > 0 && (
          <p className="warning">
            Under global condemnation ({state.internationalPariahTurns} turns left)
          </p>
        )}
        {warTargets.length === 0 ? (
          <p className="muted">No nations available to declare war on.</p>
        ) : (
          <div className="press-target-list">
            {warTargets.map(r => (
              <button
                key={r.countryId}
                className="btn-press-action war"
                disabled={warsRemaining <= 0}
                onClick={() => onRequestWar(r.countryId)}
              >
                ⚔ Declare war on {r.name}
                <span className={`relation-badge ${r.value >= 0 ? 'positive' : 'negative'}`}>
                  {r.value > 0 ? '+' : ''}{r.value}
                </span>
              </button>
            ))}
          </div>
        )}
      </section>

      <section className="panel-section">
        <h4>Public statements</h4>
        <p className="muted">Additional press actions coming in a future update.</p>
        <button className="btn-press-action" disabled>📢 Condemn aggression</button>
        <button className="btn-press-action" disabled>🤝 Announce summit</button>
      </section>
    </div>
  );
}

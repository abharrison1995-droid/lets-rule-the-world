import type { GameState } from '../types/game';
import { getRelation } from '../data/relations';

interface TalksScreenProps {
  state: GameState;
  targetId: string;
  onBack: () => void;
}

export function TalksScreen({ state, targetId, onBack }: TalksScreenProps) {
  const target = state.countries[targetId];
  if (!target) return null;

  const relation = getRelation(state.relations, state.playerCountryId, targetId);
  const relationPct = Math.max(0, Math.min(100, (relation + 100) / 2));
  const difficulty = target.difficultyRating;

  return (
    <div className="diplomacy-subscreen talks-screen">
      <div className="subscreen-header">
        <button className="btn-back" onClick={onBack}>← Back</button>
        <h3>Talks with {target.name}</h3>
      </div>

      <div className="talks-stage">
        <div className="talks-figures">
          <div className="diplomat-silhouette player" title="Your diplomat">
            <span className="silhouette-icon">🧑‍💼</span>
            <span className="silhouette-label">Your envoy</span>
          </div>
          <div className="talks-divider">⟷</div>
          <div className="diplomat-silhouette target">
            <span
              className="nation-emblem"
              style={{ backgroundColor: target.color }}
              title={target.name}
            />
            <span className="silhouette-icon">🧑‍💼</span>
            <span className="silhouette-label">{target.name}</span>
          </div>
        </div>

        <div className="relation-bar-container">
          <div className="relation-bar-label">
            <span>Relations</span>
            <span className={relation >= 0 ? 'positive' : 'negative'}>
              {relation > 0 ? '+' : ''}{relation}
            </span>
          </div>
          <div className="relation-bar-track">
            <div
              className={`relation-bar-fill ${relation >= 0 ? 'positive' : 'negative'}`}
              style={{ width: `${relationPct}%` }}
            />
          </div>
        </div>

        <div className="negotiator-difficulty">
          <span className="difficulty-label">Negotiator difficulty</span>
          <span className="difficulty-score">{difficulty.score}/10</span>
          <p className="muted">{difficulty.blurb}</p>
        </div>
      </div>

      <section className="panel-section talks-options">
        <h4>Speech options</h4>
        <p className="muted talks-coming-soon">Formal negotiations arrive in a future update. For now, use the Press Conference for public moves.</p>
        <div className="talks-option-grid">
          <button className="btn-talk-option" disabled title="Coming in E3">
            🕊️ Propose peace terms
          </button>
          <button className="btn-talk-option" disabled title="Coming in E3">
            🤝 Discuss alliance
          </button>
          <button className="btn-talk-option" disabled title="Coming in E3">
            📜 Trade agreement
          </button>
          <button className="btn-talk-option" disabled title="Coming in E3">
            ⚠️ Issue ultimatum
          </button>
        </div>
      </section>
    </div>
  );
}

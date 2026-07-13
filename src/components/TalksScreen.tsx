import { useState } from 'react';
import type { GameState, TalkOptionId, PeaceTermsType, CovertTalkOptionId } from '../types/game';
import { getRelation } from '../data/relations';
import { isAtWarWith } from '../engine/actions';
import {
  getNegotiationPreview,
  getAgreementsWithNation,
  getPeaceOptions,
} from '../engine/talks';
import {
  getCovertNegotiationPreview,
  getCovertAlliancesWithNation,
  COVERT_OPTION_ORDER,
} from '../engine/covertAlliances';
import { getPendingMissions, getTurnsUntilResolution } from '../engine/diplomaticMissions';
import { FiscalImpactLine } from './FiscalImpactLine';

interface TalksScreenProps {
  state: GameState;
  targetId: string;
  onBack: () => void;
  onNegotiate: (option: TalkOptionId, peaceTerms?: PeaceTermsType) => void;
  onCovertNegotiate: (option: CovertTalkOptionId) => void;
  lastResult: string | null;
}

const OPTION_ICONS: Record<TalkOptionId, string> = {
  peace: '🕊️',
  military_pact: '🤝',
  trade_deal: '📜',
  intel_sharing: '🔍',
  ultimatum: '⚠️',
};

const COVERT_ICONS: Record<CovertTalkOptionId, string> = {
  covert_trade: '📜',
  covert_military: '⚔',
  covert_intel: '🔍',
};

const PEACE_LABELS: Record<PeaceTermsType, string> = {
  white_peace: 'White Peace',
  ceasefire: 'Ceasefire',
  reparations: 'Demand Reparations',
};

const OPTION_ORDER: TalkOptionId[] = ['peace', 'military_pact', 'trade_deal', 'intel_sharing', 'ultimatum'];

export function TalksScreen({
  state,
  targetId,
  onBack,
  onNegotiate,
  onCovertNegotiate,
  lastResult,
}: TalksScreenProps) {
  const [selectedOption, setSelectedOption] = useState<TalkOptionId | null>(null);
  const [selectedCovert, setSelectedCovert] = useState<CovertTalkOptionId | null>(null);
  const [peaceTerms, setPeaceTerms] = useState<PeaceTermsType | ''>('');

  const target = state.countries[targetId];
  if (!target) return null;

  const relation = getRelation(state.relations, state.playerCountryId, targetId);
  const relationPct = Math.max(0, Math.min(100, (relation + 100) / 2));
  const difficulty = target.difficultyRating;
  const atWar = isAtWarWith(state, state.playerCountryId, targetId);
  const existingAlliance = state.alliances.find(
    a => a.members.includes(state.playerCountryId) && a.members.includes(targetId)
  );
  const bilateralAgreements = getAgreementsWithNation(state, state.playerCountryId, targetId);
  const covertAgreements = getCovertAlliancesWithNation(state, state.playerCountryId, targetId);
  const pendingMissions = getPendingMissions(state).filter(m => m.targetNationId === targetId);

  const preview = selectedOption
    ? getNegotiationPreview(
        state,
        state.playerCountryId,
        targetId,
        selectedOption,
        selectedOption === 'peace' && peaceTerms ? peaceTerms : undefined
      )
    : null;

  const covertPreview = selectedCovert
    ? getCovertNegotiationPreview(state, state.playerCountryId, targetId, selectedCovert)
    : null;

  const peaceOptions = atWar ? getPeaceOptions(state, targetId) : [];

  const handleSubmit = () => {
    if (!selectedOption) return;
    if (selectedOption === 'peace' && !peaceTerms) return;
    onNegotiate(selectedOption, peaceTerms || undefined);
    setSelectedOption(null);
    setSelectedCovert(null);
    setPeaceTerms('');
  };

  const handleCovertSubmit = () => {
    if (!selectedCovert) return;
    onCovertNegotiate(selectedCovert);
    setSelectedCovert(null);
    setSelectedOption(null);
  };

  const selectOvert = (opt: TalkOptionId) => {
    setSelectedOption(opt);
    setSelectedCovert(null);
    if (opt !== 'peace') setPeaceTerms('');
  };

  const selectCovert = (opt: CovertTalkOptionId) => {
    setSelectedCovert(opt);
    setSelectedOption(null);
    setPeaceTerms('');
  };

  return (
    <div className="diplomacy-subscreen talks-screen">
      <div className="subscreen-header">
        <button className="btn-back" onClick={onBack}>← Back</button>
        <h3>Talks with {target.name}</h3>
      </div>

      {lastResult && <p className="talks-result">{lastResult}</p>}

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

      {(existingAlliance || bilateralAgreements.length > 0 || covertAgreements.length > 0) && (
        <section className="panel-section talks-existing">
          <h4>Active agreements</h4>
          {existingAlliance && (
            <span className="agreement-chip military">
              🤝 {existingAlliance.tier.replace('_', ' ')}
            </span>
          )}
          {bilateralAgreements.map(ag => (
            <span key={ag.id} className={`agreement-chip ${ag.type}`}>
              {ag.type === 'trade' ? '📜 Trade' : '🔍 Intel'}
            </span>
          ))}
          {covertAgreements.map(ag => (
            <span key={ag.id} className="agreement-chip covert">
              🔒 {ag.type}
            </span>
          ))}
        </section>
      )}

      {pendingMissions.length > 0 && (
        <section className="panel-section talks-pending">
          <h4>Envoys en route</h4>
          {pendingMissions.map(m => (
            <div key={m.id} className="mission-pending-row">
              <span>{m.type.replace(/_/g, ' ')}</span>
              <span className="muted">
                Returns turn {m.resolveTurn} ({getTurnsUntilResolution(state, m)}t left)
              </span>
            </div>
          ))}
        </section>
      )}

      <section className="panel-section talks-options">
        <h4>Speech options</h4>
        <div className="talks-option-grid">
          {OPTION_ORDER.map(opt => {
            const optPreview = getNegotiationPreview(state, state.playerCountryId, targetId, opt);
            const hidden = opt === 'peace' && !atWar;
            const ultimatumHidden = opt === 'ultimatum' && atWar;
            if (hidden || ultimatumHidden) return null;
            return (
              <button
                key={opt}
                className={`btn-talk-option ${selectedOption === opt ? 'selected' : ''}`}
                disabled={!optPreview.canAttempt}
                onClick={() => selectOvert(opt)}
                title={optPreview.blockReason}
              >
                {OPTION_ICONS[opt]} {optPreview.label}
                {optPreview.cost > 0 && <span className="talk-cost">${optPreview.cost}B</span>}
              </button>
            );
          })}
        </div>
      </section>

      {selectedOption && preview && (
        <section className="panel-section talks-preview">
          <h4>Proposal preview</h4>
          <p className="muted">{preview.description}</p>

          {selectedOption === 'peace' && (
            <div className="peace-terms-select">
              <label className="muted">Peace terms</label>
              <select
                className="target-select"
                value={peaceTerms}
                onChange={e => setPeaceTerms(e.target.value as PeaceTermsType)}
              >
                <option value="">Select terms...</option>
                {peaceOptions.map(terms => (
                  <option key={terms} value={terms}>{PEACE_LABELS[terms]}</option>
                ))}
              </select>
            </div>
          )}

          <div className="preview-stats">
            <span>
              Acceptance:{' '}
              <strong>
                {selectedOption === 'peace' && !peaceTerms
                  ? '—'
                  : `${preview.acceptanceChance}%`}
              </strong>
            </span>
            <span>⚡ {preview.energyCost} energy</span>
            <span>{preview.durationTurns} turn{preview.durationTurns !== 1 ? 's' : ''}</span>
            {preview.cost > 0 && <span>${preview.cost}B</span>}
          </div>

          <ul className="preview-effects">
            {preview.effects.map((effect, i) => (
              <li key={i}>{effect}</li>
            ))}
          </ul>

          <FiscalImpactLine fiscal={preview.fiscal} />

          {preview.blockReason && <p className="warning">{preview.blockReason}</p>}

          <button
            className="btn-action talks-submit"
            disabled={!preview.canAttempt || (selectedOption === 'peace' && !peaceTerms)}
            onClick={handleSubmit}
          >
            Dispatch envoy
          </button>
        </section>
      )}

      <section className="panel-section talks-options covert-section">
        <h4>Covert backchannel 🔒</h4>
        <p className="muted covert-lead">Secret envoys take time. Invisible unless exposed.</p>
        <div className="talks-option-grid">
          {COVERT_OPTION_ORDER.map(opt => {
            const optPreview = getCovertNegotiationPreview(state, state.playerCountryId, targetId, opt);
            return (
              <button
                key={opt}
                className={`btn-talk-option covert ${selectedCovert === opt ? 'selected' : ''}`}
                disabled={!optPreview.canAttempt}
                onClick={() => selectCovert(opt)}
                title={optPreview.blockReason}
              >
                {COVERT_ICONS[opt]} 🔒 {optPreview.label}
                <span className="talk-cost">${optPreview.cost}B</span>
              </button>
            );
          })}
        </div>
      </section>

      {selectedCovert && covertPreview && (
        <section className="panel-section talks-preview covert-preview">
          <h4>Covert proposal preview</h4>
          <p className="muted">{covertPreview.description}</p>

          <div className="preview-stats">
            <span>Acceptance: <strong>{covertPreview.acceptanceChance}%</strong></span>
            <span>⚡ {covertPreview.energyCost} energy</span>
            <span>{covertPreview.durationTurns} turns</span>
            <span>${covertPreview.cost}B</span>
            <span className="warning">Leak: {covertPreview.exposureRisk}%/turn</span>
          </div>

          <ul className="preview-effects">
            {covertPreview.effects.map((effect, i) => (
              <li key={i}>{effect}</li>
            ))}
          </ul>

          <FiscalImpactLine fiscal={covertPreview.fiscal} />

          {covertPreview.blockReason && <p className="warning">{covertPreview.blockReason}</p>}

          <button
            className="btn-action talks-submit covert"
            disabled={!covertPreview.canAttempt}
            onClick={handleCovertSubmit}
          >
            🔒 Send covert envoy
          </button>
        </section>
      )}
    </div>
  );
}

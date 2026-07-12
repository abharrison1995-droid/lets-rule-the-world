import { useState } from 'react';
import type { GameState } from '../types/game';
import type { PeaceTermsType } from '../types/game';
import { getAllRelationsForCountry } from '../engine/diplomacy';
import { getMechanicsForNation } from '../data/mechanics';
import { isAtWarWith } from '../engine/actions';
import { getPeaceOptions } from '../engine/peace';

interface DiplomacyPanelProps {
  state: GameState;
  onClose: () => void;
  onDeclareWar: (targetId: string) => void;
  onProposePeace: (targetId: string, terms: PeaceTermsType) => void;
  onCovertOp: (targetId: string) => void;
  onExecuteMechanic: (mechanicId: string, targetId?: string) => void;
  feedback: string | null;
}

const PEACE_LABELS: Record<PeaceTermsType, string> = {
  white_peace: 'White Peace',
  ceasefire: 'Ceasefire',
  reparations: 'Demand Reparations',
};

export function DiplomacyPanel({
  state,
  onClose,
  onDeclareWar,
  onProposePeace,
  onCovertOp,
  onExecuteMechanic,
  feedback,
}: DiplomacyPanelProps) {
  const [mechanicTarget, setMechanicTarget] = useState('');
  const [peaceTarget, setPeaceTarget] = useState('');
  const relations = getAllRelationsForCountry(state, state.playerCountryId);
  const alliances = state.alliances.filter(a => a.members.includes(state.playerCountryId));
  const mechanics = getMechanicsForNation(state.playerCountryId);

  const atWarNations = relations.filter(r =>
    isAtWarWith(state, state.playerCountryId, r.countryId)
  );

  return (
    <div className="panel diplomacy-panel">
      <div className="panel-header">
        <h3>Diplomacy & Actions</h3>
        <button className="btn-close" onClick={onClose}>×</button>
      </div>

      {feedback && <p className="feedback-msg">{feedback}</p>}

      {atWarNations.length > 0 && (
        <section className="panel-section peace-section">
          <h4>Peace Negotiations</h4>
          <select className="target-select" value={peaceTarget} onChange={e => setPeaceTarget(e.target.value)}>
            <option value="">Select wartime opponent...</option>
            {atWarNations.map(r => (
              <option key={r.countryId} value={r.countryId}>{r.name}</option>
            ))}
          </select>
          {peaceTarget && getPeaceOptions(state, peaceTarget).map(terms => (
            <button
              key={terms}
              className="btn-action peace"
              onClick={() => onProposePeace(peaceTarget, terms)}
            >
              🤝 {PEACE_LABELS[terms]}
            </button>
          ))}
        </section>
      )}

      <section className="panel-section">
        <h4>Alliances</h4>
        {alliances.length === 0 ? (
          <p className="muted">No active alliances.</p>
        ) : (
          alliances.map(a => (
            <div key={a.id} className="alliance-row">
              <span className="alliance-name">{a.name}</span>
              <span className="alliance-tier">{a.tier.replace('_', ' ')}</span>
              <span className="alliance-members">
                {a.members.map(m => state.countries[m]?.name).join(', ')}
              </span>
            </div>
          ))
        )}
      </section>

      <section className="panel-section">
        <h4>Relations & War</h4>
        <div className="relations-table">
          <div className="relations-header">
            <span>Nation</span>
            <span>Score</span>
            <span>Actions</span>
          </div>
          {relations.map(r => {
            const atWar = isAtWarWith(state, state.playerCountryId, r.countryId);
            return (
              <div key={r.countryId} className="relation-row">
                <span>{r.name}</span>
                <span className={`relation-value ${r.value > 0 ? 'positive' : r.value < 0 ? 'negative' : ''}`}>
                  {r.value > 0 ? '+' : ''}{r.value}
                </span>
                <span className="relation-actions">
                  {!atWar && (
                    <button className="btn-small war" onClick={() => onDeclareWar(r.countryId)} title="Declare war">⚔</button>
                  )}
                  {atWar && <span className="war-active">AT WAR</span>}
                  <button className="btn-small covert" onClick={() => onCovertOp(r.countryId)} title="Covert op">🕵</button>
                </span>
              </div>
            );
          })}
        </div>
      </section>

      {mechanics.length > 0 && (
        <section className="panel-section">
          <h4>Special Actions</h4>
          <select className="target-select" value={mechanicTarget} onChange={e => setMechanicTarget(e.target.value)}>
            <option value="">Select target nation...</option>
            {relations.map(r => (
              <option key={r.countryId} value={r.countryId}>{r.name}</option>
            ))}
          </select>
          {mechanics.map(m => {
            const lastUsed = state.mechanicCooldowns[m.id] ?? 0;
            const cdRemaining = Math.max(0, m.cooldown - (state.turn - lastUsed));
            const needsTarget = m.category === 'covert' || m.category === 'military';
            return (
              <div key={m.id} className="mechanic-row">
                <strong>{m.name}</strong>
                <span className="muted">{m.description}</span>
                <span className="mechanic-cost">${m.cost}B · CD: {cdRemaining > 0 ? `${cdRemaining}t` : 'ready'}</span>
                <button
                  className="btn-action"
                  disabled={cdRemaining > 0 || (needsTarget && !mechanicTarget)}
                  onClick={() => onExecuteMechanic(m.id, mechanicTarget || undefined)}
                >
                  Execute
                </button>
              </div>
            );
          })}
        </section>
      )}
    </div>
  );
}

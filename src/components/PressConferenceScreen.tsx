import { useState } from 'react';
import type { GameState, PressActionId } from '../types/game';
import { getAllRelationsForCountry } from '../engine/diplomacy';
import { isAtWarWith } from '../engine/actions';
import { getWarsRemaining } from '../engine/warDeclaration';
import {
  getPressActionPreview,
  PRESS_ACTION_ORDER,
} from '../engine/pressActions';

interface PressConferenceScreenProps {
  state: GameState;
  onBack: () => void;
  onRequestWar: (targetId: string) => void;
  onPressAction: (actionId: PressActionId, targetId: string) => void;
}

const PRESS_ICONS: Record<PressActionId, string> = {
  condemn_aggression: '📢',
  announce_summit: '🤝',
  social_media_flood: '📱',
  info_ops_leak: '🔓',
};

export function PressConferenceScreen({
  state,
  onBack,
  onRequestWar,
  onPressAction,
}: PressConferenceScreenProps) {
  const [pressTarget, setPressTarget] = useState('');
  const [selectedAction, setSelectedAction] = useState<PressActionId | null>(null);

  const relations = getAllRelationsForCountry(state, state.playerCountryId);
  const warTargets = relations.filter(r => !isAtWarWith(state, state.playerCountryId, r.countryId));
  const warsRemaining = getWarsRemaining(state, state.playerCountryId);
  const warCap = warsRemaining + state.warsDeclaredThisTurn;

  const nationsAtWar = relations.filter(r =>
    state.wars.some(w => w.belligerents.includes(r.countryId))
  );

  const preview = selectedAction && pressTarget
    ? getPressActionPreview(state, selectedAction, pressTarget)
    : null;

  return (
    <div className="diplomacy-subscreen press-conference-screen">
      <div className="subscreen-header">
        <button className="btn-back" onClick={onBack}>← Back</button>
        <h3>Press Conference</h3>
      </div>

      <p className="press-lead">
        Address the world. Public declarations carry weight — war is instant; other moves cost energy and funds.
      </p>

      <div className="press-podium">
        <span className="podium-icon">🎙️</span>
        <span className="podium-label">{state.countries[state.playerCountryId]?.name} addresses the press</span>
      </div>

      <section className="panel-section">
        <h4>Declare War</h4>
        <p className="muted">
          Instant · ⚡ 2 energy · {state.warsDeclaredThisTurn} of {warCap} used this turn
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
        <select className="target-select" value={pressTarget} onChange={e => setPressTarget(e.target.value)}>
          <option value="">Select target nation...</option>
          {relations.map(r => (
            <option key={r.countryId} value={r.countryId}>{r.name}</option>
          ))}
        </select>

        <div className="press-action-grid">
          {PRESS_ACTION_ORDER.map(actionId => {
            const p = pressTarget
              ? getPressActionPreview(state, actionId, pressTarget)
              : null;
            const needsWarTarget = actionId === 'condemn_aggression';
            const disabled = !pressTarget || !p?.canAttempt;
            return (
              <button
                key={actionId}
                className={`btn-press-option ${selectedAction === actionId ? 'selected' : ''}`}
                disabled={disabled}
                title={p?.blockReason ?? (needsWarTarget && !nationsAtWar.length ? 'No nations at war' : undefined)}
                onClick={() => setSelectedAction(actionId)}
              >
                {PRESS_ICONS[actionId]} {p?.label ?? actionId}
                {p && <span className="talk-cost">⚡{p.energyCost} · ${p.cost}B</span>}
              </button>
            );
          })}
        </div>

        {selectedAction === 'condemn_aggression' && nationsAtWar.length > 0 && (
          <p className="muted">Condemnation targets must be at war — pick Russia, Ukraine, etc.</p>
        )}

        {preview && (
          <div className="press-preview">
            <p className="muted">{preview.description}</p>
            <ul className="preview-effects">
              {preview.effects.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
            {preview.blockReason && <p className="warning">{preview.blockReason}</p>}
            <button
              className="btn-action"
              disabled={!preview.canAttempt || !selectedAction}
              onClick={() => {
                if (!selectedAction) return;
                onPressAction(selectedAction, pressTarget);
                setSelectedAction(null);
              }}
            >
              {preview.isInstant ? 'Issue statement' : 'Announce & schedule'}
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

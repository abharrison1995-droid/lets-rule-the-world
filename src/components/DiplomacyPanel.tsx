import { useState } from 'react';
import type { GameState, PeaceTermsType, TalkOptionId, CovertTalkOptionId, PressActionId } from '../types/game';
import { getPlayableRelationTargets, getNpcNationDossier, getNpcNationIds } from '../engine/npcNation';
import { NpcNationBrowser } from './NpcNationDossier';
import { getMechanicsForNation } from '../data/mechanics';
import { getPeaceOptions, calculatePeaceAcceptance } from '../engine/peace';
import { formatRelationValue, previewPeaceReconciliation } from '../engine/conflictRelations';
import { previewSpendFiscalImpact } from '../engine/fiscal';
import { TALK_COSTS } from '../engine/talks';
import { FiscalImpactLine } from './FiscalImpactLine';
import {
  categorizeRelation,
  RELATION_GROUP_LABELS,
  RELATION_GROUP_ORDER,
  type RelationCategory,
} from '../engine/warDeclaration';
import { TalksScreen } from './TalksScreen';
import { PressConferenceScreen } from './PressConferenceScreen';
import { BottomSheet } from './BottomSheet';
import { getActiveCovertAlliances } from '../engine/covertAlliances';
import { getInvokeUsSupportChance } from '../engine/diplomaticMissions';
import { getActiveTheaters, getTheaterForWar } from '../engine/warTheater';

interface DiplomacyPanelProps {
  state: GameState;
  onClose: () => void;
  onRequestWar: (targetId: string) => void;
  onPressAction: (actionId: PressActionId, targetId: string) => void;
  onProposePeace: (targetId: string, terms: PeaceTermsType) => void;
  onNegotiate: (targetId: string, option: TalkOptionId, peaceTerms?: PeaceTermsType) => void;
  onCovertNegotiate: (targetId: string, option: CovertTalkOptionId) => void;
  onCovertOp: (targetId: string) => void;
  onProbePacts: (targetId: string) => void;
  onExecuteMechanic: (mechanicId: string, targetId?: string) => void;
  onOpenTheater?: (theaterId?: string) => void;
  feedback: string | null;
  talksResult: string | null;
}

const PEACE_LABELS: Record<PeaceTermsType, string> = {
  white_peace: 'White Peace',
  ceasefire: 'Ceasefire',
  reparations: 'Demand Reparations',
};

type DiplomacyView = 'main' | 'talks' | 'press';

export function DiplomacyPanel({
  state,
  onClose,
  onRequestWar,
  onPressAction,
  onProposePeace,
  onNegotiate,
  onCovertNegotiate,
  onCovertOp,
  onProbePacts,
  onExecuteMechanic,
  onOpenTheater,
  feedback,
  talksResult,
}: DiplomacyPanelProps) {
  const [view, setView] = useState<DiplomacyView>('main');
  const [talksTarget, setTalksTarget] = useState<string | null>(null);
  const [mechanicTarget, setMechanicTarget] = useState('');
  const [peaceTarget, setPeaceTarget] = useState('');
  const [npcInspectId, setNpcInspectId] = useState('');

  const relations = getPlayableRelationTargets(state, state.playerCountryId);
  const alliances = state.alliances.filter(a => a.members.includes(state.playerCountryId));
  const covertAlliances = getActiveCovertAlliances(state, state.playerCountryId);
  const mechanics = getMechanicsForNation(state.playerCountryId);

  const grouped = RELATION_GROUP_ORDER.reduce<Record<RelationCategory, typeof relations>>(
    (acc, cat) => {
      acc[cat] = relations.filter(r =>
        categorizeRelation(state, state.playerCountryId, r.countryId, r.value) === cat
      );
      return acc;
    },
    { at_war: [], allies: [], friendly: [], neutral: [], hostile: [] }
  );

  const atWarNations = grouped.at_war;

  const openTalks = (countryId: string) => {
    setTalksTarget(countryId);
    setView('talks');
  };

  if (view === 'talks' && talksTarget) {
    return (
      <BottomSheet onClose={onClose} className="diplomacy-panel">
        <TalksScreen
          state={state}
          targetId={talksTarget}
          onBack={() => { setView('main'); setTalksTarget(null); }}
          onNegotiate={(option, peaceTerms) => onNegotiate(talksTarget, option, peaceTerms)}
          onCovertNegotiate={(option) => onCovertNegotiate(talksTarget, option)}
          lastResult={talksResult}
        />
      </BottomSheet>
    );
  }

  if (view === 'press') {
    return (
      <BottomSheet onClose={onClose} className="diplomacy-panel">
        <PressConferenceScreen
          state={state}
          onBack={() => setView('main')}
          onRequestWar={onRequestWar}
          onPressAction={onPressAction}
        />
      </BottomSheet>
    );
  }

  return (
    <BottomSheet onClose={onClose} className="diplomacy-panel">
      <div className="panel-header">
        <h3>Diplomacy & Actions</h3>
        <button className="btn-close" onClick={onClose}>×</button>
      </div>

      {feedback && <p className="feedback-msg">{feedback}</p>}

      {getActiveTheaters(state).length > 0 && (
        <section className="panel-section theater-war-section">
          <h4>Active War Theaters</h4>
          {state.wars.map(w => {
            const theater = getTheaterForWar(state, w.id);
            if (!theater) return null;
            const names = w.belligerents
              .map(id => state.countries[id]?.name ?? id)
              .join(' vs ');
            return (
              <div key={w.id} className="theater-war-row">
                <div>
                  <strong>{theater.name}</strong>
                  <p className="muted small">{names} · t{state.turn - w.startTurn}</p>
                </div>
                {onOpenTheater && (
                  <button
                    className="btn-small meeting"
                    onClick={() => {
                      onClose();
                      onOpenTheater(theater.id);
                    }}
                  >
                    Open Theater
                  </button>
                )}
              </div>
            );
          })}
        </section>
      )}

      <div className="diplomacy-quick-actions">
        <button className="btn-diplomacy-nav press" onClick={() => setView('press')}>
          🎙️ Press Conference
        </button>
      </div>

      {state.internationalPariahTurns > 0 && (
        <p className="warning pariah-banner">
          Global condemnation active — {state.internationalPariahTurns} turn{state.internationalPariahTurns !== 1 ? 's' : ''} remaining
        </p>
      )}

      {atWarNations.length > 0 && (
        <section className="panel-section peace-section">
          <h4>Peace Negotiations</h4>
          <p className="muted">Dispatches a peace envoy — results return in 2 turns.</p>
          <select className="target-select" value={peaceTarget} onChange={e => setPeaceTarget(e.target.value)}>
            <option value="">Select wartime opponent...</option>
            {atWarNations.map(r => (
              <option key={r.countryId} value={r.countryId}>{r.name}</option>
            ))}
          </select>
          {peaceTarget && getPeaceOptions(state, peaceTarget).map(terms => {
            const recon = previewPeaceReconciliation(state, state.playerCountryId, peaceTarget, terms);
            const acceptance = Math.round(calculatePeaceAcceptance(state, peaceTarget, terms) * 100);
            const fiscal = previewSpendFiscalImpact(state, state.playerCountryId, TALK_COSTS.peace);
            return (
              <div key={terms} className="peace-option-block">
                <button
                  className="btn-action peace"
                  onClick={() => onProposePeace(peaceTarget, terms)}
                >
                  <span>🤝 {PEACE_LABELS[terms]}</span>
                  <span className="peace-preview-hint">
                    ~{acceptance}% accept · ties {formatRelationValue(recon.current)} → ~{formatRelationValue(recon.projected)}
                  </span>
                </button>
                <FiscalImpactLine fiscal={fiscal} />
              </div>
            );
          })}
        </section>
      )}

      <section className="panel-section">
        <h4>Alliances & Agreements</h4>
        {alliances.length === 0 && state.bilateralAgreements.filter(
          ag => ag.a === state.playerCountryId || ag.b === state.playerCountryId
        ).length === 0 && covertAlliances.length === 0 ? (
          <p className="muted">No active alliances or bilateral deals.</p>
        ) : (
          <>
            {alliances.map(a => (
              <div key={a.id} className="alliance-row">
                <span className="alliance-name">{a.name}</span>
                <span className="alliance-tier">{a.tier.replace('_', ' ')}</span>
                <span className="alliance-members">
                  {a.members.map(m => state.countries[m]?.name).join(', ')}
                </span>
              </div>
            ))}
            {state.bilateralAgreements
              .filter(ag => ag.a === state.playerCountryId || ag.b === state.playerCountryId)
              .map(ag => {
                const partnerId = ag.a === state.playerCountryId ? ag.b : ag.a;
                return (
                  <div key={ag.id} className="alliance-row bilateral">
                    <span className="alliance-name">
                      {ag.type === 'trade' ? '📜 Trade' : '🔍 Intel'} — {state.countries[partnerId]?.name}
                    </span>
                    <span className="alliance-tier">bilateral · turn {ag.formedTurn}</span>
                  </div>
                );
              })}
            {covertAlliances.map(ca => {
              const partnerId = ca.a === state.playerCountryId ? ca.b : ca.a;
              return (
                <div key={ca.id} className="alliance-row covert">
                  <span className="alliance-name">
                    🔒 {ca.type} — {state.countries[partnerId]?.name}
                  </span>
                  <span className="alliance-tier">secret · {ca.exposureRisk.toFixed(0)}% leak risk/turn</span>
                </div>
              );
            })}
          </>
        )}
      </section>

      <section className="panel-section">
        <h4>Relations</h4>
        <p className="muted small">Playable nations — use World Powers below for NPC dossiers.</p>
        {RELATION_GROUP_ORDER.map(category => {
          const group = grouped[category];
          if (group.length === 0) return null;
          return (
            <div key={category} className="relation-group">
              <h5 className="relation-group-title">{RELATION_GROUP_LABELS[category]}</h5>
              {group.map(r => (
                <div key={r.countryId} className="relation-row grouped">
                  <span className="relation-nation">
                    <span
                      className="nation-dot"
                      style={{ backgroundColor: state.countries[r.countryId]?.color }}
                    />
                    {r.name}
                  </span>
                  <span className={`relation-value ${r.value > 0 ? 'positive' : r.value < 0 ? 'negative' : ''}`}>
                    {r.value > 0 ? '+' : ''}{r.value}
                  </span>
                  <span className="relation-actions">
                    <button
                      className="btn-small meeting"
                      onClick={() => openTalks(r.countryId)}
                      title="Enter talks"
                    >
                      Meeting
                    </button>
                    {category !== 'at_war' && (
                      <>
                        <button
                          className="btn-small covert"
                          onClick={() => onCovertOp(r.countryId)}
                          title="Covert sabotage op"
                        >
                          🕵
                        </button>
                        <button
                          className="btn-small probe"
                          onClick={() => onProbePacts(r.countryId)}
                          title="Probe for secret pacts"
                        >
                          🔎
                        </button>
                      </>
                    )}
                  </span>
                </div>
              ))}
            </div>
          );
        })}
      </section>

      <NpcNationBrowser
        state={state}
        selectedId={npcInspectId}
        onSelect={setNpcInspectId}
        onMeeting={openTalks}
        onCovertOp={onCovertOp}
        onProbePacts={onProbePacts}
        getDossier={getNpcNationDossier}
        getNpcIds={getNpcNationIds}
      />

      {mechanics.length > 0 && (
        <section className="panel-section">
          <h4>Special Actions</h4>
          <select className="target-select" value={mechanicTarget} onChange={e => setMechanicTarget(e.target.value)}>
            <option value="">Select target nation...</option>
            <optgroup label="Playable nations">
              {relations.map(r => (
                <option key={r.countryId} value={r.countryId}>{r.name}</option>
              ))}
            </optgroup>
            <optgroup label="World powers (NPC)">
              {getNpcNationIds(state).map(id => (
                <option key={id} value={id}>{state.countries[id]?.name ?? id}</option>
              ))}
            </optgroup>
          </select>
          {mechanics.map(m => {
            const lastUsed = state.mechanicCooldowns[m.id] ?? 0;
            const cdRemaining = Math.max(0, m.cooldown - (state.turn - lastUsed));
            const needsTarget = m.category === 'covert' || m.category === 'military' || m.category === 'strategic';
            const successHint =
              m.id === 'invoke_us_support' && mechanicTarget
                ? ` · ~${Math.round(getInvokeUsSupportChance(state, mechanicTarget) * 100)}% success`
                : '';
            return (
              <div key={m.id} className="mechanic-row">
                <strong>{m.name}</strong>
                <span className="muted">{m.description}</span>
                <span className="mechanic-cost">${m.cost}B · CD: {cdRemaining > 0 ? `${cdRemaining}t` : 'ready'}{successHint}</span>
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
    </BottomSheet>
  );
}

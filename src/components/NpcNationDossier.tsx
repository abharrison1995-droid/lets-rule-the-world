import type { GameState } from '../types/game';
import type { NpcNationDossier } from '../engine/npcNation';
import { RELATION_GROUP_LABELS } from '../engine/warDeclaration';

interface NpcNationDossierPanelProps {
  dossier: NpcNationDossier;
  onMeeting: () => void;
  onCovertOp: () => void;
  onProbePacts: () => void;
  atWar: boolean;
}

function RelationChip({ name, value }: { name: string; value: number }) {
  return (
    <span className={`npc-rel-chip ${value > 0 ? 'positive' : value < 0 ? 'negative' : ''}`}>
      {name} {value > 0 ? '+' : ''}{value}
    </span>
  );
}

export function NpcNationDossierPanel({
  dossier,
  onMeeting,
  onCovertOp,
  onProbePacts,
  atWar,
}: NpcNationDossierPanelProps) {
  return (
    <div className="npc-dossier">
      <div className="npc-dossier-header">
        <span className="nation-dot large" style={{ backgroundColor: dossier.color }} />
        <div>
          <h5>{dossier.name}</h5>
          <span className="npc-role-badge">{dossier.roleLabel}</span>
        </div>
        <span className={`relation-value dossier-rel ${dossier.relationToPlayer > 0 ? 'positive' : dossier.relationToPlayer < 0 ? 'negative' : ''}`}>
          You: {dossier.relationToPlayer > 0 ? '+' : ''}{dossier.relationToPlayer}
          <span className="muted small"> · {RELATION_GROUP_LABELS[dossier.relationCategory]}</span>
        </span>
      </div>

      <blockquote className="npc-quote">&ldquo;{dossier.quote}&rdquo;</blockquote>
      <p className="muted small">{dossier.summary}</p>
      <p className="npc-foreign-policy"><strong>Foreign policy:</strong> {dossier.foreignPolicy}</p>

      <ul className="npc-standing">
        {dossier.standing.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ul>

      {dossier.mechanicStatus && (
        <div className={`npc-mechanic ${dossier.mechanicStatus.active ? 'active' : 'dormant'}`}>
          <h6>{dossier.mechanicStatus.name}</h6>
          <p className="muted small">{dossier.mechanicStatus.description}</p>
          <p className="npc-mechanic-status">
            <span className={`mechanic-badge ${dossier.mechanicStatus.active ? 'on' : 'off'}`}>
              {dossier.mechanicStatus.active ? 'Active' : 'Dormant'}
            </span>
            {dossier.mechanicStatus.statusLine}
          </p>
          {dossier.mechanicStatus.detailLines.length > 0 && (
            <ul className="npc-mechanic-details">
              {dossier.mechanicStatus.detailLines.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {dossier.behaviorNotes.length > 0 && (
        <div className="npc-behavior">
          <h6>Strategic notes</h6>
          <ul>
            {dossier.behaviorNotes.map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        </div>
      )}

      {(dossier.keyPartners.length > 0 || dossier.keyRivals.length > 0) && (
        <div className="npc-relations-grid">
          {dossier.keyPartners.length > 0 && (
            <div>
              <h6>Key partners</h6>
              <div className="npc-rel-chips">
                {dossier.keyPartners.map(r => (
                  <RelationChip key={r.countryId} name={r.name} value={r.value} />
                ))}
              </div>
            </div>
          )}
          {dossier.keyRivals.length > 0 && (
            <div>
              <h6>Key rivals</h6>
              <div className="npc-rel-chips">
                {dossier.keyRivals.map(r => (
                  <RelationChip key={r.countryId} name={r.name} value={r.value} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {dossier.otherRelations.length > 0 && (
        <div className="npc-other-relations">
          <h6>Other ties</h6>
          <div className="npc-rel-chips">
            {dossier.otherRelations.map(r => (
              <RelationChip key={r.countryId} name={r.name} value={r.value} />
            ))}
          </div>
        </div>
      )}

      <div className="npc-dossier-actions">
        <button className="btn-small meeting" onClick={onMeeting}>Meeting</button>
        {!atWar && (
          <>
            <button className="btn-small covert" onClick={onCovertOp} title="Covert sabotage op">🕵</button>
            <button className="btn-small probe" onClick={onProbePacts} title="Probe for secret pacts">🔎</button>
          </>
        )}
      </div>
    </div>
  );
}

export function NpcNationBrowser({
  state,
  selectedId,
  onSelect,
  onMeeting,
  onCovertOp,
  onProbePacts,
  getDossier,
  getNpcIds,
}: {
  state: GameState;
  selectedId: string;
  onSelect: (id: string) => void;
  onMeeting: (id: string) => void;
  onCovertOp: (id: string) => void;
  onProbePacts: (id: string) => void;
  getDossier: (state: GameState, id: string) => NpcNationDossier | null;
  getNpcIds: (state: GameState) => string[];
}) {
  const npcIds = getNpcIds(state);
  const dossier = selectedId ? getDossier(state, selectedId) : null;
  const atWar = selectedId
    ? state.wars.some(w => w.belligerents.includes(state.playerCountryId) && w.belligerents.includes(selectedId))
    : false;

  return (
    <section className="panel-section npc-browser-section">
      <h4>World Powers (NPC)</h4>
      <p className="muted small">Major nations not playable in this campaign — intel dossiers and bilateral ties.</p>
      <select
        className="target-select"
        value={selectedId}
        onChange={e => onSelect(e.target.value)}
      >
        <option value="">Select nation to inspect...</option>
        {npcIds.map(id => (
          <option key={id} value={id}>{state.countries[id]?.name ?? id}</option>
        ))}
      </select>
      {dossier && (
        <NpcNationDossierPanel
          dossier={dossier}
          atWar={atWar}
          onMeeting={() => onMeeting(selectedId)}
          onCovertOp={() => onCovertOp(selectedId)}
          onProbePacts={() => onProbePacts(selectedId)}
        />
      )}
    </section>
  );
}

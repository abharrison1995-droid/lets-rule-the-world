import type { WarDeclarationPreview } from '../types/game';

interface WarConfirmModalProps {
  preview: WarDeclarationPreview;
  onConfirm: () => void;
  onCancel: () => void;
}

export function WarConfirmModal({ preview, onConfirm, onCancel }: WarConfirmModalProps) {
  const hasConsequences =
    preview.blocExpulsions.length > 0 ||
    preview.blocMembersJoiningWar.length > 0 ||
    preview.alliesLikelyToJoinEnemy.length > 0 ||
    preview.relationHits.length > 0 ||
    preview.triggersGlobalCondemnation;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal war-confirm-modal" onClick={e => e.stopPropagation()}>
        <h2>Declare War on {preview.targetName}?</h2>
        <p className="war-confirm-lead">
          This is a public act. Review the fallout before committing your nation.
        </p>

        <div className="war-preview-stats">
          <span>Wars declared this turn: {preview.warsDeclaredThisTurn} / {preview.warCap}</span>
          <span>Remaining after: {Math.max(0, preview.warsRemaining - 1)}</span>
        </div>

        {!preview.canDeclare && (
          <p className="war-preview-block">{preview.blockReason}</p>
        )}

        {hasConsequences && (
          <div className="war-preview-consequences">
            {preview.blocExpulsions.length > 0 && (
              <div className="war-preview-section">
                <h4>Alliance expulsion</h4>
                <ul>
                  {preview.blocExpulsions.map(e => (
                    <li key={e.allianceId}>Expelled from {e.allianceName}</li>
                  ))}
                </ul>
              </div>
            )}

            {preview.blocMembersJoiningWar.length > 0 && (
              <div className="war-preview-section">
                <h4>Bloc mobilization</h4>
                <ul>
                  {preview.blocMembersJoiningWar.map(m => (
                    <li key={m.countryId}>{m.name} ({m.blocName}) joins the war</li>
                  ))}
                </ul>
              </div>
            )}

            {preview.alliesLikelyToJoinEnemy.length > 0 && (
              <div className="war-preview-section">
                <h4>Allies likely to intervene</h4>
                <ul>
                  {preview.alliesLikelyToJoinEnemy.map(a => (
                    <li key={a.countryId}>{a.name} via {a.allianceName}</li>
                  ))}
                </ul>
              </div>
            )}

            {preview.relationHits.length > 0 && (
              <div className="war-preview-section">
                <h4>Relation penalties</h4>
                <ul className="war-preview-relations">
                  {preview.relationHits.slice(0, 6).map(h => (
                    <li key={h.countryId}>
                      {h.name}: <span className="negative">{h.estimatedDelta}</span>
                    </li>
                  ))}
                  {preview.relationHits.length > 6 && (
                    <li className="muted">+{preview.relationHits.length - 6} more nations</li>
                  )}
                </ul>
              </div>
            )}

            {preview.triggersGlobalCondemnation && (
              <div className="war-preview-section condemnation">
                <h4>⚠ Global condemnation</h4>
                <p>{preview.condemnationReason}</p>
                <p className="muted">−10 relations worldwide, −15% war popularity, 3-turn economic debuff.</p>
              </div>
            )}
          </div>
        )}

        {!hasConsequences && preview.canDeclare && (
          <p className="muted">Limited international backlash expected.</p>
        )}

        <div className="war-confirm-actions">
          <button className="btn-secondary" onClick={onCancel}>Cancel</button>
          <button
            className="btn-danger"
            disabled={!preview.canDeclare}
            onClick={onConfirm}
          >
            Declare War
          </button>
        </div>
      </div>
    </div>
  );
}

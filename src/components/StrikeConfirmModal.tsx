import type { StrikeConfirmPreview } from '../engine/strikePreview';
import { formatDisplayCost } from '../engine/treasuryDisplay';
import { FiscalImpactLine } from './FiscalImpactLine';

interface StrikeConfirmModalProps {
  preview: StrikeConfirmPreview;
  onConfirm: () => void;
  onCancel: () => void;
}

export function StrikeConfirmModal({ preview, onConfirm, onCancel }: StrikeConfirmModalProps) {
  const isCampaign = preview.kind === 'campaign';
  const title = isCampaign
    ? `Open ${preview.strikeLabel}?`
    : `Launch ${preview.strikeLabel}?`;

  const hasConsequences =
    preview.triggersWar ||
    preview.spilloverHits.length > 0 ||
    preview.triggersCondemnation;

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal war-confirm-modal strike-confirm-modal" onClick={e => e.stopPropagation()}>
        <h2>{title}</h2>
        <p className="war-confirm-lead">
          Target: <strong>{preview.targetRegionName}</strong> ({preview.targetOwnerName})
          {isCampaign && preview.sourceRegionName && (
            <> · From <strong>{preview.sourceRegionName}</strong></>
          )}
        </p>

        <div className="war-preview-stats">
          <span>Cost: {formatDisplayCost(preview.cost)}{isCampaign ? ' to open' : ''}</span>
          {preview.sustainCost !== undefined && (
            <span>Upkeep: {formatDisplayCost(preview.sustainCost)}/turn</span>
          )}
          <span>Energy: ⚡ {preview.energyCost}</span>
        </div>

        <FiscalImpactLine fiscal={preview.fiscal} />

        {!preview.canExecute && (
          <p className="war-preview-block">{preview.blockReason}</p>
        )}

        {preview.atWar && (
          <p className="muted">Already at war — standard wartime strike rules apply.</p>
        )}

        {hasConsequences && (
          <div className="war-preview-consequences">
            {preview.triggersWar && (
              <div className="war-preview-section condemnation">
                <h4>⚠ Unprovoked attack</h4>
                <p>
                  {preview.targetOwnerName} will declare war in response.
                  Relations: <span className="negative">−{preview.directRelationPenalty}</span> with target.
                </p>
              </div>
            )}

            {preview.spilloverHits.length > 0 && (
              <div className="war-preview-section">
                <h4>Ally spillover</h4>
                <ul className="war-preview-relations">
                  {preview.spilloverHits.slice(0, 5).map(h => (
                    <li key={h.countryId}>
                      {h.name}: <span className="negative">{h.estimatedDelta}</span>
                    </li>
                  ))}
                  {preview.spilloverHits.length > 5 && (
                    <li className="muted">+{preview.spilloverHits.length - 5} more nations</li>
                  )}
                </ul>
              </div>
            )}

            {preview.triggersCondemnation && (
              <div className="war-preview-section condemnation">
                <h4>Global condemnation</h4>
                <p className="muted">UN emergency session event · international pariah debuff · war support hit.</p>
              </div>
            )}

            {preview.ongoingEscalationWarning && (
              <div className="war-preview-section">
                <p className="warning-text small">{preview.ongoingEscalationWarning}</p>
              </div>
            )}
          </div>
        )}

        {!hasConsequences && preview.canExecute && (
          <p className="muted">Limited diplomatic fallout expected.</p>
        )}

        <div className="war-confirm-actions">
          <button className="btn-secondary" onClick={onCancel}>Cancel</button>
          <button
            className="btn-danger"
            disabled={!preview.canExecute}
            onClick={onConfirm}
          >
            {isCampaign ? 'Open Campaign' : 'Launch Strike'}
          </button>
        </div>
      </div>
    </div>
  );
}

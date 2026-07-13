import type { FacilityConfirmPreview } from '../engine/facilities';
import { formatDisplayCost } from '../engine/treasuryDisplay';
import { FiscalImpactLine } from './FiscalImpactLine';

interface FacilityConfirmModalProps {
  preview: FacilityConfirmPreview;
  onConfirm: () => void;
  onCancel: () => void;
}

export function FacilityConfirmModal({ preview, onConfirm, onCancel }: FacilityConfirmModalProps) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal war-confirm-modal facility-confirm-modal" onClick={e => e.stopPropagation()}>
        <h2>Build {preview.label}?</h2>
        <p className="war-confirm-lead">
          Region: <strong>{preview.regionName}</strong>
        </p>
        <p className="muted small">{preview.description}</p>

        <div className="war-preview-stats">
          <span>Cost: {formatDisplayCost(preview.cost)}</span>
          <span>Build time: {preview.buildTurns} turn{preview.buildTurns !== 1 ? 's' : ''}</span>
          <span>Energy: ⚡ {preview.energyCost}</span>
        </div>

        <FiscalImpactLine fiscal={preview.fiscal} />

        {!preview.canBuild && preview.blockReason && (
          <p className="war-preview-block">{preview.blockReason}</p>
        )}

        <div className="war-confirm-actions">
          <button className="btn-secondary" onClick={onCancel}>Cancel</button>
          <button
            className="btn-action"
            disabled={!preview.canBuild}
            onClick={onConfirm}
          >
            Start Construction
          </button>
        </div>
      </div>
    </div>
  );
}

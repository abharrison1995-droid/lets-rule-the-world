import type { FacilityConfirmPreview } from '../engine/facilities';
import { formatDisplayCost } from '../engine/treasuryDisplay';
import { FiscalImpactLine } from './FiscalImpactLine';
import { ConfirmModal } from './ConfirmModal';

interface FacilityConfirmModalProps {
  preview: FacilityConfirmPreview;
  onConfirm: () => void;
  onCancel: () => void;
}

export function FacilityConfirmModal({ preview, onConfirm, onCancel }: FacilityConfirmModalProps) {
  return (
    <ConfirmModal
      title={`Build ${preview.label}?`}
      modalClassName="facility-confirm-modal"
      lead={
        <>
          <p className="war-confirm-lead">
            Region: <strong>{preview.regionName}</strong>
          </p>
          <p className="muted small">{preview.description}</p>
        </>
      }
      stats={
        <>
          <span>Cost: {formatDisplayCost(preview.cost)}</span>
          <span>Build time: {preview.buildTurns} turn{preview.buildTurns !== 1 ? 's' : ''}</span>
          <span>Energy: ⚡ {preview.energyCost}</span>
        </>
      }
      afterStats={<FiscalImpactLine fiscal={preview.fiscal} />}
      blockReason={!preview.canBuild ? preview.blockReason : undefined}
      confirmLabel="Start Construction"
      confirmClassName="btn-action"
      confirmDisabled={!preview.canBuild}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  );
}

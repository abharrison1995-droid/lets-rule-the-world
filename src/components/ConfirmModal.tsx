import type { ReactNode } from 'react';

interface ConfirmModalProps {
  title: string;
  lead?: ReactNode;
  stats: ReactNode;
  afterStats?: ReactNode;
  blockReason?: string;
  hasConsequences?: boolean;
  consequences?: ReactNode;
  fallbackMessage?: string;
  confirmLabel: string;
  confirmDisabled: boolean;
  confirmClassName?: string;
  modalClassName?: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Shared shell for the strike/facility/war preview-then-confirm modals. */
export function ConfirmModal({
  title,
  lead,
  stats,
  afterStats,
  blockReason,
  hasConsequences,
  consequences,
  fallbackMessage,
  confirmLabel,
  confirmDisabled,
  confirmClassName = 'btn-danger',
  modalClassName,
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div
        className={`modal war-confirm-modal${modalClassName ? ` ${modalClassName}` : ''}`}
        onClick={e => e.stopPropagation()}
      >
        <h2>{title}</h2>
        {lead}

        <div className="war-preview-stats">{stats}</div>

        {afterStats}

        {blockReason && <p className="war-preview-block">{blockReason}</p>}

        {hasConsequences && consequences && (
          <div className="war-preview-consequences">{consequences}</div>
        )}

        {!hasConsequences && !blockReason && fallbackMessage && (
          <p className="muted">{fallbackMessage}</p>
        )}

        <div className="war-confirm-actions">
          <button className="btn-secondary" onClick={onCancel}>Cancel</button>
          <button className={confirmClassName} disabled={confirmDisabled} onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

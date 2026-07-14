import type { GameState } from '../types/game';
import { getTheater, acknowledgeAllTheaterNotices, dismissTheaterNotice } from '../engine/warTheater';

interface WarTheaterNoticeModalProps {
  state: GameState;
  onOpenTheater: (theaterId: string) => void;
  onDismiss: (state: GameState) => void;
}

export function WarTheaterNoticeModal({ state, onOpenTheater, onDismiss }: WarTheaterNoticeModalProps) {
  const noticeId = (state.pendingTheaterNotices ?? [])[0];
  const theater = noticeId ? getTheater(state, noticeId) : undefined;
  if (!theater) return null;

  const war = state.wars.find(w => w.id === theater.warId);
  const names = (war?.belligerents ?? [])
    .map(id => state.countries[id]?.name ?? id)
    .join(' vs ');

  return (
    <div className="modal-overlay theater-notice-overlay">
      <div className="modal theater-notice-modal" role="dialog" aria-labelledby="theater-notice-heading">
        <h3 id="theater-notice-heading">War Theater Opened</h3>
        <p className="theater-notice-title">{theater.name}</p>
        <p className="muted">{names}</p>
        <p className="muted small">
          Operational hex combat is live. Doctrine AI prosecutes your stance each turn —
          micro key hexes when you want. Capture whole regions to vassal or absorb.
        </p>
        <div className="modal-actions">
          <button
            className="btn-end-turn"
            onClick={() => {
              const next = structuredClone(state);
              dismissTheaterNotice(next, theater.id);
              onDismiss(next);
              onOpenTheater(theater.id);
            }}
          >
            Open Theater
          </button>
          <button
            className="btn-header"
            onClick={() => {
              const next = structuredClone(state);
              dismissTheaterNotice(next, theater.id);
              onDismiss(next);
            }}
          >
            Later
          </button>
          <button
            className="btn-small"
            onClick={() => {
              const next = structuredClone(state);
              acknowledgeAllTheaterNotices(next);
              onDismiss(next);
            }}
          >
            Dismiss all
          </button>
        </div>
      </div>
    </div>
  );
}

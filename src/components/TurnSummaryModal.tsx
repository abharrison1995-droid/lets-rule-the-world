import type { TurnReportEntry } from '../types/game';
import { TURN_REPORT_LABELS } from '../engine/turnReport';

interface TurnSummaryModalProps {
  turn: number;
  entries: TurnReportEntry[];
  onClose: () => void;
}

export function TurnSummaryModal({ turn, entries, onClose }: TurnSummaryModalProps) {
  const grouped = entries.reduce<Record<string, TurnReportEntry[]>>((acc, entry) => {
    if (!acc[entry.category]) acc[entry.category] = [];
    acc[entry.category].push(entry);
    return acc;
  }, {});

  const categoryOrder: TurnReportEntry['category'][] = [
    'war', 'strike', 'combat', 'alliance', 'diplomacy', 'readiness', 'economy', 'other',
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal turn-summary-modal" onClick={e => e.stopPropagation()}>
        <h2>Turn {turn} — World Report</h2>
        <p className="war-confirm-lead muted">
          Actions and movements by other nations, wars, and alliances this turn.
        </p>

        {entries.length === 0 ? (
          <p className="muted">A quiet turn — no major world developments.</p>
        ) : (
          <div className="turn-summary-sections">
            {categoryOrder.map(cat => {
              const items = grouped[cat];
              if (!items?.length) return null;
              return (
                <section key={cat} className="turn-summary-section">
                  <h4>{TURN_REPORT_LABELS[cat]}</h4>
                  <ul>
                    {items.map((item, i) => (
                      <li key={i}>{item.message}</li>
                    ))}
                  </ul>
                </section>
              );
            })}
          </div>
        )}

        <div className="war-confirm-actions">
          <button className="btn-primary" onClick={onClose}>Continue</button>
        </div>
      </div>
    </div>
  );
}

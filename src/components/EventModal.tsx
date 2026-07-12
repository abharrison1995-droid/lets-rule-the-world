import type { GameEvent } from '../types/game';

interface EventModalProps {
  event: GameEvent;
  onChoice: (index: number) => void;
}

export function EventModal({ event, onChoice }: EventModalProps) {
  return (
    <div className="modal-overlay">
      <div className="modal event-modal">
        {event.telegraph && <span className="telegraph-badge">⚠ Warning</span>}
        <h2>{event.title}</h2>
        <p>{event.description}</p>
        <div className="event-choices">
          {event.choices.map((choice, i) => (
            <button key={i} className="btn-choice" onClick={() => onChoice(i)}>
              {choice.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

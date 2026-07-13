import type { GameEvent, ActiveEvent } from '../types/game';

interface EventModalProps {
  event: GameEvent;
  activeEvent?: ActiveEvent;
  onChoice: (index: number) => void;
}

export function EventModal({ event, activeEvent, onChoice }: EventModalProps) {
  const description = activeEvent?.displayDescription ?? event.description;

  return (
    <div className="modal-overlay">
      <div className="modal event-modal">
        {event.telegraph && <span className="telegraph-badge">⚠ Warning</span>}
        <h2>{event.title}</h2>
        <p>{description}</p>
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

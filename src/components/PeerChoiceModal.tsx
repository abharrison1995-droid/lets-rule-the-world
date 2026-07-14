import type { GameState } from '../types/game';
import { pickPeerThreat } from '../engine/usaCampaign';

interface PeerChoiceModalProps {
  state: GameState;
  onConfirm: (next: GameState) => void;
}

export function PeerChoiceModal({ state, onConfirm }: PeerChoiceModalProps) {
  const choose = (peer: 'russia' | 'china') => {
    const next = structuredClone(state);
    pickPeerThreat(next, peer);
    onConfirm(next);
  };

  return (
    <div className="modal-overlay campaign-brief-overlay">
      <div className="campaign-brief-modal" role="dialog" aria-labelledby="peer-choice-title">
        <p className="campaign-brief-kicker">Turn {state.turn} · Peer Threat</p>
        <h2 id="peer-choice-title">Choose Your Rival</h2>
        <p className="campaign-brief-body">
          Neither Russia nor China is at war with you. The National Security Council will not let the century drift —
          designate the primary peer to break next.
        </p>
        <div className="mode-select-options" style={{ maxWidth: '100%' }}>
          <button type="button" className="mode-option mode-option--campaign" onClick={() => choose('russia')}>
            <span className="mode-option-name">Russia</span>
            <span className="mode-option-blurb">The revisionist near abroad — Ukraine war, energy leverage, nuclear overhang.</span>
          </button>
          <button type="button" className="mode-option" onClick={() => choose('china')}>
            <span className="mode-option-name">China</span>
            <span className="mode-option-blurb">The industrial peer — treasury, industrial depth, Indo-Pacific pressure.</span>
          </button>
        </div>
      </div>
    </div>
  );
}

import { GAME_MODES } from '../data/gameModes';
import { AtlasBackdrop } from './AtlasBackdrop';

interface ModeSelectProps {
  onSelectCampaign: () => void;
  onSelectSandbox: () => void;
  onBack: () => void;
}

export function ModeSelect({ onSelectCampaign, onSelectSandbox, onBack }: ModeSelectProps) {
  const campaign = GAME_MODES.campaign;
  const sandbox = GAME_MODES.sandbox;

  return (
    <div className="title-root mode-select-root">
      <AtlasBackdrop />
      <div className="title-compose mode-select-compose">
        <button type="button" className="mode-select-back" onClick={onBack}>
          ← Title
        </button>
        <p className="end-brand mode-select-brand">
          Let&apos;s Rule <span className="end-brand-emphasis">the World</span>
        </p>
        <h1 className="mode-select-heading">Choose Game Type</h1>
        <p className="title-tagline mode-select-tagline">
          Campaigns put you on a focused path. Sandbox opens later.
        </p>

        <div className="mode-select-options">
          <button
            type="button"
            className="mode-option mode-option--campaign"
            onClick={onSelectCampaign}
          >
            <span className="mode-option-name">{campaign.name}</span>
            <span className="mode-option-blurb">{campaign.blurb}</span>
          </button>

          <button
            type="button"
            className="mode-option mode-option--campaign"
            onClick={onSelectSandbox}
          >
            <span className="mode-option-name">{sandbox.name}</span>
            <span className="mode-option-blurb">{sandbox.blurb}</span>
          </button>
        </div>
      </div>
    </div>
  );
}

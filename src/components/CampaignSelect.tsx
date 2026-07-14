import { AtlasBackdrop } from './AtlasBackdrop';
import { CAMPAIGN_SELECT_ENTRIES } from '../data/campaignUsa';

interface CampaignSelectProps {
  onSelectUsa: () => void;
  onBack: () => void;
}

export function CampaignSelect({ onSelectUsa, onBack }: CampaignSelectProps) {
  return (
    <div className="title-root mode-select-root">
      <AtlasBackdrop />
      <div className="title-compose mode-select-compose">
        <button type="button" className="mode-select-back" onClick={onBack}>
          ← Game Type
        </button>
        <p className="end-brand mode-select-brand">
          Let&apos;s Rule <span className="end-brand-emphasis">the World</span>
        </p>
        <h1 className="mode-select-heading">Campaigns</h1>
        <p className="title-tagline mode-select-tagline">
          Pick a story. More paths unlock as the century expands.
        </p>

        <div className="mode-select-options">
          {CAMPAIGN_SELECT_ENTRIES.map(entry => {
            if (!entry.available) {
              return (
                <div key={entry.id} className="mode-option mode-option--locked" aria-disabled="true">
                  <span className="mode-option-name">{entry.title}</span>
                  <span className="mode-option-blurb">Coming soon</span>
                  <span className="mode-locked-badge">Coming soon</span>
                </div>
              );
            }

            return (
              <button
                key={entry.id}
                type="button"
                className="mode-option mode-option--campaign"
                onClick={onSelectUsa}
              >
                <span className="mode-option-name">{entry.title}</span>
                <span className="mode-option-blurb">{entry.gist}</span>
                <span className="mode-option-meta">
                  Difficulty {entry.difficultyLabel}
                  <span aria-hidden="true"> · </span>
                  ~{entry.estimateTurnsLabel}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}

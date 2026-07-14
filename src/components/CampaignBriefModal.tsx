import { useState } from 'react';
import type { GameState, UkraineAlignment } from '../types/game';
import { USA_CAMPAIGN_BRIEF, USA_MISSION_CUBA } from '../data/campaignUsa';
import { acknowledgeCampaignBrief } from '../engine/usaCampaign';

interface CampaignBriefModalProps {
  state: GameState;
  onConfirm: (next: GameState) => void;
}

export function CampaignBriefModal({ state, onConfirm }: CampaignBriefModalProps) {
  const [alignment, setAlignment] = useState<UkraineAlignment>(
    state.usaCampaign?.ukraineAlignment ?? 'ukraine'
  );

  const commit = () => {
    const next = structuredClone(state);
    acknowledgeCampaignBrief(next, alignment);
    onConfirm(next);
  };

  return (
    <div className="modal-overlay campaign-brief-overlay">
      <div className="campaign-brief-modal" role="dialog" aria-labelledby="campaign-brief-title">
        <p className="campaign-brief-kicker">National Security Brief</p>
        <h2 id="campaign-brief-title">{USA_CAMPAIGN_BRIEF.headline}</h2>
        {USA_CAMPAIGN_BRIEF.paragraphs.map(p => (
          <p key={p} className="campaign-brief-body">
            {p}
          </p>
        ))}
        <p className="campaign-brief-note">{USA_CAMPAIGN_BRIEF.ukraineNote}</p>

        <fieldset className="campaign-align-fieldset">
          <legend>Ukraine war alignment</legend>
          {(
            [
              ['ukraine', 'Back Ukraine (default)'],
              ['deniable', 'Plausible deniability'],
              ['russia', 'Tilt toward Moscow'],
            ] as Array<[UkraineAlignment, string]>
          ).map(([id, label]) => (
            <label key={id} className={`campaign-align-option ${alignment === id ? 'selected' : ''}`}>
              <input
                type="radio"
                name="ukraine-align"
                value={id}
                checked={alignment === id}
                onChange={() => setAlignment(id)}
              />
              {label}
            </label>
          ))}
        </fieldset>

        <div className="campaign-mission-card">
          <h3>{USA_MISSION_CUBA.title}</h3>
          <p>{USA_MISSION_CUBA.blurb}</p>
        </div>

        <button type="button" className="title-cta title-cta-primary campaign-brief-go" onClick={commit}>
          Begin the Century
        </button>
      </div>
    </div>
  );
}

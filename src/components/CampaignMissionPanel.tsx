import type { GameState, UkraineAlignment } from '../types/game';
import {
  getMissionHud,
  getInstallClientPreview,
  getUkraineAlignmentLabel,
} from '../engine/usaCampaign';

interface CampaignMissionPanelProps {
  state: GameState;
  onDeclareWar: (targetId: string) => void;
  onInstallClient: (targetId: string) => void;
  onFocusTarget?: (countryId: string) => void;
  compact?: boolean;
}

export function CampaignMissionPanel({
  state,
  onDeclareWar,
  onInstallClient,
  onFocusTarget,
  compact = false,
}: CampaignMissionPanelProps) {
  const hud = getMissionHud(state);
  if (!hud) return null;

  const install = getInstallClientPreview(state, hud.targetId);
  const alignment = state.usaCampaign?.ukraineAlignment;

  return (
    <section className={`panel-section campaign-mission-panel ${compact ? 'compact' : ''}`}>
      <h4>Campaign Mission</h4>
      <p className="campaign-mission-title">{hud.title}</p>
      {hud.status === 'active' && (
        <>
          <p className="campaign-mission-timer">
            Target: <strong>{hud.targetName}</strong>
            {hud.turnsLeft !== null && (
              <>
                {' '}
                · <strong>{hud.turnsLeft}</strong> turn{hud.turnsLeft !== 1 ? 's' : ''} left
                <span className="muted"> (deadline {hud.deadlineTurn})</span>
              </>
            )}
          </p>
          <p className="muted small">{hud.blurb}</p>
          <ul className="campaign-mission-paths">
            <li className={hud.controlOwned === hud.controlTotal ? 'done' : ''}>
              Conquer: {hud.controlOwned}/{hud.controlTotal} regions
            </li>
            <li className={hud.isClient ? 'done' : ''}>
              Or install client government {hud.isClient ? '(done)' : ''}
            </li>
          </ul>
          {hud.atWar && <p className="mission-war-flag">At war with {hud.targetName}</p>}
          <div className="campaign-mission-actions">
            {!hud.atWar && (
              <button
                type="button"
                className="btn-small war"
                onClick={() => onDeclareWar(hud.targetId)}
              >
                Declare War on {hud.targetName}
              </button>
            )}
            {hud.atWar && onFocusTarget && (
              <button
                type="button"
                className="btn-small"
                onClick={() => onFocusTarget(hud.targetId)}
              >
                Open {hud.targetName} Map
              </button>
            )}
            <button
              type="button"
              className="btn-small meeting"
              disabled={!install.canInstall}
              title={install.blockReason}
              onClick={() => onInstallClient(hud.targetId)}
            >
              Install Client Gov
              {install.canInstall
                ? ` ($${install.costTp}B · ${install.energyCost}⚡)`
                : ''}
            </button>
          </div>
          {!install.canInstall && install.blockReason && hud.atWar && (
            <p className="muted small">{install.blockReason}</p>
          )}
          {install.reasonsMet.length > 0 && (
            <p className="muted small">Ready: {install.reasonsMet.join(' · ')}</p>
          )}
        </>
      )}
      {hud.status === 'won' && (
        <p className="success-text">Mission complete — {hud.targetName} secured.</p>
      )}
      {hud.status === 'failed' && (
        <p className="warning-text">Mission failed.</p>
      )}

      {alignment && !compact && (
        <p className="muted small campaign-align-note">
          Ukraine alignment: <strong>{getUkraineAlignmentLabel(alignment)}</strong>
          {' — change in Diplomacy.'}
        </p>
      )}
    </section>
  );
}

/** Standalone alignment controls for Diplomacy */
export function UkraineAlignmentControls({
  state,
  onChange,
}: {
  state: GameState;
  onChange: (alignment: UkraineAlignment) => void;
}) {
  if (!state.usaCampaign) return null;
  const current = state.usaCampaign.ukraineAlignment;
  return (
    <section className="panel-section">
      <h4>Ukraine Alignment</h4>
      <p className="muted small">Revisitable — each flip costs credibility.</p>
      <div className="campaign-mission-actions">
        {(['ukraine', 'deniable', 'russia'] as UkraineAlignment[]).map(id => (
          <button
            key={id}
            type="button"
            className={`btn-small ${current === id ? 'meeting' : ''}`}
            disabled={current === id}
            onClick={() => onChange(id)}
          >
            {getUkraineAlignmentLabel(id)}
          </button>
        ))}
      </div>
    </section>
  );
}

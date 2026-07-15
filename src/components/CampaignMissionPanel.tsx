import type { GameState } from '../types/game';
import {
  getMissionHud,
  getInstallClientPreview,
} from '../engine/usaCampaign';
import { FiscalImpactLine } from './FiscalImpactLine';

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

  const install = hud.allowsClientInstall
    ? getInstallClientPreview(state, hud.targetId)
    : null;

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
          {hud.peerWarByTurn !== null && !hud.atWar && (
            <p className="warning-text small">
              Open war by turn <strong>{hud.peerWarByTurn}</strong> or the contest fails.
            </p>
          )}
          <p className="muted small">{hud.blurb}</p>

          {!compact && hud.howToSteps.length > 0 && (
            <div className="mission-howto">
              <p className="mission-howto-label">How to play this</p>
              <ol className="mission-howto-list">
                {hud.howToSteps.map(step => (
                  <li key={step}>{step}</li>
                ))}
              </ol>
            </div>
          )}

          <ul className="campaign-mission-paths">
            {hud.winPaths.map(path => (
              <li key={path}>{path}</li>
            ))}
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
            {hud.kind === 'peer_contest' && hud.targetId === 'russia' && onFocusTarget && (
              <button
                type="button"
                className="btn-small"
                onClick={() => onFocusTarget('ukraine')}
              >
                Open Ukraine Map
              </button>
            )}
            {install && (
              <button
                type="button"
                className="btn-small meeting"
                disabled={!install.canInstall}
                title={install.blockReason}
                onClick={() => onInstallClient(hud.targetId)}
              >
                Install Client Gov
                {` (${install.costLabel} · ${install.energyCost}⚡)`}
              </button>
            )}
          </div>
          {install && install.fiscal && (
            <FiscalImpactLine fiscal={install.fiscal} />
          )}
          {install && !install.canInstall && install.blockReason && (
            <p className="muted small">{install.blockReason}</p>
          )}
          {install && install.reasonsMet.length > 0 && (
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
    </section>
  );
}

import type { GameState } from '../types/game';
import { getPlayerWars } from '../engine/gameState';
import { formatDisplayGDP } from '../engine/treasuryDisplay';
import { getWinProgress } from '../engine/winConditions';
import { getPendingMissions, getTurnsUntilResolution } from '../engine/diplomaticMissions';
import {
  getPendingFacilityBuilds,
  getTurnsUntilFacilityComplete,
  FACILITY_DEFINITIONS,
} from '../engine/facilities';
import {
  getPendingMilitaryUpgrade,
  getTurnsUntilMilitaryUpgrade,
  MIL_CATEGORY_LABELS,
} from '../engine/militaryDevUpgrades';

interface SidePanelProps {
  state: GameState;
  onToggle: () => void;
  open: boolean;
}

export function SidePanel({ state, onToggle, open }: SidePanelProps) {
  const wars = getPlayerWars(state);
  const player = state.countries[state.playerCountryId];
  const winProgress = getWinProgress(state);
  const pendingMissions = getPendingMissions(state);
  const pendingBuilds = getPendingFacilityBuilds(state);
  const milUpgrade = getPendingMilitaryUpgrade(state);

  return (
    <>
      <button className="side-panel-toggle" onClick={onToggle}>
        {open ? '◂' : '▸'} Intel
      </button>
      {open && (
        <aside className="side-panel">
          <section className="side-section win-section">
            <h4>Victory Progress</h4>
            <p className="win-desc">{winProgress.description}</p>
            <div className="win-progress-bar">
              <div className="win-progress-fill" style={{ width: `${winProgress.progress * 100}%` }} />
            </div>
            {winProgress.details.map((d, i) => (
              <p key={i} className="win-detail">{d}</p>
            ))}
          </section>

          <section className="side-section">
            <h4>Status</h4>
            <p>Treasury: {formatDisplayGDP(player?.stats.treasuryPoints ?? 0)}</p>
            <p>Counter-Intel: {((state.counterIntelLevel) * 100).toFixed(0)}%</p>
            <p>Morale: {((player?.stats.moraleBase ?? 0) * 100).toFixed(0)}%</p>
            <p>War Exhaustion: {((player?.stats.warExhaustion ?? 0) * 100).toFixed(0)}%</p>
            {state.declineMode && <p className="warning-text">⚠ Decline Mode</p>}
          </section>

          <section className="side-section">
            <h4>Active Wars ({wars.length})</h4>
            {wars.length === 0 ? (
              <p className="muted">No active wars.</p>
            ) : (
              wars.map(w => (
                <div key={w.id} className="war-entry">
                  {w.belligerents
                    .filter(b => b !== state.playerCountryId)
                    .map(b => state.countries[b]?.name)
                    .join(', ')}
                  <span className="muted"> · Turn {state.turn - w.startTurn}</span>
                </div>
              ))
            )}
          </section>

          <section className="side-section">
            <h4>Fronts ({state.fronts.length})</h4>
            {state.fronts.slice(0, 5).map(f => (
              <div key={f.id} className="front-entry">
                {state.regions[f.attackerRegionId]?.name} ↔ {state.regions[f.defenderRegionId]?.name}
                <div className="pressure-bar">
                  <div
                    className="pressure-fill"
                    style={{
                      width: `${Math.abs(f.pressure)}%`,
                      background: f.pressure > 0 ? '#ef4444' : '#3b82f6',
                    }}
                  />
                </div>
              </div>
            ))}
          </section>

          <section className="side-section">
            <h4>Envoys ({pendingMissions.length})</h4>
            {pendingMissions.length === 0 ? (
              <p className="muted">No missions in progress.</p>
            ) : (
              pendingMissions.map(m => (
                <div key={m.id} className="mission-entry">
                  {state.countries[m.targetNationId]?.name}
                  <span className="muted"> · {m.type.replace(/_/g, ' ')}</span>
                  <span className="muted"> · {getTurnsUntilResolution(state, m)}t left</span>
                </div>
              ))
            )}
          </section>

          <section className="side-section">
            <h4>Construction ({pendingBuilds.length + (milUpgrade ? 1 : 0)})</h4>
            {pendingBuilds.length === 0 && !milUpgrade ? (
              <p className="muted">No projects in progress.</p>
            ) : (
              <>
                {milUpgrade && (
                  <div className="mission-entry">
                    ⚙ {MIL_CATEGORY_LABELS[milUpgrade.category]}
                    <span className="muted"> · military dev</span>
                    <span className="muted"> · {getTurnsUntilMilitaryUpgrade(state)}t left</span>
                  </div>
                )}
                {pendingBuilds.map(b => (
                  <div key={b.id} className="mission-entry">
                    {FACILITY_DEFINITIONS[b.type].icon} {state.regions[b.regionId]?.name}
                    <span className="muted"> · {FACILITY_DEFINITIONS[b.type].label}</span>
                    <span className="muted"> · {getTurnsUntilFacilityComplete(state, b)}t left</span>
                  </div>
                ))}
              </>
            )}
          </section>

          <section className="side-section">
            <h4>Secret Pacts 🔒 ({state.covertAlliances.filter(
              ca => !ca.exposed && (ca.a === state.playerCountryId || ca.b === state.playerCountryId)
            ).length})</h4>
            {state.covertAlliances.filter(
              ca => !ca.exposed && (ca.a === state.playerCountryId || ca.b === state.playerCountryId)
            ).length === 0 ? (
              <p className="muted">None active.</p>
            ) : (
              state.covertAlliances
                .filter(ca => !ca.exposed && (ca.a === state.playerCountryId || ca.b === state.playerCountryId))
                .map(ca => {
                  const partnerId = ca.a === state.playerCountryId ? ca.b : ca.a;
                  return (
                    <div key={ca.id} className="covert-entry">
                      🔒 {ca.type} — {state.countries[partnerId]?.name}
                      <span className="muted"> · {ca.exposureRisk.toFixed(0)}% risk</span>
                    </div>
                  );
                })
            )}
          </section>

          <section className="side-section">
            <h4>Covert Ops ({state.activeCovertOps.length})</h4>
            {state.activeCovertOps.length === 0 ? (
              <p className="muted">None active.</p>
            ) : (
              state.activeCovertOps.map(op => (
                <div key={op.id} className="covert-entry">
                  {op.opKind === 'probe_pacts' ? '🔎' : '→'} {state.countries[op.targetNation]?.name}
                  {op.opKind === 'probe_pacts' && <span className="muted"> (probe)</span>}
                  {op.discovered && <span className="warning-text"> (discovered)</span>}
                </div>
              ))
            )}
          </section>

          <section className="side-section history-section">
            <h4>History</h4>
            <div className="history-log">
              {state.history.slice(-12).reverse().map((entry, i) => (
                <p key={i} className="history-entry">{entry}</p>
              ))}
            </div>
          </section>
        </aside>
      )}
    </>
  );
}

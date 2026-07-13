import type { GameState } from '../types/game';
import { getPlayerWars } from '../engine/gameState';
import { formatGDP } from '../engine/gameState';
import { getWinProgress } from '../engine/winConditions';

interface SidePanelProps {
  state: GameState;
  onToggle: () => void;
  open: boolean;
}

export function SidePanel({ state, onToggle, open }: SidePanelProps) {
  const wars = getPlayerWars(state);
  const player = state.countries[state.playerCountryId];
  const winProgress = getWinProgress(state);

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
            <p>GDP: {formatGDP(player?.stats.gdp ?? 0)}</p>
            <p>Reserve: ${state.reserveFunds.toFixed(0)}B</p>
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

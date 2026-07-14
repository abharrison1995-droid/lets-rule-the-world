import { useMemo, useState } from 'react';
import type { GameState, TheaterDoctrine, TheaterResolveMode } from '../types/game';
import {
  HEX_TERRAIN_LABELS,
  getTheaterDef,
  hexPolygonPoints,
  hexToPixel,
} from '../data/theaterDefs';
import {
  canSeeHex,
  getActiveTheaters,
  getInterventionMeter,
  getRegionHexControl,
  playerDeployExpeditionary,
  playerReinforceTheater,
  playerSendTheaterAid,
  playerTheaterMove,
  previewHexBattle,
  resolveRegionFate,
  setPlayerDoctrineAi,
  setTheaterDoctrine,
  setTheaterResolveMode,
} from '../engine/warTheater';

interface WarTheaterScreenProps {
  state: GameState;
  onClose: () => void;
  onUpdate: (state: GameState) => void;
  initialTheaterId?: string;
}

const HEX_SIZE = 14;

export function WarTheaterScreen({ state, onClose, onUpdate, initialTheaterId }: WarTheaterScreenProps) {
  const theaters = getActiveTheaters(state);
  const [theaterId, setTheaterId] = useState(initialTheaterId || theaters[0]?.id || '');
  const theater = theaters.find(t => t.id === theaterId) ?? theaters[0];
  const def = theater ? getTheaterDef(theater.defId) : undefined;

  const [selectedHexId, setSelectedHexId] = useState<string | null>(null);
  const [moveFromId, setMoveFromId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const layout = useMemo(() => {
    if (!def) return { vb: '0 0 100 100' };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const h of def.hexes) {
      const [x, y] = hexToPixel(h.q, h.r, HEX_SIZE);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
    const pad = HEX_SIZE * 2.2;
    return {
      vb: `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`,
    };
  }, [def]);

  if (!theater || !def) {
    return (
      <div className="theater-screen theater-saturated">
        <div className="theater-header">
          <button className="btn-back" onClick={onClose}>← Back</button>
          <h3>War Theater</h3>
        </div>
        <p className="muted">No active operational theaters.</p>
      </div>
    );
  }

  const selectedDef = selectedHexId ? def.hexes.find(h => h.id === selectedHexId) : null;
  const selectedRt = selectedHexId ? theater.hexes[selectedHexId] : null;
  const war = state.wars.find(w => w.id === theater.warId);
  const isBelligerent = war?.belligerents.includes(state.playerCountryId) ?? false;
  const playerDoctrine = theater.doctrineByCountry[state.playerCountryId] ?? 'hold';
  const intervention = war ? getInterventionMeter(state, war.id) : 0;
  const odds =
    moveFromId && selectedHexId && moveFromId !== selectedHexId
      ? previewHexBattle(state, theater.id, moveFromId, selectedHexId)
      : null;

  const mutate = (fn: (s: GameState) => string | null | void) => {
    const next = structuredClone(state);
    const msg = fn(next);
    if (typeof msg === 'string') setFeedback(msg);
    onUpdate(next);
  };

  const onHexClick = (hexId: string) => {
    const hexDef = def.hexes.find(h => h.id === hexId);
    if (!hexDef || !canSeeHex(state, theater, hexDef, state.playerCountryId)) {
      setFeedback('No intel on that hex.');
      return;
    }

    if (moveFromId && moveFromId !== hexId) {
      const preview = previewHexBattle(state, theater.id, moveFromId, hexId);
      mutate(s => playerTheaterMove(s, theater.id, moveFromId, hexId));
      setMoveFromId(null);
      setSelectedHexId(hexId);
      if (preview) {
        setFeedback(`Engaged — was ${preview.label} (~${Math.round(preview.winChance * 100)}%)`);
      }
      return;
    }

    setSelectedHexId(hexId);
    const rt = theater.hexes[hexId];
    if (rt?.stack?.countryId === state.playerCountryId) {
      setMoveFromId(hexId);
      setFeedback('Stack selected — click adjacent hex. Odds show before you attack.');
    } else {
      setMoveFromId(null);
    }
  };

  const aidRecipient =
    war?.belligerents.find(b => b !== state.playerCountryId && b !== 'russia') ??
    war?.belligerents.find(b => b !== state.playerCountryId) ??
    'ukraine';

  const regionSummary = def.regionIds.map(rid => {
    const ctrl = getRegionHexControl(theater, rid);
    const name = state.regions[rid]?.name ?? rid;
    const bits = Object.entries(ctrl.byOwner)
      .map(([id, n]) => `${state.countries[id]?.name ?? id}:${n}`)
      .join(' · ');
    return { rid, name, bits, total: ctrl.total };
  });

  return (
    <div className="theater-screen theater-saturated">
      <div className="theater-header">
        <button className="btn-back" onClick={onClose}>← Back</button>
        <h3>{theater.name}</h3>
        {theaters.length > 1 && (
          <select
            className="target-select"
            value={theater.id}
            onChange={e => {
              setTheaterId(e.target.value);
              setSelectedHexId(null);
              setMoveFromId(null);
            }}
          >
            {theaters.map(t => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
        )}
      </div>

      <div className="theater-controls">
        <label>
          Resolve
          <select
            value={theater.resolveMode}
            onChange={e => mutate(s => setTheaterResolveMode(s, theater.id, e.target.value as TheaterResolveMode))}
          >
            <option value="play_out">Play out + AI</option>
            <option value="quick_resolve">Quick resolve</option>
          </select>
        </label>
        <label>
          Doctrine
          <select
            value={playerDoctrine}
            onChange={e => mutate(s => setTheaterDoctrine(s, theater.id, e.target.value as TheaterDoctrine))}
          >
            <option value="attack">Attack</option>
            <option value="hold">Hold</option>
            <option value="withdraw">Withdraw</option>
          </select>
        </label>
        <label className="theater-ai-toggle">
          <input
            type="checkbox"
            checked={theater.playerDoctrineAi !== false}
            onChange={e => mutate(s => setPlayerDoctrineAi(s, theater.id, e.target.checked))}
          />
          Doctrine AI
        </label>
      </div>

      {!isBelligerent && war && (
        <p className="theater-intervention">
          Intervention meter: {Math.round(intervention)}/100
          <span className="muted"> — expeditionary deploys fill this toward auto-entry</span>
        </p>
      )}

      {feedback && <p className="theater-feedback">{feedback}</p>}

      {odds && (
        <div className={`theater-odds odds-${odds.label.replace(/\s+/g, '-').toLowerCase()}`}>
          <strong>{odds.label}</strong>
          <span> ~{Math.round(odds.winChance * 100)}% · ratio {odds.ratio.toFixed(2)}</span>
          <span className="muted small">
            {' '}
            · est. losses ATK −{odds.estAtkLoss} / DEF −{odds.estDefLoss}
          </span>
          <span className="muted small"> · {odds.breakdown.join(' · ')}</span>
        </div>
      )}

      {theater.pendingFate && theater.pendingFate.conquerorId === state.playerCountryId && (
        <div className="theater-fate-modal">
          <h4>Region secured: {state.regions[theater.pendingFate.regionId]?.name}</h4>
          <p className="muted small">Choose the political fate of this territory.</p>
          <div className="theater-fate-actions">
            <button className="btn-small" onClick={() => mutate(s => resolveRegionFate(s, theater.id, 'vassal'))}>
              Install vassal
            </button>
            <button className="btn-small meeting" onClick={() => mutate(s => resolveRegionFate(s, theater.id, 'absorb'))}>
              Absorb directly
            </button>
          </div>
        </div>
      )}

      <div className="theater-map-wrap">
        <svg className="theater-hex-map" viewBox={layout.vb}>
          {def.hexes.map(h => {
            const rt = theater.hexes[h.id];
            const [cx, cy] = hexToPixel(h.q, h.r, HEX_SIZE);
            const visible = canSeeHex(state, theater, h, state.playerCountryId);
            const owner = state.countries[rt?.ownerId ?? ''];
            const fill = !visible ? '#0c1220' : owner?.color ?? '#334155';
            const selected = selectedHexId === h.id;
            const moveFrom = moveFromId === h.id;
            return (
              <g key={h.id} onClick={() => onHexClick(h.id)} style={{ cursor: 'pointer' }}>
                <polygon
                  points={hexPolygonPoints(cx, cy, HEX_SIZE * 0.95)}
                  fill={fill}
                  opacity={visible ? (rt?.contested ? 0.78 : 0.95) : 0.28}
                  stroke={selected ? '#fff7ed' : moveFrom ? '#38bdf8' : rt?.contested ? '#fbbf24' : '#020617'}
                  strokeWidth={selected || moveFrom ? 2.4 : 1.1}
                />
                {visible && rt?.stack && (
                  <text x={cx} y={cy + 1} textAnchor="middle" className="theater-hex-str">
                    {Math.round(rt.stack.strength)}
                  </text>
                )}
                {visible && h.isCity && (
                  <text x={cx} y={cy - HEX_SIZE * 0.42} textAnchor="middle" className="theater-city-star">★</text>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="theater-side">
        {selectedDef && selectedRt && canSeeHex(state, theater, selectedDef, state.playerCountryId) ? (
          <div className="theater-hex-dossier">
            <h4>
              {selectedDef.cityName ?? state.regions[selectedDef.regionId]?.name ?? 'Hex'}
              {selectedDef.isCity ? ' · City' : ''}
            </h4>
            <p className="muted small">
              {HEX_TERRAIN_LABELS[selectedDef.terrain]} · {state.regions[selectedDef.regionId]?.name}
            </p>
            <p>
              Owner: {state.countries[selectedRt.ownerId]?.name ?? selectedRt.ownerId}
              {selectedRt.contested ? ' (contested)' : ''}
            </p>
            {selectedRt.stack ? (
              <p>
                Stack: {state.countries[selectedRt.stack.countryId]?.name} · str {Math.round(selectedRt.stack.strength)}
                <br />
                <span className="muted small">{selectedRt.stack.tags.join(', ')}</span>
              </p>
            ) : (
              <p className="muted">No stack</p>
            )}
            {selectedDef.facilityHint && (
              <p className="muted small">Intel: {selectedDef.facilityHint}</p>
            )}
            <div className="theater-hex-actions">
              {selectedRt.ownerId === state.playerCountryId && (
                <button
                  className="btn-small"
                  onClick={() => mutate(s => playerReinforceTheater(s, theater.id, selectedDef.id))}
                >
                  Reinforce (−4 TP)
                </button>
              )}
              {!isBelligerent && (
                <button
                  className="btn-small"
                  onClick={() => mutate(s => playerDeployExpeditionary(s, theater.id, selectedDef.id, aidRecipient))}
                >
                  Expeditionary (−8 TP)
                </button>
              )}
            </div>
          </div>
        ) : (
          <p className="muted small">Select your stack, then an adjacent hex. Odds appear before attack.</p>
        )}

        <div className="theater-region-summary">
          <h5>Region control · Aid</h5>
          <div className="theater-hex-actions" style={{ marginBottom: '0.45rem' }}>
            <button
              className="btn-small"
              onClick={() => mutate(s => playerSendTheaterAid(s, theater.id, aidRecipient, 'reinforce'))}
            >
              Aid reinforce
            </button>
            <button
              className="btn-small"
              onClick={() => mutate(s => playerSendTheaterAid(s, theater.id, aidRecipient, 'weapons_armor'))}
            >
              Armor package
            </button>
            <button
              className="btn-small"
              onClick={() => mutate(s => playerSendTheaterAid(s, theater.id, aidRecipient, 'weapons_drone'))}
            >
              Drone package
            </button>
          </div>
          <ul>
            {regionSummary.map(r => (
              <li key={r.rid}>
                <strong>{r.name}</strong> ({r.total}): {r.bits || '—'}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {(theater.combatLog?.length ?? 0) > 0 && (
        <div className="theater-combat-log">
          <h5>Combat log</h5>
          <ul>
            {theater.combatLog.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

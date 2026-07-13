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
  getRegionHexControl,
  playerDeployExpeditionary,
  playerReinforceTheater,
  playerTheaterMove,
  resolveRegionFate,
  setTheaterDoctrine,
  setTheaterResolveMode,
} from '../engine/warTheater';

interface WarTheaterScreenProps {
  state: GameState;
  onClose: () => void;
  onUpdate: (state: GameState) => void;
}

const HEX_SIZE = 14;

export function WarTheaterScreen({ state, onClose, onUpdate }: WarTheaterScreenProps) {
  const theaters = getActiveTheaters(state);
  const [theaterId, setTheaterId] = useState(theaters[0]?.id ?? '');
  const theater = theaters.find(t => t.id === theaterId) ?? theaters[0];
  const def = theater ? getTheaterDef(theater.defId) : undefined;

  const [selectedHexId, setSelectedHexId] = useState<string | null>(null);
  const [moveFromId, setMoveFromId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const layout = useMemo(() => {
    if (!def) return { points: [] as Array<{ id: string; x: number; y: number }>, vb: '0 0 100 100' };
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const points = def.hexes.map(h => {
      const [x, y] = hexToPixel(h.q, h.r, HEX_SIZE);
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      return { id: h.id, x, y };
    });
    const pad = HEX_SIZE * 2.2;
    return {
      points,
      vb: `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`,
    };
  }, [def]);

  if (!theater || !def) {
    return (
      <div className="theater-screen">
        <div className="theater-header">
          <button className="btn-back" onClick={onClose}>← Back</button>
          <h3>War Theater</h3>
        </div>
        <p className="muted">No active operational theaters. Theaters open automatically when a defined war starts.</p>
      </div>
    );
  }

  const selectedDef = selectedHexId ? def.hexes.find(h => h.id === selectedHexId) : null;
  const selectedRt = selectedHexId ? theater.hexes[selectedHexId] : null;
  const war = state.wars.find(w => w.id === theater.warId);
  const isBelligerent = war?.belligerents.includes(state.playerCountryId) ?? false;
  const playerDoctrine = theater.doctrineByCountry[state.playerCountryId] ?? 'hold';

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
      mutate(s => playerTheaterMove(s, theater.id, moveFromId, hexId));
      setMoveFromId(null);
      setSelectedHexId(hexId);
      return;
    }

    setSelectedHexId(hexId);
    const rt = theater.hexes[hexId];
    if (rt?.stack?.countryId === state.playerCountryId) {
      setMoveFromId(hexId);
      setFeedback('Stack selected — click an adjacent hex to move or attack.');
    } else {
      setMoveFromId(null);
    }
  };

  const regionSummary = def.regionIds.map(rid => {
    const ctrl = getRegionHexControl(theater, rid);
    const name = state.regions[rid]?.name ?? rid;
    const bits = Object.entries(ctrl.byOwner)
      .map(([id, n]) => `${state.countries[id]?.name ?? id}:${n}`)
      .join(' · ');
    return { rid, name, bits, total: ctrl.total };
  });

  return (
    <div className="theater-screen">
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

      <p className="muted small">
        Hexes nest inside regions. Capture all hexes in a region to seize it, then choose vassal or absorb.
        Visibility: your stacks, adjacent, and contested hexes.
      </p>

      <div className="theater-controls">
        <label>
          Resolve
          <select
            value={theater.resolveMode}
            onChange={e => mutate(s => setTheaterResolveMode(s, theater.id, e.target.value as TheaterResolveMode))}
          >
            <option value="play_out">Play out (micro)</option>
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
      </div>

      {feedback && <p className="theater-feedback">{feedback}</p>}

      {theater.pendingFate && theater.pendingFate.conquerorId === state.playerCountryId && (
        <div className="theater-fate-modal">
          <h4>Region secured: {state.regions[theater.pendingFate.regionId]?.name}</h4>
          <p className="muted small">Choose the political fate of this territory.</p>
          <div className="theater-fate-actions">
            <button
              className="btn-small"
              onClick={() => mutate(s => resolveRegionFate(s, theater.id, 'vassal'))}
            >
              Install vassal
            </button>
            <button
              className="btn-small meeting"
              onClick={() => mutate(s => resolveRegionFate(s, theater.id, 'absorb'))}
            >
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
            const fill = !visible
              ? '#1a1f2a'
              : owner?.color ?? '#334155';
            const selected = selectedHexId === h.id;
            const moveFrom = moveFromId === h.id;
            return (
              <g key={h.id} onClick={() => onHexClick(h.id)} style={{ cursor: 'pointer' }}>
                <polygon
                  points={hexPolygonPoints(cx, cy, HEX_SIZE * 0.95)}
                  fill={fill}
                  opacity={visible ? (rt?.contested ? 0.75 : 0.9) : 0.35}
                  stroke={selected ? '#f8fafc' : moveFrom ? '#38bdf8' : rt?.contested ? '#f59e0b' : '#0f172a'}
                  strokeWidth={selected || moveFrom ? 2.2 : 1}
                />
                {visible && rt?.stack && (
                  <text x={cx} y={cy + 1} textAnchor="middle" className="theater-hex-str">
                    {Math.round(rt.stack.strength)}
                  </text>
                )}
                {visible && h.isCity && (
                  <circle cx={cx} cy={cy - HEX_SIZE * 0.45} r={2.2} fill="#f8fafc" />
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
              {HEX_TERRAIN_LABELS[selectedDef.terrain]} · Region: {state.regions[selectedDef.regionId]?.name}
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
              <p className="muted small">Intel: facility hint — {selectedDef.facilityHint}</p>
            )}
            <div className="theater-hex-actions">
              {(isBelligerent || selectedRt.ownerId === state.playerCountryId) &&
                selectedRt.ownerId === state.playerCountryId && (
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
                  onClick={() => {
                    const partner =
                      war?.belligerents.find(b => b !== 'russia') ??
                      war?.belligerents[0] ??
                      'ukraine';
                    mutate(s => playerDeployExpeditionary(s, theater.id, selectedDef.id, partner));
                  }}
                >
                  Deploy expeditionary (−8 TP)
                </button>
              )}
            </div>
          </div>
        ) : (
          <p className="muted small">Select a visible hex for details. Select your stack, then an adjacent hex to move/attack.</p>
        )}

        <div className="theater-region-summary">
          <h5>Region control</h5>
          <ul>
            {regionSummary.map(r => (
              <li key={r.rid}>
                <strong>{r.name}</strong> ({r.total} hexes): {r.bits || '—'}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

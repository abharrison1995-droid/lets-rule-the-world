import { useState } from 'react';
import type { GameState, FacilityType, StrikeType } from '../types/game';
import { isAtWarWith } from '../engine/actions';
import { getStrikeOptions, getStrikeRange, getStrikeRangeLabel } from '../engine/strikes';
import { formatDisplayCost } from '../engine/treasuryDisplay';
import {
  FACILITY_DEFINITIONS,
  getFacilityDefs,
  hasFacilityInRegion,
  hasPendingBuild,
} from '../engine/facilities';
import {
  CAMPAIGN_DEFS,
  getPlayerCampaigns,
  hasCampaignOnTarget,
} from '../engine/strikeCampaigns';
import { getRegionsForCountry } from '../data/regions';
import { getMissionHud } from '../engine/usaCampaign';

interface RegionActionPanelProps {
  state: GameState;
  regionId: string;
  onClose: () => void;
  onRequestStrike: (regionId: string, strikeType: StrikeType) => void;
  onRequestCampaign: (sourceRegionId: string, targetRegionId: string, strikeType: StrikeType) => void;
  onCancelCampaign: (campaignId: string) => void;
  onBuildFacility: (regionId: string, type: FacilityType) => void;
}

const CAMPAIGN_TYPES: StrikeType[] = ['artillery', 'drone', 'cruise', 'ballistic', 'icbm'];

export function RegionActionPanel({
  state,
  regionId,
  onClose,
  onRequestStrike,
  onRequestCampaign,
  onCancelCampaign,
  onBuildFacility,
}: RegionActionPanelProps) {
  const region = state.regions[regionId];
  const playerRegions = getRegionsForCountry(state.playerCountryId);
  const [sourceRegionId, setSourceRegionId] = useState(
    () => playerRegions.find(r => r.id === regionId)?.id ?? playerRegions[0]?.id ?? ''
  );

  if (!region) return null;

  const owner = state.countries[region.controlledBy];
  const isEnemy = region.controlledBy !== state.playerCountryId;
  const isOwn = region.controlledBy === state.playerCountryId;
  const atWar = isEnemy && isAtWarWith(state, state.playerCountryId, region.controlledBy);
  const strikeOptions = getStrikeOptions(state, state.playerCountryId, regionId);
  const range = getStrikeRange(state, state.playerCountryId, regionId);
  const facilities = region.facilities ?? [];
  const pendingHere = (state.facilityBuilds ?? []).filter(
    b => b.regionId === regionId && b.completeTurn > state.turn
  );
  const activeCampaignsHere = getPlayerCampaigns(state).filter(
    c => c.targetRegionId === regionId || c.sourceRegionId === regionId
  );
  const warReadiness = state.countries[state.playerCountryId]?.stats.warReadiness ?? 1;
  const missionHud = getMissionHud(state);
  const missionTargetHere =
    missionHud?.status === 'active' &&
    (region.countryId === missionHud.targetId ||
      getRegionsForCountry(missionHud.targetId).some(r => r.id === regionId));
  const frontHere = state.fronts.find(
    f => f.attackerRegionId === regionId || f.defenderRegionId === regionId
  );

  return (
    <div className="region-action-panel">
      <div className="panel-header region-panel-header">
        <h3>{region.name}</h3>
        <button className="btn-close region-panel-close" onClick={onClose} aria-label="Close">×</button>
      </div>

      <div className="region-info">
        <p><span className="label">Owner:</span> {owner?.name}</p>
        <p><span className="label">Terrain:</span> {region.terrain}</p>
        <p><span className="label">Troops:</span> {region.garrison.troops.toLocaleString()}</p>
        <p><span className="label">Industry:</span> ${region.industryValue}B</p>
        {region.unrest > 0 && <p className="warning-text">Unrest: {region.unrest}%</p>}
        {frontHere && (
          <p className="mission-front-tip">
            Front pressure: <strong>{Math.round(frontHere.pressure)}</strong> — builds each{' '}
            <strong>End Turn</strong>. Cross the threshold to flip control (classic wars, not hex theaters).
          </p>
        )}
        {missionTargetHere && atWar && !frontHere && isEnemy && (
          <p className="mission-front-tip">
            Mission target. Adjacent occupied land open fronts; End Turn pushes them. Strikes soften defenders first.
          </p>
        )}
        {missionTargetHere && isOwn && region.countryId === missionHud?.targetId && (
          <p className="mission-front-tip">
            {missionHud.allowsClientInstall
              ? 'You hold this mission region. Keep pushing remaining enemy regions, or Install Client from the mission panel when a gate is ready.'
              : 'Foothold secured. Keep pushing exhaustion or more land — peer missions do not use Install Client.'}
          </p>
        )}
        {missionTargetHere && !atWar && isEnemy && (
          <p className="mission-front-tip">
            Mission target — declare war from the mission badge / Diplomacy, then grind fronts with End Turn.
          </p>
        )}
        {facilities.length > 0 && (
          <p>
            <span className="label">Facilities:</span>{' '}
            {facilities.map(f => `${FACILITY_DEFINITIONS[f.type].icon} ${FACILITY_DEFINITIONS[f.type].label}`).join(', ')}
          </p>
        )}
        {pendingHere.map(b => (
          <p key={b.id} className="muted small">
            🏗 {FACILITY_DEFINITIONS[b.type].label} — {b.completeTurn - state.turn} turn(s) left
          </p>
        ))}
      </div>

      <div className="region-actions">
        {isEnemy && (
          <>
            <p className="strike-range-label muted small">
              Strike range: <strong>{getStrikeRangeLabel(range)}</strong>
              {!atWar && <span className="warning-text"> · Unprovoked strikes trigger war</span>}
            </p>
            {warReadiness < 0.32 && (
              <p className="warning-text small">
                War readiness {Math.round(warReadiness * 100)}% — strikes and campaigns drain public support. Use propaganda or stand down.
              </p>
            )}

            <section className="strike-section">
              <h4>Quick Strike (one-off)</h4>
              {strikeOptions.map(opt => (
                <button
                  key={opt.type}
                  className={`btn-action strike ${opt.available ? '' : 'disabled-option'}`}
                  disabled={!opt.available}
                  title={opt.blockReason ?? opt.description}
                  onClick={() => onRequestStrike(regionId, opt.type)}
                >
                  ⚡ {opt.label} — {formatDisplayCost(opt.cost)} · {opt.energyCost}⚡
                </button>
              ))}
            </section>

            <section className="strike-section">
              <h4>Sustained Campaign</h4>
              <p className="muted small">Launch from your territory — pays upfront + upkeep each turn until you stand down or run out of funds. Unprovoked campaigns draw escalating condemnation each turn.</p>
              <select
                className="target-select"
                value={sourceRegionId}
                onChange={e => setSourceRegionId(e.target.value)}
              >
                {playerRegions.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
              {CAMPAIGN_TYPES.map(type => {
                const def = CAMPAIGN_DEFS[type];
                const opt = strikeOptions.find(o => o.type === type);
                const busy = sourceRegionId && hasCampaignOnTarget(state, sourceRegionId, regionId);
                const available = opt?.available ?? false;
                const startCost = def.upfrontCost + def.sustainCost;
                return (
                  <button
                    key={type}
                    className="btn-action"
                    disabled={!available || !!busy || !sourceRegionId}
                    title={opt?.blockReason ?? def.description}
                    onClick={() => sourceRegionId && onRequestCampaign(sourceRegionId, regionId, type)}
                  >
                    🎯 {def.label} — {formatDisplayCost(startCost)} start · {formatDisplayCost(def.sustainCost)}/turn · {def.energyCost}⚡
                  </button>
                );
              })}
            </section>

            {activeCampaignsHere.length > 0 && (
              <section className="strike-section">
                <h4>Active Campaigns</h4>
                {activeCampaignsHere.map(c => (
                  <div key={c.id} className="campaign-row">
                    <span>
                      {CAMPAIGN_DEFS[c.strikeType].label}: {state.regions[c.sourceRegionId]?.name} → {state.regions[c.targetRegionId]?.name}
                    </span>
                    <button type="button" className="btn-small" onClick={() => onCancelCampaign(c.id)}>
                      Stand down
                    </button>
                  </div>
                ))}
              </section>
            )}
          </>
        )}
        {isOwn && (
          <section className="facility-build-section">
            <h4>Regional Construction</h4>
            <p className="muted small">Projects take multiple turns. Track progress in the Intel panel.</p>
            {getFacilityDefs().map(def => {
              const built = hasFacilityInRegion(state, regionId, def.type);
              const pending = hasPendingBuild(state, regionId, def.type);
              return (
                <button
                  key={def.type}
                  className="btn-action"
                  disabled={built || pending}
                  title={def.description}
                  onClick={() => onBuildFacility(regionId, def.type)}
                >
                  {def.icon} {def.label} — {formatDisplayCost(def.cost)} · {def.buildTurns}t
                  {built && ' (built)'}
                  {pending && ' (in progress)'}
                </button>
              );
            })}
          </section>
        )}
        {!isEnemy && !isOwn && (
          <p className="muted">Friendly territory — no hostile actions available.</p>
        )}
      </div>
    </div>
  );
}

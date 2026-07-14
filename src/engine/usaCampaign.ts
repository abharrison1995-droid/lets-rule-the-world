import type { GameState, UkraineAlignment, UsaCampaignState } from '../types/game';
import {
  USA_CAMPAIGN_BRIEF,
  USA_MISSION_CUBA,
  PEER_FORCE_PICK_TURN,
  PEER_THREAT_IDS,
  isUsaCampaignMode,
} from '../data/campaignUsa';
import { getRelation, modifyRelation } from '../data/relations';
import { getRegionsForCountry } from '../data/regions';
import { isAtWarWith } from './actions';
import { ACTION_ENERGY_COSTS, canSpendActionEnergy, spendActionEnergy } from './actionEnergy';
import { getEffectiveSpendCost } from './fiscal';

export const INSTALL_CLIENT_TP_COST = 18;

export function createUsaCampaignState(startTurn: number): UsaCampaignState {
  return {
    briefAcknowledged: false,
    ukraineAlignment: 'ukraine',
    activeMission: {
      missionId: USA_MISSION_CUBA.id,
      targetCountryId: USA_MISSION_CUBA.targetCountryId,
      startTurn,
      deadlineTurn: startTurn + USA_MISSION_CUBA.durationTurns,
      status: 'active',
    },
    completedMissions: [],
    clientStates: [],
    peerChoicePending: false,
    peerTargetId: null,
  };
}

export function acknowledgeCampaignBrief(
  state: GameState,
  alignment: UkraineAlignment
): void {
  if (!state.usaCampaign) return;
  state.usaCampaign.briefAcknowledged = true;
  setUkraineAlignment(state, alignment);
  const m = state.usaCampaign.activeMission;
  if (m) {
    state.history.push(
      `Turn ${state.turn}: Mission assigned — ${USA_MISSION_CUBA.title} (deadline turn ${m.deadlineTurn}).`
    );
  }
}

/** Alignment may be revisited; each flip away from Ukraine costs credibility. */
export function setUkraineAlignment(state: GameState, alignment: UkraineAlignment): void {
  if (!state.usaCampaign) return;
  const prev = state.usaCampaign.ukraineAlignment;
  state.usaCampaign.ukraineAlignment = alignment;
  if (prev === alignment) return;

  if (alignment === 'ukraine') {
    modifyRelation(state.relations, 'usa', 'ukraine', 8);
    modifyRelation(state.relations, 'usa', 'russia', -6);
    modifyRelation(state.relations, 'usa', 'england', 4);
    state.history.push(`Turn ${state.turn}: Washington reaffirms support for Ukraine.`);
  } else if (alignment === 'russia') {
    modifyRelation(state.relations, 'usa', 'russia', 12);
    modifyRelation(state.relations, 'usa', 'ukraine', -18);
    modifyRelation(state.relations, 'usa', 'england', -10);
    state.internationalPariahTurns = Math.max(state.internationalPariahTurns ?? 0, 2);
    state.history.push(
      `Turn ${state.turn}: Washington tilts toward Moscow — NATO cohesion fractures, Kyiv feels abandoned.`
    );
  } else {
    modifyRelation(state.relations, 'usa', 'ukraine', -6);
    modifyRelation(state.relations, 'usa', 'russia', 2);
    modifyRelation(state.relations, 'usa', 'england', -3);
    state.history.push(
      `Turn ${state.turn}: Washington chooses plausible deniability on Ukraine — allies notice.`
    );
  }
}

export function getNationControlByPlayer(
  state: GameState,
  nationId: string
): { total: number; owned: number; avgUnrest: number } {
  const regions = getRegionsForCountry(nationId);
  let owned = 0;
  let unrestSum = 0;
  for (const r of regions) {
    const rt = state.regions[r.id];
    if (!rt) continue;
    unrestSum += rt.unrest;
    if (rt.controlledBy === state.playerCountryId) owned += 1;
  }
  return {
    total: regions.length,
    owned,
    avgUnrest: regions.length ? unrestSum / regions.length : 0,
  };
}

function missionTargetFullyConquered(state: GameState, targetId: string): boolean {
  const { total, owned } = getNationControlByPlayer(state, targetId);
  return total > 0 && owned === total;
}

function isClient(state: GameState, nationId: string): boolean {
  return (state.usaCampaign?.clientStates ?? []).includes(nationId);
}

export interface InstallClientPreview {
  canInstall: boolean;
  blockReason?: string;
  costTp: number;
  energyCost: number;
  reasonsMet: string[];
}

export function getInstallClientPreview(
  state: GameState,
  nationId: string
): InstallClientPreview {
  const energyCost = ACTION_ENERGY_COSTS.install_client;
  const costTp = getEffectiveSpendCost(
    state.countries[state.playerCountryId]!,
    INSTALL_CLIENT_TP_COST
  );
  const empty = { canInstall: false, costTp, energyCost, reasonsMet: [] as string[] };

  if (!state.usaCampaign) {
    return { ...empty, blockReason: 'Not in USA campaign.' };
  }
  const mission = state.usaCampaign.activeMission;
  if (!mission || mission.status !== 'active' || mission.targetCountryId !== nationId) {
    return { ...empty, blockReason: 'No active mission against this nation.' };
  }
  if (isClient(state, nationId)) {
    return { ...empty, blockReason: 'Already a client government.' };
  }
  if (missionTargetFullyConquered(state, nationId)) {
    return { ...empty, blockReason: 'Fully conquered — mission completes on conquer.' };
  }
  if (!isAtWarWith(state, state.playerCountryId, nationId)) {
    return { ...empty, blockReason: 'Must be at war to force a client regime.' };
  }

  const control = getNationControlByPlayer(state, nationId);
  const target = state.countries[nationId];
  const reasonsMet: string[] = [];
  if (control.owned >= 1) reasonsMet.push(`Occupy ${control.owned}/${control.total} regions`);
  if ((target?.stats.warExhaustion ?? 0) >= 0.28) {
    reasonsMet.push('Target war exhaustion high');
  }
  if (control.avgUnrest >= 40) reasonsMet.push('Island unrest critical');

  if (reasonsMet.length === 0) {
    return {
      ...empty,
      blockReason:
        'Need occupation, high Cuban exhaustion, or average regional unrest ≥ 40.',
    };
  }
  if (!canSpendActionEnergy(state, energyCost)) {
    return { ...empty, blockReason: `Need ${energyCost} action energy.`, reasonsMet };
  }
  const player = state.countries[state.playerCountryId];
  if (!player || player.stats.treasuryPoints < costTp) {
    return { ...empty, blockReason: `Need $${costTp}B for transition package.`, reasonsMet };
  }

  return { canInstall: true, costTp, energyCost, reasonsMet };
}

/** Install a Washington-aligned government on the mission target. */
export function installCampaignClient(state: GameState, nationId: string): string | null {
  const preview = getInstallClientPreview(state, nationId);
  if (!preview.canInstall) return preview.blockReason ?? 'Cannot install client.';

  const player = state.countries[state.playerCountryId]!;
  if (!spendActionEnergy(state, preview.energyCost)) {
    return 'Not enough action energy.';
  }
  player.stats.treasuryPoints -= preview.costTp;

  state.usaCampaign!.clientStates.push(nationId);
  for (const region of getRegionsForCountry(nationId)) {
    const r = state.regions[region.id];
    if (r) {
      r.controlledBy = nationId;
      r.unrest = Math.max(r.unrest, 40);
    }
  }

  // End war with the new client — they are on your side now
  state.wars = state.wars.filter(
    w =>
      !(
        w.belligerents.includes(state.playerCountryId) &&
        w.belligerents.includes(nationId) &&
        w.belligerents.length === 2
      )
  );
  state.fronts = state.fronts.filter(
    f =>
      !(
        (f.attackerCountryId === state.playerCountryId && f.defenderCountryId === nationId) ||
        (f.defenderCountryId === state.playerCountryId && f.attackerCountryId === nationId)
      )
  );

  modifyRelation(state.relations, 'usa', nationId, 45);
  modifyRelation(state.relations, 'usa', 'russia', -8);
  modifyRelation(state.relations, 'usa', 'china', -6);
  state.internationalPariahTurns = Math.max(state.internationalPariahTurns ?? 0, 2);

  const name = state.countries[nationId]?.name ?? nationId;
  state.history.push(
    `Turn ${state.turn}: ${name} installs a Washington-aligned government (client state). War ends; transition cost $${preview.costTp}B.`
  );

  // Immediate mission check
  tickUsaCampaign(state);
  return null;
}

export function tickUsaCampaign(state: GameState): void {
  if (!isUsaCampaignMode(state.gameMode) || !state.usaCampaign) return;
  const camp = state.usaCampaign;
  const mission = camp.activeMission;

  if (mission && mission.status === 'active') {
    const targetId = mission.targetCountryId;
    const won =
      missionTargetFullyConquered(state, targetId) || isClient(state, targetId);
    if (won) {
      mission.status = 'won';
      if (!camp.completedMissions.includes(mission.missionId)) {
        camp.completedMissions.push(mission.missionId);
      }
      const how = isClient(state, targetId) ? 'client government' : 'military conquest';
      state.history.push(
        `Turn ${state.turn}: Mission complete — ${USA_MISSION_CUBA.title} (${how}).`
      );
    } else if (state.turn > mission.deadlineTurn) {
      mission.status = 'failed';
      state.gameOver = true;
      state.gameOverReason = `Mission failed: ${USA_MISSION_CUBA.title} — deadline missed.`;
      state.history.push(`Turn ${state.turn}: ${state.gameOverReason}`);
    }
  }

  const atWarWithPeer = PEER_THREAT_IDS.some(id =>
    state.wars.some(
      w => w.belligerents.includes(state.playerCountryId) && w.belligerents.includes(id)
    )
  );
  if (
    state.turn >= PEER_FORCE_PICK_TURN &&
    !atWarWithPeer &&
    !camp.peerTargetId &&
    !camp.peerChoicePending
  ) {
    camp.peerChoicePending = true;
    state.history.push(
      `Turn ${state.turn}: National Security Council demands a peer choice — Russia or China.`
    );
  }
}

export function pickPeerThreat(state: GameState, peerId: 'russia' | 'china'): string | null {
  if (!state.usaCampaign?.peerChoicePending) return 'No peer choice pending.';
  if (!PEER_THREAT_IDS.includes(peerId)) return 'Invalid peer.';
  state.usaCampaign.peerTargetId = peerId;
  state.usaCampaign.peerChoicePending = false;
  const name = state.countries[peerId]?.name ?? peerId;
  modifyRelation(state.relations, 'usa', peerId, -15);
  state.history.push(
    `Turn ${state.turn}: Washington designates ${name} as the primary peer threat.`
  );
  return null;
}

export function getCampaignBriefCopy() {
  return USA_CAMPAIGN_BRIEF;
}

export interface MissionHudInfo {
  title: string;
  targetName: string;
  targetId: string;
  status: string;
  turnsLeft: number | null;
  deadlineTurn: number;
  controlOwned: number;
  controlTotal: number;
  isClient: boolean;
  atWar: boolean;
  winPaths: string[];
  blurb: string;
}

export function getMissionHud(state: GameState): MissionHudInfo | null {
  const camp = state.usaCampaign;
  const mission = camp?.activeMission;
  if (!camp || !mission) return null;

  const target = state.countries[mission.targetCountryId];
  const control = getNationControlByPlayer(state, mission.targetCountryId);
  const turnsLeft =
    mission.status === 'active' ? Math.max(0, mission.deadlineTurn - state.turn) : null;

  return {
    title: USA_MISSION_CUBA.title,
    targetName: target?.name ?? mission.targetCountryId,
    targetId: mission.targetCountryId,
    status: mission.status,
    turnsLeft,
    deadlineTurn: mission.deadlineTurn,
    controlOwned: control.owned,
    controlTotal: control.total,
    isClient: isClient(state, mission.targetCountryId),
    atWar: isAtWarWith(state, state.playerCountryId, mission.targetCountryId),
    winPaths: [
      `Conquer all ${control.total} regions (${control.owned}/${control.total})`,
      'Or install a client government while at war',
    ],
    blurb: USA_MISSION_CUBA.blurb,
  };
}

export function getActiveMissionSummary(state: GameState): string | null {
  const hud = getMissionHud(state);
  if (!hud || hud.status !== 'active') {
    if (hud?.status === 'won') return `${hud.title} · Complete`;
    return null;
  }
  return `${hud.targetName} · ${hud.controlOwned}/${hud.controlTotal} · ${hud.turnsLeft}t left`;
}

export function getUkraineAlignmentLabel(a: UkraineAlignment): string {
  if (a === 'ukraine') return 'Back Ukraine';
  if (a === 'russia') return 'Tilt Moscow';
  return 'Deniable';
}

export function previewAlignmentHit(state: GameState, alignment: UkraineAlignment): string {
  const ua = getRelation(state.relations, 'usa', 'ukraine');
  const ru = getRelation(state.relations, 'usa', 'russia');
  void alignment;
  return `UA ${ua > 0 ? '+' : ''}${ua} · RU ${ru > 0 ? '+' : ''}${ru}`;
}

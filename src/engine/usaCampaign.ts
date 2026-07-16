import type { GameState, UkraineAlignment, UsaCampaignState } from '../types/game';
import {
  USA_MISSION_CUBA,
  PEER_FORCE_PICK_TURN,
  PEER_THREAT_IDS,
  PEER_WAR_BY_TURNS,
  PEER_EXHAUSTION_WIN,
  PEER_FOOTHOLD_REGIONS,
  PEER_UKRAINE_SOVEREIGNTY_WIN,
  isUsaCampaignMode,
  getCampaignMissionDef,
  getPeerMissionDef,
  isPeerMissionId,
  type PeerThreatId,
} from '../data/campaignUsa';
import { CUTSCENE_USA_INTRO_CIA } from '../data/cutscenes';
import { modifyRelation } from '../data/relations';
import { getRegionsForCountry } from '../data/regions';
import { isAtWarWith } from './actions';
import { ACTION_ENERGY_COSTS, canSpendActionEnergy, spendActionEnergy } from './actionEnergy';
import { getEffectiveSpendCost, previewSpendFiscalImpact, type SpendFiscalPreview } from './fiscal';
import { formatDisplayCost } from './treasuryDisplay';

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
  if (state.activeCutscene?.sceneId === CUTSCENE_USA_INTRO_CIA.id) {
    state.activeCutscene = null;
  }
  state.completedCutscenes ??= [];
  if (!state.completedCutscenes.includes(CUTSCENE_USA_INTRO_CIA.id)) {
    state.completedCutscenes.push(CUTSCENE_USA_INTRO_CIA.id);
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

function getNationControlByPlayer(
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

function homeControlFraction(state: GameState, nationId: string): number {
  const regions = getRegionsForCountry(nationId);
  if (regions.length === 0) return 0;
  let owned = 0;
  for (const r of regions) {
    if (state.regions[r.id]?.controlledBy === nationId) owned += 1;
  }
  return owned / regions.length;
}

function missionTargetFullyConquered(state: GameState, targetId: string): boolean {
  const { total, owned } = getNationControlByPlayer(state, targetId);
  return total > 0 && owned === total;
}

function isClient(state: GameState, nationId: string): boolean {
  return (state.usaCampaign?.clientStates ?? []).includes(nationId);
}

function detectPeerAtWar(state: GameState): PeerThreatId | null {
  for (const id of PEER_THREAT_IDS) {
    if (isAtWarWith(state, state.playerCountryId, id)) return id;
  }
  return null;
}

function peerMissionAlreadyComplete(camp: UsaCampaignState): boolean {
  return camp.completedMissions.some(id => isPeerMissionId(id));
}

function assignPeerMission(state: GameState, peerId: PeerThreatId): void {
  const camp = state.usaCampaign;
  if (!camp) return;
  if (!camp.completedMissions.includes(USA_MISSION_CUBA.id)) return;
  if (peerMissionAlreadyComplete(camp)) return;

  const def = getPeerMissionDef(peerId);
  if (camp.activeMission?.status === 'active' && camp.activeMission.missionId === def.id) {
    return;
  }

  camp.peerTargetId = peerId;
  camp.peerChoicePending = false;
  camp.activeMission = {
    missionId: def.id,
    targetCountryId: def.targetCountryId,
    startTurn: state.turn,
    deadlineTurn: state.turn + def.durationTurns,
    status: 'active',
  };

  const warBy = state.turn + PEER_WAR_BY_TURNS;
  state.history.push(
    `Turn ${state.turn}: Mission assigned — ${def.title} (deadline turn ${camp.activeMission.deadlineTurn}). Open war by turn ${warBy}.`
  );
}

/** After Cuba: start peer mission if rival already known or already at war. */
function tryAdvanceAfterCuba(state: GameState): void {
  const camp = state.usaCampaign;
  if (!camp) return;
  if (!camp.completedMissions.includes(USA_MISSION_CUBA.id)) return;
  if (peerMissionAlreadyComplete(camp)) return;

  const active = camp.activeMission;
  if (active?.status === 'active' && isPeerMissionId(active.missionId)) return;

  const peer = (camp.peerTargetId as PeerThreatId | null) ?? detectPeerAtWar(state);
  if (peer) {
    assignPeerMission(state, peer);
  }
}

function peerContestWon(state: GameState, targetId: string): boolean {
  const atWar = isAtWarWith(state, state.playerCountryId, targetId);
  if (!atWar) return false;

  const control = getNationControlByPlayer(state, targetId);
  if (control.owned >= PEER_FOOTHOLD_REGIONS) return true;

  const exhaustion = state.countries[targetId]?.stats.warExhaustion ?? 0;
  if (exhaustion >= PEER_EXHAUSTION_WIN) return true;

  if (targetId === 'russia') {
    if (homeControlFraction(state, 'ukraine') >= PEER_UKRAINE_SOVEREIGNTY_WIN) return true;
  }

  return false;
}

function missionWon(state: GameState, missionId: string, targetId: string): boolean {
  const def = getCampaignMissionDef(missionId);
  if (def?.kind === 'peer_contest') {
    return peerContestWon(state, targetId);
  }
  return missionTargetFullyConquered(state, targetId) || isClient(state, targetId);
}

function completeCampaignVictory(state: GameState, peerName: string): void {
  state.playerWon = true;
  state.winReason = `Hegemony restored — Caribbean secured and ${peerName} broken as a peer.`;
  state.history.push(`Turn ${state.turn}: VICTORY — ${state.winReason}`);
}

export interface InstallClientPreview {
  canInstall: boolean;
  blockReason?: string;
  /** Package sticker price before debt surcharge */
  baseCostTp: number;
  /** Effective TP charged (debt tax included) */
  costTp: number;
  energyCost: number;
  reasonsMet: string[];
  fiscal: SpendFiscalPreview | null;
  costLabel: string;
}

export function getInstallClientPreview(
  state: GameState,
  nationId: string
): InstallClientPreview {
  const energyCost = ACTION_ENERGY_COSTS.install_client;
  const player = state.countries[state.playerCountryId];
  const baseCostTp = INSTALL_CLIENT_TP_COST;
  const costTp = player ? getEffectiveSpendCost(player, baseCostTp) : baseCostTp;
  const fiscal = previewSpendFiscalImpact(state, state.playerCountryId, baseCostTp);
  const costLabel =
    Math.abs(costTp - baseCostTp) > 0.05
      ? `${formatDisplayCost(costTp)} (base ${formatDisplayCost(baseCostTp)} + debt tax)`
      : formatDisplayCost(costTp);
  const empty: InstallClientPreview = {
    canInstall: false,
    baseCostTp,
    costTp,
    energyCost,
    reasonsMet: [],
    fiscal,
    costLabel,
  };

  if (!state.usaCampaign) {
    return { ...empty, blockReason: 'Not in USA campaign.' };
  }
  const mission = state.usaCampaign.activeMission;
  if (!mission || mission.status !== 'active' || mission.targetCountryId !== nationId) {
    return { ...empty, blockReason: 'No active mission against this nation.' };
  }
  const def = getCampaignMissionDef(mission.missionId);
  if (!def?.allowsClientInstall) {
    return { ...empty, blockReason: 'Client install is not available on this mission.' };
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
  if (!player || player.stats.treasuryPoints < costTp) {
    return {
      ...empty,
      blockReason: `Need ${costLabel} for transition package.`,
      reasonsMet,
    };
  }

  return { canInstall: true, baseCostTp, costTp, energyCost, reasonsMet, fiscal, costLabel };
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

  tickUsaCampaign(state);
  return null;
}

export function tickUsaCampaign(state: GameState): void {
  if (!isUsaCampaignMode(state.gameMode) || !state.usaCampaign) return;
  if (state.gameOver || state.playerWon) return;

  const camp = state.usaCampaign;
  const mission = camp.activeMission;

  if (mission && mission.status === 'active') {
    const def = getCampaignMissionDef(mission.missionId);
    const targetId = mission.targetCountryId;
    const title = def?.title ?? mission.missionId;

    if (def?.kind === 'peer_contest') {
      const warByTurn = mission.startTurn + PEER_WAR_BY_TURNS;
      if (state.turn > warByTurn && !isAtWarWith(state, state.playerCountryId, targetId)) {
        mission.status = 'failed';
        state.gameOver = true;
        state.gameOverReason = `Mission failed: ${title} — did not open war by turn ${warByTurn}.`;
        state.history.push(`Turn ${state.turn}: ${state.gameOverReason}`);
        return;
      }
    }

    if (missionWon(state, mission.missionId, targetId)) {
      mission.status = 'won';
      if (!camp.completedMissions.includes(mission.missionId)) {
        camp.completedMissions.push(mission.missionId);
      }
      const how =
        def?.kind === 'peer_contest'
          ? 'peer broken'
          : isClient(state, targetId)
            ? 'client government'
            : 'military conquest';
      state.history.push(`Turn ${state.turn}: Mission complete — ${title} (${how}).`);

      if (def?.kind === 'peer_contest') {
        const peerName = state.countries[targetId]?.name ?? targetId;
        completeCampaignVictory(state, peerName);
        return;
      }

      tryAdvanceAfterCuba(state);
    } else if (state.turn > mission.deadlineTurn) {
      mission.status = 'failed';
      state.gameOver = true;
      state.gameOverReason = `Mission failed: ${title} — deadline missed.`;
      state.history.push(`Turn ${state.turn}: ${state.gameOverReason}`);
      return;
    }
  }

  // Pre-pick: already at war with a peer after Cuba → assign without modal
  if (
    camp.completedMissions.includes(USA_MISSION_CUBA.id) &&
    !peerMissionAlreadyComplete(camp) &&
    !(camp.activeMission?.status === 'active' && isPeerMissionId(camp.activeMission.missionId))
  ) {
    const peerAtWar = detectPeerAtWar(state);
    if (peerAtWar) {
      assignPeerMission(state, peerAtWar);
    }
  }

  const atWarWithPeer = detectPeerAtWar(state) !== null;
  if (
    state.turn >= PEER_FORCE_PICK_TURN &&
    camp.completedMissions.includes(USA_MISSION_CUBA.id) &&
    !atWarWithPeer &&
    !camp.peerTargetId &&
    !camp.peerChoicePending &&
    !peerMissionAlreadyComplete(camp)
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

  const name = state.countries[peerId]?.name ?? peerId;
  modifyRelation(state.relations, 'usa', peerId, -15);
  state.history.push(
    `Turn ${state.turn}: Washington designates ${name} as the primary peer threat.`
  );

  assignPeerMission(state, peerId);
  return null;
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
  allowsClientInstall: boolean;
  kind: 'client_or_conquer' | 'peer_contest';
  winPaths: string[];
  /** Short teaching steps for the active mission */
  howToSteps: string[];
  blurb: string;
  peerWarByTurn: number | null;
  targetExhaustion: number;
  ukraineSovereignFrac: number | null;
}

export function getMissionHud(state: GameState): MissionHudInfo | null {
  const camp = state.usaCampaign;
  const mission = camp?.activeMission;
  if (!camp || !mission) return null;

  const def = getCampaignMissionDef(mission.missionId);
  const target = state.countries[mission.targetCountryId];
  const control = getNationControlByPlayer(state, mission.targetCountryId);
  const turnsLeft =
    mission.status === 'active' ? Math.max(0, mission.deadlineTurn - state.turn) : null;
  const atWar = isAtWarWith(state, state.playerCountryId, mission.targetCountryId);
  const exhaustion = target?.stats.warExhaustion ?? 0;
  const kind = def?.kind ?? 'client_or_conquer';

  const winPaths: string[] =
    kind === 'peer_contest'
      ? [
          `At war + foothold ≥${PEER_FOOTHOLD_REGIONS} region (${control.owned}/${control.total})`,
          `At war + exhaustion ≥${Math.round(PEER_EXHAUSTION_WIN * 100)}% (now ${Math.round(exhaustion * 100)}%)`,
          ...(mission.targetCountryId === 'russia'
            ? [
                `At war + Ukraine ≥${Math.round(PEER_UKRAINE_SOVEREIGNTY_WIN * 100)}% sovereign (now ${Math.round(homeControlFraction(state, 'ukraine') * 100)}%)`,
              ]
            : []),
        ]
      : [
          `Conquer all ${control.total} regions (${control.owned}/${control.total})`,
          'Or install a client government while at war',
        ];

  const howToSteps: string[] =
    kind === 'peer_contest'
      ? atWar
        ? [
            'Push war exhaustion with strikes/campaigns, or take a foothold region.',
            ...(mission.targetCountryId === 'russia'
              ? ['Vs Russia you can also win by keeping Ukraine mostly sovereign while at war.']
              : []),
            'Watch the deadline — miss it and the campaign fails.',
          ]
        : [
            `Declare war on ${target?.name ?? 'the peer'} before the war-by deadline.`,
            mission.targetCountryId === 'russia'
              ? 'Then break them via foothold, exhaustion, or Ukraine sovereignty.'
              : 'Then break them via foothold or war exhaustion.',
          ]
      : atWar
        ? [
            'Open the island map — fronts push every End Turn from adjacent regions (start Southeast → Western Cuba).',
            'Strikes soften garrisons; full conquest flips all regions, or install a client once a gate is met.',
            'Bank ⚡ and treasury before Install Client — debt raises the package price.',
          ]
        : [
            `Declare war on ${target?.name ?? 'the target'} from this panel or Diplomacy.`,
            'Open their map and End Turn to grind front pressure — that is how land changes hands.',
            'Win by conquering every region, or by installing a client government mid-war.',
          ];

  return {
    title: def?.title ?? mission.missionId,
    targetName: target?.name ?? mission.targetCountryId,
    targetId: mission.targetCountryId,
    status: mission.status,
    turnsLeft,
    deadlineTurn: mission.deadlineTurn,
    controlOwned: control.owned,
    controlTotal: control.total,
    isClient: isClient(state, mission.targetCountryId),
    atWar,
    allowsClientInstall: def?.allowsClientInstall ?? false,
    kind,
    winPaths,
    howToSteps,
    blurb: def?.blurb ?? '',
    peerWarByTurn:
      kind === 'peer_contest' && mission.status === 'active'
        ? mission.startTurn + PEER_WAR_BY_TURNS
        : null,
    targetExhaustion: exhaustion,
    ukraineSovereignFrac:
      mission.targetCountryId === 'russia' ? homeControlFraction(state, 'ukraine') : null,
  };
}

export function getActiveMissionSummary(state: GameState): string | null {
  const camp = state.usaCampaign;
  if (!camp) return null;

  const hud = getMissionHud(state);
  if (hud?.status === 'active') {
    return `${hud.targetName} · ${hud.controlOwned}/${hud.controlTotal} · ${hud.turnsLeft}t left`;
  }

  const mission = camp.activeMission;
  if (mission?.status === 'won') {
    if (isPeerMissionId(mission.missionId)) {
      return `${hud?.title ?? 'Peer Contest'} · Complete`;
    }
    if (camp.peerChoicePending) return 'Peer choice pending';
    if (!camp.peerTargetId && state.turn < PEER_FORCE_PICK_TURN) {
      return `Cuba secured · Peer at T${PEER_FORCE_PICK_TURN}`;
    }
    return `${hud?.title ?? 'Mission'} · Complete`;
  }

  return null;
}

export interface CampaignLadderProgress {
  description: string;
  progress: number;
  met: boolean;
  details: string[];
}

/** SidePanel / victory UI for USA campaign (replaces sandbox Pax floors). */
export function getUsaCampaignLadderProgress(state: GameState): CampaignLadderProgress {
  const camp = state.usaCampaign;
  if (!camp) {
    return { description: 'No campaign loaded.', progress: 0, met: false, details: [] };
  }

  const cubaDone = camp.completedMissions.includes(USA_MISSION_CUBA.id);
  const peerDone = peerMissionAlreadyComplete(camp);
  const peerNamed = Boolean(camp.peerTargetId) || detectPeerAtWar(state) !== null;
  const peerMissionActive =
    camp.activeMission?.status === 'active' &&
    isPeerMissionId(camp.activeMission.missionId);

  const details: string[] = [
    `${cubaDone ? '✓' : '○'} Mission 1 — Caribbean Restoration`,
    `${peerNamed || peerMissionActive || peerDone ? '✓' : '○'} Peer rival designated (Russia or China)`,
    `${peerDone ? '✓' : '○'} Mission 2 — Peer Contest`,
    `${state.playerWon ? '✓' : '○'} Hegemony victory`,
  ];

  const steps = [cubaDone, peerNamed || peerMissionActive || peerDone, peerDone, state.playerWon];
  const progress = steps.filter(Boolean).length / steps.length;

  return {
    description: 'Complete the USA hegemony campaign ladder.',
    progress,
    met: Boolean(state.playerWon),
    details,
  };
}

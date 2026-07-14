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

function cubaControlledByUsa(state: GameState): boolean {
  const regions = getRegionsForCountry('cuba');
  if (regions.length === 0) return false;
  return regions.every(r => state.regions[r.id]?.controlledBy === 'usa');
}

function cubaIsClient(state: GameState): boolean {
  return (state.usaCampaign?.clientStates ?? []).includes('cuba');
}

/** Stub install — full puppet diplomacy comes later. */
export function installCampaignClient(state: GameState, nationId: string): string | null {
  if (!state.usaCampaign) return 'Not in USA campaign.';
  if (state.usaCampaign.clientStates.includes(nationId)) return 'Already a client.';
  state.usaCampaign.clientStates.push(nationId);
  for (const region of getRegionsForCountry(nationId)) {
    const r = state.regions[region.id];
    if (r) {
      r.controlledBy = nationId;
      r.unrest = Math.max(r.unrest, 35);
    }
  }
  modifyRelation(state.relations, 'usa', nationId, 40);
  const name = state.countries[nationId]?.name ?? nationId;
  state.history.push(
    `Turn ${state.turn}: ${name} installs a Washington-aligned government (client state).`
  );
  return null;
}

export function tickUsaCampaign(state: GameState): void {
  if (!isUsaCampaignMode(state.gameMode) || !state.usaCampaign) return;
  const camp = state.usaCampaign;
  const mission = camp.activeMission;

  if (mission && mission.status === 'active') {
    const won = cubaControlledByUsa(state) || cubaIsClient(state);
    if (won) {
      mission.status = 'won';
      camp.completedMissions.push(mission.missionId);
      state.history.push(
        `Turn ${state.turn}: Mission complete — ${USA_MISSION_CUBA.title}. Cuba is secured.`
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

export function getActiveMissionSummary(state: GameState): string | null {
  const m = state.usaCampaign?.activeMission;
  if (!m || m.status !== 'active') return null;
  const target = state.countries[m.targetCountryId]?.name ?? m.targetCountryId;
  const left = Math.max(0, m.deadlineTurn - state.turn);
  return `${target} · ${left} turn${left !== 1 ? 's' : ''} left`;
}

export function getUkraineAlignmentLabel(a: UkraineAlignment): string {
  if (a === 'ukraine') return 'Back Ukraine';
  if (a === 'russia') return 'Tilt Moscow';
  return 'Deniable';
}

/** Debug/helper — relation snapshot for brief UI */
export function previewAlignmentHit(state: GameState, alignment: UkraineAlignment): string {
  const ua = getRelation(state.relations, 'usa', 'ukraine');
  const ru = getRelation(state.relations, 'usa', 'russia');
  void alignment;
  return `UA ${ua > 0 ? '+' : ''}${ua} · RU ${ru > 0 ? '+' : ''}${ru}`;
}

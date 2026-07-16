import type { GameMode, UkraineAlignment } from '../types/game';

/** Locked USA campaign design — Eastern Escalation / hemispheric hegemony. */

export const USA_CAMPAIGN_ID = 'usa_hegemony_v1' as const;

/** Select-screen card — keep copy vague; no mission spoilers. */
export const USA_CAMPAIGN_CARD = {
  id: USA_CAMPAIGN_ID,
  title: 'United States',
  gist: 'Hegemony under pressure. Shape the century from Washington — friends, clients, and rivals included.',
  difficultyLabel: 'Hard',
  estimateTurnsLabel: '80–120 turns',
} as const;

export interface CampaignSelectEntry {
  id: string;
  title: string;
  available: boolean;
  gist?: string;
  difficultyLabel?: string;
  estimateTurnsLabel?: string;
}

export const CAMPAIGN_SELECT_ENTRIES: CampaignSelectEntry[] = [
  {
    id: USA_CAMPAIGN_CARD.id,
    title: USA_CAMPAIGN_CARD.title,
    available: true,
    gist: USA_CAMPAIGN_CARD.gist,
    difficultyLabel: USA_CAMPAIGN_CARD.difficultyLabel,
    estimateTurnsLabel: USA_CAMPAIGN_CARD.estimateTurnsLabel,
  },
  { id: 'campaign_slot_b', title: 'Coming soon', available: false },
  { id: 'campaign_slot_c', title: 'Coming soon', available: false },
];

export type { UkraineAlignment };

export interface CampaignMissionDef {
  id: string;
  title: string;
  targetCountryId: string;
  durationTurns: number;
  blurb: string;
  /** Client government option (Caribbean-style targets). Off for peer contests. */
  allowsClientInstall: boolean;
  kind: 'client_or_conquer' | 'peer_contest';
}

export const USA_MISSION_CUBA: CampaignMissionDef = {
  id: 'mission_cuba',
  title: 'Caribbean Restoration',
  targetCountryId: 'cuba',
  durationTurns: 20,
  allowsClientInstall: true,
  kind: 'client_or_conquer',
  blurb:
    'Bring Cuba into the American orbit — conquer the island or install a government that loves Washington. You have 20 turns.',
};

export const USA_MISSION_PEER_RUSSIA: CampaignMissionDef = {
  id: 'mission_peer_russia',
  title: 'Peer Contest — Russia',
  targetCountryId: 'russia',
  durationTurns: 40,
  allowsClientInstall: false,
  kind: 'peer_contest',
  blurb:
    'Break Moscow as a peer. Declare war, then grind exhaustion, take a foothold, or keep Ukraine mostly sovereign while at war.',
};

export const USA_MISSION_PEER_CHINA: CampaignMissionDef = {
  id: 'mission_peer_china',
  title: 'Peer Contest — China',
  targetCountryId: 'china',
  durationTurns: 40,
  allowsClientInstall: false,
  kind: 'peer_contest',
  blurb:
    'Break Beijing as a peer. Declare war, then grind Chinese war exhaustion or seize a foothold on the map.',
};

export const USA_CAMPAIGN_MISSIONS: CampaignMissionDef[] = [
  USA_MISSION_CUBA,
  USA_MISSION_PEER_RUSSIA,
  USA_MISSION_PEER_CHINA,
];

export const PEER_FORCE_PICK_TURN = 60;

/** Soft force: peer contest fails if still not at war this many turns after assignment. */
export const PEER_WAR_BY_TURNS = 15;

export const PEER_THREAT_IDS = ['russia', 'china'] as const;
export type PeerThreatId = (typeof PEER_THREAT_IDS)[number];

export const PEER_EXHAUSTION_WIN = 0.32;
export const PEER_FOOTHOLD_REGIONS = 1;
export const PEER_UKRAINE_SOVEREIGNTY_WIN = 0.55;

export function isUsaCampaignMode(mode: GameMode | undefined): boolean {
  return mode === 'campaign';
}

export function getCampaignMissionDef(missionId: string): CampaignMissionDef | undefined {
  return USA_CAMPAIGN_MISSIONS.find(m => m.id === missionId);
}

export function getPeerMissionDef(peerId: PeerThreatId): CampaignMissionDef {
  return peerId === 'russia' ? USA_MISSION_PEER_RUSSIA : USA_MISSION_PEER_CHINA;
}

export function isPeerMissionId(missionId: string): boolean {
  return (
    missionId === USA_MISSION_PEER_RUSSIA.id || missionId === USA_MISSION_PEER_CHINA.id
  );
}

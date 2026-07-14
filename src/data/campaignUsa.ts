import type { GameMode, UkraineAlignment } from '../types/game';

/** Locked USA campaign design — Eastern Escalation / hemispheric hegemony. */

export const USA_CAMPAIGN_ID = 'usa_hegemony_v1' as const;

export const USA_CAMPAIGN_BRIEF = {
  headline: 'Freedom for All of Them',
  paragraphs: [
    'US hegemony is more at risk than ever. Russia rising, China arguably more powerful than us already, and a Middle East too fractured to control.',
    'It’s time to bring freedom to the people of Earth. All of them.',
  ],
  ukraineNote:
    'Russia’s war on Ukraine is already burning. Default posture is to back Kyiv — you may revisit alignment later, but every flip leaves scars.',
} as const;

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
}

export const USA_MISSION_CUBA: CampaignMissionDef = {
  id: 'mission_cuba',
  title: 'Caribbean Restoration',
  targetCountryId: 'cuba',
  durationTurns: 20,
  blurb:
    'Bring Cuba into the American orbit — conquer the island or install a government that loves Washington. You have 20 turns.',
};

export const USA_CAMPAIGN_MISSIONS: CampaignMissionDef[] = [USA_MISSION_CUBA];

export const PEER_FORCE_PICK_TURN = 60;

export const PEER_THREAT_IDS = ['russia', 'china'] as const;

export function isUsaCampaignMode(mode: GameMode | undefined): boolean {
  return mode === 'campaign';
}

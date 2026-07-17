import type { GameMode } from '../types/game';
import { COUNTRIES } from './countries';

export interface GameModeDef {
  id: GameMode;
  name: string;
  blurb: string;
  /** Country ids the player may choose. Empty = all currently playable nations. */
  playableCountryIds: string[] | null;
}

/** Opening USA campaign — only America is playable; everyone else is NPC. */
export const CAMPAIGN_PLAYABLE_IDS = ['usa'] as const;

export const GAME_MODES: Record<GameMode, GameModeDef> = {
  sandbox: {
    id: 'sandbox',
    name: 'Sandbox',
    blurb: 'Any nation. Open board. Rule the world your way.',
    playableCountryIds: null,
  },
  campaign: {
    id: 'campaign',
    name: 'Campaign',
    blurb: 'Scripted paths with clear pressure — start with the United States.',
    playableCountryIds: [...CAMPAIGN_PLAYABLE_IDS],
  },
};

export function getPlayableCountriesForMode(mode: GameMode) {
  const def = GAME_MODES[mode];
  const all = Object.values(COUNTRIES).filter(c => c.playable);
  if (!def.playableCountryIds) return all;
  const allow = new Set(def.playableCountryIds);
  return all.filter(c => allow.has(c.id));
}

export function formatModeLabel(mode: GameMode): string {
  return GAME_MODES[mode]?.name ?? mode;
}

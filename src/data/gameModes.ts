import type { GameMode } from '../types/game';
import { COUNTRIES } from './countries';

export interface GameModeDef {
  id: GameMode;
  name: string;
  blurb: string;
  /** Country ids the player may choose. Empty = all currently playable nations. */
  playableCountryIds: string[] | null;
}

/** Opening Eastern Escalation — four great-power seats around the live Ukraine war. */
export const CAMPAIGN_PLAYABLE_IDS = ['usa', 'russia', 'england', 'china'] as const;

export const GAME_MODES: Record<GameMode, GameModeDef> = {
  sandbox: {
    id: 'sandbox',
    name: 'Sandbox',
    blurb: 'All playable nations. Open board — write your own century.',
    playableCountryIds: null,
  },
  campaign: {
    id: 'campaign',
    name: 'Campaign',
    blurb: 'Eastern Escalation. Four seats, scripted pressure, and the Ukraine theater already hot.',
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

export function isCountryPlayableInMode(countryId: string, mode: GameMode): boolean {
  return getPlayableCountriesForMode(mode).some(c => c.id === countryId);
}

export function formatModeLabel(mode: GameMode): string {
  return GAME_MODES[mode]?.name ?? mode;
}

import type { GameState } from '../types/game';
import { DEFAULT_DOMESTIC_SPLIT } from './propaganda';
import { REGIONS } from '../data/regions';

const SAVE_KEY = 'lrw_save';
const SAVE_VERSION = 1;

function migrateGameState(state: GameState): GameState {
  if (!state.domesticSplit) {
    state.domesticSplit = { ...DEFAULT_DOMESTIC_SPLIT };
  }
  if (state.counterIntelLevel === undefined) {
    state.counterIntelLevel = 0.1;
  }
  if (!state.mechanicCooldowns) state.mechanicCooldowns = {};
  if (state.reserveFunds === undefined) state.reserveFunds = 0;
  if (state.declineMode === undefined) state.declineMode = false;
  if (state.playerWon === undefined) state.playerWon = false;

  // Merge any new regions from data (e.g. Saudi/Egypt) into saved games
  for (const [id, region] of Object.entries(REGIONS)) {
    if (!state.regions[id]) {
      state.regions[id] = structuredClone(region);
    }
  }

  return state;
}

export function saveGame(state: unknown): void {
  const payload = { version: SAVE_VERSION, timestamp: Date.now(), state };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
  } catch {
    console.warn('Failed to save game — storage may be full.');
  }
}

export function loadGame<T>(): T | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const payload = JSON.parse(raw);
    if (payload.version !== SAVE_VERSION) return null;
    return migrateGameState(payload.state as GameState) as T;
  } catch {
    return null;
  }
}

export function hasSavedGame(): boolean {
  return localStorage.getItem(SAVE_KEY) !== null;
}

export function deleteSave(): void {
  localStorage.removeItem(SAVE_KEY);
}

import type { GameState, GameMode } from '../types/game';
import { COUNTRIES } from '../data/countries';
import {
  getDefaultCorporateTaxRate,
  getDefaultIncomeTaxRate,
} from './taxation';
import { DEFAULT_DOMESTIC_SPLIT } from './propaganda';
import { defaultBudget } from './economy';
import { createDefaultNpcMechanicState } from './npcMechanics';
import { syncWarTheaters } from './warTheater';

const SAVE_KEY = 'lrw_save';
export const SAVE_VERSION = 21;

interface SavePayload {
  version: number;
  timestamp: number;
  state: GameState;
}

function migrateState(state: GameState, fromVersion: number): GameState {
  const migrated = structuredClone(state);

  if (fromVersion < 9) {
    migrated.corporateTaxRate ??= getDefaultCorporateTaxRate();
    migrated.incomeTaxRate ??= getDefaultIncomeTaxRate();
    migrated.taxPressureTurns ??= 0;
    migrated.facilityBuilds ??= [];
    migrated.diplomaticMissions ??= [];
  }

  if (fromVersion < 10) {
    migrated.conflictBaselines ??= {};
    migrated.militaryUpgrade ??= null;
  }

  if (fromVersion < 11) {
    migrated.strikeCampaigns ??= [];
    migrated.globalOilShock ??= null;
    migrated.actionEnergy ??= 3;
  }

  if (fromVersion < 12) {
    for (const campaign of migrated.strikeCampaigns ?? []) {
      const legacy = campaign as StrikeCampaign & { unprovoked?: boolean };
      if (legacy.startedUnprovoked === undefined) {
        legacy.startedUnprovoked = legacy.unprovoked ?? false;
        delete legacy.unprovoked;
      }
    }
  }

  if (fromVersion < 13) {
    migrated.collapseTelegraphedNations ??= [];
  }

  if (fromVersion < 14) {
    migrated.lastTurnReport ??= [];
    for (const country of Object.values(migrated.countries ?? {})) {
      country.stats.warReadiness ??= 1;
    }
  }

  if (fromVersion < 15) {
    migrated.telegraphedTaxCrisis ??= false;
    for (const [id, country] of Object.entries(migrated.countries ?? {})) {
      const defaultDebt = COUNTRIES[id]?.debtToGdp;
      if (defaultDebt !== undefined && (country.debtToGdp === undefined || country.debtToGdp === 0)) {
        country.debtToGdp = defaultDebt;
      }
    }
  }

  if (fromVersion < 16) {
    migrated.npcMechanicState ??= createDefaultNpcMechanicState();
  }

  if (fromVersion < 17) {
    migrated.warTheaters ??= [];
    migrated.vassalRegions ??= [];
    syncWarTheaters(migrated);
  }

  if (fromVersion < 18) {
    migrated.interventionMeters ??= {};
    migrated.pendingTheaterNotices ??= [];
    for (const t of migrated.warTheaters ?? []) {
      t.playerDoctrineAi ??= true;
      t.combatLog ??= [];
    }
  }

  if (fromVersion < 19) {
    migrated.collapsedNations ??= [];
  }

  if (fromVersion < 20) {
    migrated.theaterSettlements ??= [];
  }

  if (fromVersion < 21) {
    migrated.gameMode ??= 'sandbox';
  }

  return fillMissingSaveFields(migrated);
}

function fillMissingSaveFields(state: GameState): GameState {
  state.budget ??= defaultBudget();
  state.domesticSplit ??= { ...DEFAULT_DOMESTIC_SPLIT };
  state.counterIntelLevel ??= 0.1;
  state.activeEvents ??= [];
  state.pendingFollowUps ??= [];
  state.activeCovertOps ??= [];
  state.strikeAnimations ??= [];
  state.mechanicCooldowns ??= {};
  state.history ??= [];
  state.warsDeclaredThisTurn ??= 0;
  state.internationalPariahTurns ??= 0;
  state.talksAttemptedThisTurn ??= [];
  state.covertTalksAttemptedThisTurn ??= [];
  state.diplomaticMissions ??= [];
  state.facilityBuilds ??= [];
  state.corporateTaxRate ??= getDefaultCorporateTaxRate();
  state.incomeTaxRate ??= getDefaultIncomeTaxRate();
  state.taxPressureTurns ??= 0;
  state.conflictBaselines ??= {};
  state.militaryUpgrade ??= null;
  state.strikeCampaigns ??= [];
  state.globalOilShock ??= null;
  state.lastTurnReport ??= [];
  state.actionEnergy ??= 3;
  state.wars ??= [];
  state.fronts ??= [];
  state.alliances ??= [];
  state.bilateralAgreements ??= [];
  state.covertAlliances ??= [];
  state.relations ??= {};
  state.countries ??= {};
  state.regions ??= {};
  state.visibleLayers ??= ['military', 'alliances'];
  state.showDefenseRanges ??= false;
  state.declineMode ??= false;
  state.telegraphedCollapse ??= false;
  state.telegraphedTaxCrisis ??= false;
  state.collapseTelegraphedNations ??= [];
  state.gameOver ??= false;
  state.playerWon ??= false;
  state.npcMechanicState ??= createDefaultNpcMechanicState();
  state.warTheaters ??= [];
  state.vassalRegions ??= [];
  state.theaterSettlements ??= [];
  state.gameMode ??= 'sandbox';
  state.interventionMeters ??= {};
  state.pendingTheaterNotices ??= [];
  state.collapsedNations ??= [];
  for (const t of state.warTheaters) {
    t.playerDoctrineAi ??= true;
    t.combatLog ??= [];
  }

  for (const campaign of state.strikeCampaigns) {
    campaign.startedUnprovoked ??= false;
  }

  for (const [id, country] of Object.entries(state.countries)) {
    if (country.debtToGdp === undefined) {
      country.debtToGdp = COUNTRIES[id]?.debtToGdp ?? 0;
    }
    country.stats.warReadiness ??= 1;
  }

  state.lastTurnReport ??= [];

  return state;
}

export function saveGame(state: unknown): void {
  const payload: SavePayload = { version: SAVE_VERSION, timestamp: Date.now(), state: state as GameState };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
  } catch {
    console.warn('Failed to save game — storage may be full.');
  }
}

export function loadGame<T = GameState>(): T | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const payload = JSON.parse(raw) as SavePayload;
    if (!payload.state || typeof payload.version !== 'number') return null;
    if (payload.version > SAVE_VERSION) return null;

    const migrated = migrateState(payload.state, payload.version);
    return migrated as T;
  } catch {
    return null;
  }
}

export function hasSavedGame(): boolean {
  return localStorage.getItem(SAVE_KEY) !== null;
}

export interface SaveSummary {
  countryId: string;
  countryName: string;
  turn: number;
  timestamp: number;
  ended: boolean;
  gameMode: GameMode;
}

/** Lightweight read for the title screen — does not migrate full state. */
export function peekSaveSummary(): SaveSummary | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const payload = JSON.parse(raw) as SavePayload;
    if (!payload.state || typeof payload.version !== 'number') return null;
    if (payload.version > SAVE_VERSION) return null;

    const countryId = payload.state.playerCountryId;
    if (!countryId) return null;
    const countryName =
      payload.state.countries?.[countryId]?.name ?? COUNTRIES[countryId]?.name ?? countryId;

    return {
      countryId,
      countryName,
      turn: payload.state.turn ?? 0,
      timestamp: payload.timestamp,
      ended: !!(payload.state.gameOver || payload.state.playerWon),
      gameMode: payload.state.gameMode === 'campaign' ? 'campaign' : 'sandbox',
    };
  } catch {
    return null;
  }
}

export function deleteSave(): void {
  localStorage.removeItem(SAVE_KEY);
}

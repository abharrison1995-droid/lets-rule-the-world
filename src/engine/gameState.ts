import type { GameState, GameMode, LayerCategory } from '../types/game';
import { COUNTRIES, ALLIANCES_DATA } from '../data/countries';
import { REGIONS } from '../data/regions';
import { buildRelationsMatrix } from '../data/relations';
import { defaultBudget } from './economy';
import { tickEconomy, applyBudgetEffects } from './economy';
import { tickDiplomacy, declareWar, tickInternationalPariah } from './diplomacy';
import { detectFronts, resolveCombat, decayUnrest, cleanStrikeAnimations } from './combat';
import { rollEvents, checkCollapseConditions } from './events';
import { checkWinConditions } from './winConditions';
import { resolveCovertOps, runNpcCovertOps } from './covert';
import { tickCovertAllianceExposure } from './covertAlliances';
import { applyTurnIncome, checkTaxPoliticalPressure, getDefaultCorporateTaxRate, getDefaultIncomeTaxRate } from './taxation';
import { tickFiscalDebt } from './fiscal';
import { resolveStrikeCampaigns } from './strikeCampaigns';
import { runNpcGreyZoneStrikes, runNpcWartimeStrikes } from './npcStrikes';
import { tickNpcWorldActivity } from './npcNation';
import { createDefaultNpcMechanicState, tickNpcMechanics } from './npcMechanics';
import { syncWarTheaters, tickVassalRegions, tickWarTheaters } from './warTheater';
import { tickWarReadiness, forceHaltCampaignsFromWeariness } from './warReadiness';
import { buildTurnReport } from './turnReport';
import { resetActionEnergy } from './actionEnergy';
import { resolveDiplomaticMissions } from './diplomaticMissions';
import { resolveMilitaryUpgrades, scaleStartingMilitaryDev } from './militaryDevUpgrades';
import { resolveFacilityBuilds } from './facilities';
import {
  tickCounterIntel,
  applyDomesticPropagandaTick,
  DEFAULT_DOMESTIC_SPLIT,
} from './propaganda';
import { formatModeLabel } from '../data/gameModes';
import { isUsaCampaignMode } from '../data/campaignUsa';
import { createUsaCampaignState, tickUsaCampaign } from './usaCampaign';
import { startUsaIntroCutscene, maybeStartPostCubaCutscene } from './cutscenes';

export function createInitialState(
  playerCountryId: string,
  gameMode: GameMode = 'sandbox'
): GameState {
  const countries = structuredClone(COUNTRIES);
  for (const c of Object.values(countries)) {
    c.militaryDev = scaleStartingMilitaryDev(c.militaryDev);
    c.stats.warReadiness = c.stats.warReadiness ?? 1;
  }
  const regions = structuredClone(REGIONS);
  const relations = buildRelationsMatrix();
  const alliances = ALLIANCES_DATA.map(a => ({ ...a, members: [...a.members] }));

  const modeLabel = formatModeLabel(gameMode);
  const state: GameState = {
    turn: 1,
    playerCountryId,
    gameMode,
    usaCampaign: isUsaCampaignMode(gameMode) ? createUsaCampaignState(1) : null,
    activeCutscene: null,
    completedCutscenes: [],
    countries,
    regions,
    relations,
    alliances,
    bilateralAgreements: [],
    covertAlliances: [],
    wars: [],
    fronts: [],
    budget: defaultBudget(),
    domesticSplit: { ...DEFAULT_DOMESTIC_SPLIT },
    counterIntelLevel: 0.1,
    activeEvents: [],
    pendingFollowUps: [],
    activeCovertOps: [],
    strikeAnimations: [],
    mechanicCooldowns: {},
    gameOver: false,
    playerWon: false,
    declineMode: false,
    telegraphedCollapse: false,
    telegraphedTaxCrisis: false,
    collapseTelegraphedNations: [],
    selectedMapTier: 1,
    selectedCountryId: null,
    selectedRegionId: null,
    visibleLayers: ['military', 'alliances'],
    showDefenseRanges: false,
    history: [
      `Turn 0: ${countries[playerCountryId]?.name} assumes leadership (${modeLabel}).`,
    ],
    warsDeclaredThisTurn: 0,
    internationalPariahTurns: 0,
    talksAttemptedThisTurn: [],
    covertTalksAttemptedThisTurn: [],
    diplomaticMissions: [],
    facilityBuilds: [],
    corporateTaxRate: getDefaultCorporateTaxRate(),
    incomeTaxRate: getDefaultIncomeTaxRate(),
    taxPressureTurns: 0,
    conflictBaselines: {},
    militaryUpgrade: null,
    strikeCampaigns: [],
    globalOilShock: null,
    lastTurnReport: [],
    actionEnergy: 0,
    npcMechanicState: createDefaultNpcMechanicState(),
    warTheaters: [],
    vassalRegions: [],
    theaterSettlements: [],
    interventionMeters: {},
    pendingTheaterNotices: [],
    collapsedNations: [],
  };

  resetActionEnergy(state);

  // Seed opening scenario: Russia-Ukraine war
  seedOpeningScenario(state);
  syncWarTheaters(state);
  startUsaIntroCutscene(state);

  return state;
}

function seedOpeningScenario(state: GameState): void {
  if (!state.countries.russia || !state.countries.ukraine) return;

  declareWar(state, 'russia', 'ukraine');
  state.fronts = detectFronts(state);
  state.history.push('Turn 0: Russia-Ukraine war is ongoing.');
}

export function advanceTurn(state: GameState): GameState {
  if (state.gameOver || state.playerWon) return state;

  const historyFrom = state.history.length;
  const newState = structuredClone(state);
  newState.turn += 1;
  newState.warsDeclaredThisTurn = 0;
  newState.talksAttemptedThisTurn = [];
  newState.covertTalksAttemptedThisTurn = [];

  resolveDiplomaticMissions(newState);
  resolveFacilityBuilds(newState);
  resolveMilitaryUpgrades(newState);
  runNpcGreyZoneStrikes(newState);
  runNpcWartimeStrikes(newState);
  resolveStrikeCampaigns(newState);
  tickWarTheaters(newState);
  tickWarReadiness(newState);
  forceHaltCampaignsFromWeariness(newState);
  resetActionEnergy(newState);

  // Update fronts before economy (war exhaustion needs current front count)
  newState.fronts = detectFronts(newState);

  // Turn loop per spec
  tickEconomy(newState);
  tickDiplomacy(newState);
  tickNpcMechanics(newState);
  tickNpcWorldActivity(newState);
  tickInternationalPariah(newState);
  rollEvents(newState);
  applyBudgetEffects(newState);
  tickCounterIntel(newState);
  applyDomesticPropagandaTick(newState);
  applyTurnIncome(newState);
  tickFiscalDebt(newState);
  checkTaxPoliticalPressure(newState);
  runNpcCovertOps(newState);
  resolveCovertOps(newState);
  tickCovertAllianceExposure(newState);
  resolveCombat(newState);
  decayUnrest(newState);
  tickVassalRegions(newState);
  cleanStrikeAnimations(newState);
  checkCollapseConditions(newState);
  tickUsaCampaign(newState);
  maybeStartPostCubaCutscene(newState);
  checkWinConditions(newState);

  newState.lastTurnReport = buildTurnReport(state, newState, historyFrom);
  newState.history.push(`Turn ${newState.turn} complete.`);

  return newState;
}

export const LAYER_LABELS: Record<LayerCategory, string> = {
  military: 'Military',
  airDefense: 'Air/Missile Defense',
  drones: 'Drone Activity',
  alliances: 'Alliances',
  events: 'Events',
  economic: 'Economic',
};

import { formatDisplayGDP } from './treasuryDisplay';

/** @deprecated Use formatDisplayGDP(treasuryPoints) — kept for gradual migration */
export function formatGDP(tpOrLegacy: number): string {
  return formatDisplayGDP(tpOrLegacy);
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function getPlayerWars(state: GameState) {
  return state.wars.filter(w => w.belligerents.includes(state.playerCountryId));
}

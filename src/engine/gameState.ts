import type { GameState, LayerCategory } from '../types/game';
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
import { accumulateReserve } from './actions';
import { getStartingReserve } from './fiscal';
import { resetActionEnergy } from './actionEnergy';
import { resolveDiplomaticMissions } from './diplomaticMissions';
import {
  tickCounterIntel,
  applyDomesticPropagandaTick,
  DEFAULT_DOMESTIC_SPLIT,
} from './propaganda';

export function createInitialState(playerCountryId: string): GameState {
  const countries = structuredClone(COUNTRIES);
  const regions = structuredClone(REGIONS);
  const relations = buildRelationsMatrix();
  const alliances = ALLIANCES_DATA.map(a => ({ ...a, members: [...a.members] }));

  const state: GameState = {
    turn: 1,
    playerCountryId,
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
    reserveFunds: 0,
    gameOver: false,
    playerWon: false,
    declineMode: false,
    telegraphedCollapse: false,
    selectedMapTier: 1,
    selectedCountryId: null,
    selectedRegionId: null,
    visibleLayers: ['military', 'alliances'],
    showDefenseRanges: false,
    history: [`Turn 0: ${countries[playerCountryId]?.name} assumes leadership.`],
    warsDeclaredThisTurn: 0,
    internationalPariahTurns: 0,
    talksAttemptedThisTurn: [],
    covertTalksAttemptedThisTurn: [],
    diplomaticMissions: [],
    actionEnergy: 0,
  };

  resetActionEnergy(state);
  state.reserveFunds = getStartingReserve(countries[playerCountryId]);

  // Seed opening scenario: Russia-Ukraine war
  seedOpeningScenario(state);

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

  const newState = structuredClone(state);
  newState.turn += 1;
  newState.warsDeclaredThisTurn = 0;
  newState.talksAttemptedThisTurn = [];
  newState.covertTalksAttemptedThisTurn = [];

  resolveDiplomaticMissions(newState);
  resetActionEnergy(newState);

  // Update fronts before economy (war exhaustion needs current front count)
  newState.fronts = detectFronts(newState);

  // Turn loop per spec
  tickEconomy(newState);
  tickDiplomacy(newState);
  tickInternationalPariah(newState);
  rollEvents(newState);
  applyBudgetEffects(newState);
  tickCounterIntel(newState);
  applyDomesticPropagandaTick(newState);
  accumulateReserve(newState);
  runNpcCovertOps(newState);
  resolveCovertOps(newState);
  tickCovertAllianceExposure(newState);
  resolveCombat(newState);
  decayUnrest(newState);
  cleanStrikeAnimations(newState);
  checkCollapseConditions(newState);
  checkWinConditions(newState);

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

export function formatGDP(billions: number): string {
  if (billions >= 1000) return `$${(billions / 1000).toFixed(1)}T`;
  return `$${billions.toFixed(0)}B`;
}

export function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export function getPlayerWars(state: GameState) {
  return state.wars.filter(w => w.belligerents.includes(state.playerCountryId));
}

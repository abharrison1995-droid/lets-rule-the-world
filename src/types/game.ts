// Core type definitions for Let's Rule The World

export type Terrain = 'urban' | 'mountain' | 'coastal' | 'desert' | 'plains';

export type AllianceTier =
  | 'informal'
  | 'defensive_pact'
  | 'full_alliance'
  | 'bloc';

export type EventScope = 'global' | 'regional' | 'national';

export type BudgetCategory =
  | 'military'
  | 'diplomacy'
  | 'domestic'
  | 'covert'
  | 'reserve';

export type LayerCategory =
  | 'military'
  | 'airDefense'
  | 'drones'
  | 'alliances'
  | 'events'
  | 'economic';

export type CollapseType =
  | 'hard'
  | 'soft'
  | 'none';

export interface DefenseSystem {
  id: string;
  type: 'patriot' | 'iron_dome' | 's300' | 'thaad' | 'ciws' | 'generic';
  rating: number;
}

export interface Garrison {
  troops: number;
  defenseSystems: DefenseSystem[];
}

export interface Region {
  id: string;
  countryId: string;
  name: string;
  neighbours: string[];
  terrain: Terrain;
  population: number;
  industryValue: number;
  garrison: Garrison;
  controlledBy: string;
  unrest: number;
  fortificationLevel: number;
  /** SVG path for national map rendering */
  mapPath: string;
  /** Center point for icon placement [x, y] */
  center: [number, number];
}

export interface Alliance {
  id: string;
  members: string[];
  tier: AllianceTier;
  name: string;
}

export interface DifficultyRating {
  score: number; // 1-10
  blurb: string;
}

export interface CollapseCondition {
  type: CollapseType;
  triggerStats: Record<string, number>;
  telegraphEventId: string;
}

export interface CountryStats {
  gdp: number;
  gdpGrowth: number;
  defenseBudget: number;
  troopQuality: number;
  techLevel: number;
  moraleBase: number;
  regimeSecurity: number;
  warPopularity: number;
  warExhaustion: number;
  propagandaSaturation: number;
}

export interface MilitaryDev {
  troopQuality: number; // 1-5
  missileDefense: number;
  droneProgram: number;
  strikeCapability: number;
  fortification: number;
}

export interface Country {
  id: string;
  name: string;
  playable: boolean;
  stats: CountryStats;
  militaryDev: MilitaryDev;
  startingAlliances: string[];
  startingRelations: Record<string, number>;
  difficultyRating: DifficultyRating;
  uniqueMechanics: string[];
  collapseCondition: CollapseCondition;
  /** World map SVG path */
  worldMapPath: string;
  /** World map label position */
  worldMapLabel: [number, number];
  color: string;
}

export interface DomesticSplit {
  propaganda: number;
  counterIntel: number;
  services: number;
}

export type WinConditionType =
  | 'conquest'
  | 'survival'
  | 'hegemony'
  | 'economic'
  | 'defensive';

export interface WinConditionDef {
  type: WinConditionType;
  description: string;
  regionControlPct?: number;
  surviveTurns?: number;
  minTurns?: number;
  minGdp?: number;
  minAlliesHighRelation?: number;
  minRelations?: Record<string, number>;
  minRegimeSecurity?: number;
  annexCountryIds?: string[];
}

export type PeaceTermsType = 'white_peace' | 'ceasefire' | 'reparations';

export interface BudgetAllocation {
  military: number;
  diplomacy: number;
  domestic: number;
  covert: number;
  reserve: number;
}

export interface Front {
  id: string;
  attackerRegionId: string;
  defenderRegionId: string;
  attackerCountryId: string;
  defenderCountryId: string;
  pressure: number; // -100 to 100, positive = attacker advancing
}

export interface War {
  id: string;
  belligerents: string[];
  startTurn: number;
  isDefensive: Record<string, boolean>;
}

export interface CovertOp {
  id: string;
  sourceNation: string;
  targetNation: string;
  cost: number;
  discoveryRiskPercent: number;
  effectIfHidden: Record<string, number>;
  effectIfDiscovered: Record<string, number>;
  mechanicId?: string;
  turnStarted: number;
  discovered: boolean;
}

export interface EventChoice {
  label: string;
  effects: Array<{ stat: string; target: string; delta: number }>;
  followUpEventId?: string;
}

export interface GameEvent {
  id: string;
  title: string;
  description: string;
  scope: EventScope;
  triggerConditions: {
    minTurn?: number;
    maxTurn?: number;
    requiredState?: Array<{ key: string; op: string; value: number | string | boolean }>;
    excludedIfActive?: string[];
    targetCountry?: string;
  };
  weight: number;
  weightModifiers?: Array<{ condition: string; multiplier: number }>;
  choices: EventChoice[];
  flavourOnly: boolean;
  telegraph?: boolean;
}

export interface ActiveEvent {
  eventId: string;
  turn: number;
  targetCountryId?: string;
  resolved: boolean;
}

export interface PendingFollowUp {
  eventId: string;
  triggerTurn: number;
  targetCountryId?: string;
}

export interface RelationPair {
  a: string;
  b: string;
  value: number;
}

export interface StrikeAnimation {
  id: string;
  sourceRegionId: string;
  targetRegionId: string;
  intercepted: boolean;
  turn: number;
}

export interface GameState {
  turn: number;
  playerCountryId: string;
  countries: Record<string, Country>;
  regions: Record<string, Region>;
  relations: Record<string, number>; // key: "a|b" sorted
  alliances: Alliance[];
  wars: War[];
  fronts: Front[];
  budget: BudgetAllocation;
  domesticSplit: DomesticSplit;
  counterIntelLevel: number;
  activeEvents: ActiveEvent[];
  pendingFollowUps: PendingFollowUp[];
  activeCovertOps: CovertOp[];
  strikeAnimations: StrikeAnimation[];
  mechanicCooldowns: Record<string, number>;
  reserveFunds: number;
  gameOver: boolean;
  gameOverReason?: string;
  playerWon: boolean;
  winReason?: string;
  declineMode: boolean;
  telegraphedCollapse: boolean;
  selectedMapTier: 1 | 2;
  selectedCountryId: string | null;
  selectedRegionId: string | null;
  visibleLayers: LayerCategory[];
  showDefenseRanges: boolean;
  history: string[];
  /** Contextual nation for event effects (sender, ally, etc.) */
  eventContextNationId?: string;
}

export interface NationMechanic {
  id: string;
  countryId: string;
  name: string;
  description: string;
  cost: number;
  cooldown: number;
  category: 'covert' | 'diplomacy' | 'military';
  effects: Record<string, number>;
  discoveryRiskBonus?: number;
}

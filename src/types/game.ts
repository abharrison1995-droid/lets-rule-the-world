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

export type GovernmentType = 'democratic' | 'autocratic' | 'hybrid';

export type FacilityType =
  | 'drone_factory'
  | 'missile_defense'
  | 'oil_gas'
  | 'arms_plant';

export interface RegionFacility {
  id: string;
  type: FacilityType;
  builtTurn: number;
}

export interface FacilityBuildOrder {
  id: string;
  regionId: string;
  countryId: string;
  type: FacilityType;
  startTurn: number;
  completeTurn: number;
  costPaid: number;
}

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
  facilities: RegionFacility[];
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

export type AgreementType = 'trade' | 'intel';

export interface BilateralAgreement {
  id: string;
  type: AgreementType;
  a: string;
  b: string;
  formedTurn: number;
}

export type CovertAgreementType = 'trade' | 'military' | 'intel';

export interface CovertAlliance {
  id: string;
  type: CovertAgreementType;
  a: string;
  b: string;
  formedTurn: number;
  exposed: boolean;
  /** % chance per turn of leaking to the world */
  exposureRisk: number;
}

export type CovertTalkOptionId = 'covert_trade' | 'covert_military' | 'covert_intel';

export interface ActionFiscalPreview {
  effectiveCost: number;
  treasuryNow: number;
  treasuryAfter: number;
  debtDeltaNow: number;
  debtDeltaAfter: number;
}

export interface CovertNegotiationPreview {
  optionId: CovertTalkOptionId;
  label: string;
  description: string;
  canAttempt: boolean;
  blockReason?: string;
  cost: number;
  energyCost: number;
  durationTurns: number;
  acceptanceChance: number;
  exposureRisk: number;
  effects: string[];
  fiscal: ActionFiscalPreview | null;
}

export type DiplomaticMissionType =
  | 'peace'
  | 'military_pact'
  | 'trade_deal'
  | 'intel_sharing'
  | 'ultimatum'
  | 'summit'
  | 'covert_trade'
  | 'covert_military'
  | 'covert_intel'
  | 'invoke_us_support';

export interface DiplomaticMission {
  id: string;
  type: DiplomaticMissionType;
  targetNationId: string;
  dispatchedTurn: number;
  resolveTurn: number;
  energyCost: number;
  goldCost: number;
  peaceTerms?: PeaceTermsType;
}

export type TalkOptionId = 'peace' | 'military_pact' | 'trade_deal' | 'intel_sharing' | 'ultimatum';

export type PressActionId =
  | 'condemn_aggression'
  | 'announce_summit'
  | 'social_media_flood'
  | 'info_ops_leak';

export interface PressActionPreview {
  actionId: PressActionId;
  label: string;
  description: string;
  canAttempt: boolean;
  blockReason?: string;
  cost: number;
  energyCost: number;
  durationTurns: number;
  isInstant: boolean;
  effects: string[];
  fiscal: ActionFiscalPreview | null;
}

export interface NegotiationPreview {
  optionId: TalkOptionId;
  label: string;
  description: string;
  canAttempt: boolean;
  blockReason?: string;
  cost: number;
  energyCost: number;
  durationTurns: number;
  acceptanceChance: number;
  effects: string[];
  fiscal: ActionFiscalPreview | null;
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
  /** Engine-facing spendable economic power (TP). Not shown directly to player. */
  treasuryPoints: number;
  /** Per-turn growth rate applied to treasuryPoints */
  baseGrowthRate: number;
  defenseBudget: number;
  troopQuality: number;
  techLevel: number;
  moraleBase: number;
  regimeSecurity: number;
  warPopularity: number;
  warExhaustion: number;
  /** Capacity to sustain military operations (0–1). Drops with weariness; recover via support. */
  warReadiness?: number;
  propagandaSaturation: number;
}

export type StrikeType = 'artillery' | 'drone' | 'cruise' | 'ballistic' | 'icbm';

export interface StrikeCampaign {
  id: string;
  attackerCountryId: string;
  sourceRegionId: string;
  targetRegionId: string;
  strikeType: StrikeType;
  startTurn: number;
  /** Campaign opened before war was declared — sustains diplomatic fallout each turn */
  startedUnprovoked: boolean;
}

export interface VassalRegion {
  regionId: string;
  overlordId: string;
  subjectNationId: string;
  formedTurn: number;
}

export type HexTerrain = 'urban' | 'plains' | 'forest' | 'river' | 'fort';

export type TheaterUnitTag = 'infantry' | 'armor' | 'artillery' | 'air' | 'drone';

export type TheaterDoctrine = 'attack' | 'hold' | 'withdraw';

export type TheaterResolveMode = 'play_out' | 'quick_resolve';

export interface TheaterStack {
  countryId: string;
  /** Combat power points */
  strength: number;
  tags: TheaterUnitTag[];
  /** Visible facility / specialist markers when intel allows */
  specialists: string[];
}

export interface TheaterHexRuntime {
  ownerId: string;
  stack: TheaterStack | null;
  contested: boolean;
  fortLevel: number;
  /** Revealed this turn by strike / adjacency for fog */
  revealedUntilTurn: number;
}

export interface PendingRegionFate {
  theaterId: string;
  regionId: string;
  conquerorId: string;
  subjectNationId: string;
}

export interface WarTheaterState {
  id: string;
  warId: string;
  defId: string;
  name: string;
  /** Runtime hex ownership / stacks keyed by hex def id */
  hexes: Record<string, TheaterHexRuntime>;
  doctrineByCountry: Record<string, TheaterDoctrine>;
  resolveMode: TheaterResolveMode;
  impulsesThisWorldTurn: number;
  pendingFate: PendingRegionFate | null;
  closed: boolean;
  /** When true, doctrine AI runs the player's side each impulse; micro remains optional */
  playerDoctrineAi: boolean;
  /** Recent combat lines for the theater UI */
  combatLog: string[];
}

export interface GlobalOilShock {
  turnsRemaining: number;
  severity: number;
  reason: string;
}

export type TurnReportCategory =
  | 'war'
  | 'strike'
  | 'diplomacy'
  | 'alliance'
  | 'economy'
  | 'combat'
  | 'readiness'
  | 'other';

export interface TurnReportEntry {
  category: TurnReportCategory;
  message: string;
}

export interface MilitaryUpgradeOrder {
  id: string;
  category: keyof MilitaryDev;
  startTurn: number;
  completeTurn: number;
  costPaid: number;
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
  /** Sovereign debt as ratio of GDP (e.g. 1.22 = 122%) */
  debtToGdp: number;
  governmentType: GovernmentType;
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
  minTreasury?: number;
  minAlliesHighRelation?: number;
  alliesRelationThreshold?: number;
  requireAllianceId?: string;
  controlHomeRegions?: boolean;
  minRelations?: Record<string, number>;
  minRegimeSecurity?: number;
  annexCountryIds?: string[];
  /** Formal bilateral deals (trade/intel) the player must hold */
  minBilateralAgreements?: number;
  /** Must not be under international condemnation */
  requireNoPariah?: boolean;
  /** Must not be in decline mode */
  requireNotInDecline?: boolean;
  /** Ukraine must still control this fraction of its home regions (0–1) */
  ukraineSovereigntyPct?: number;
  /** Player treasury must rank this high worldwide (1 = richest) */
  maxTreasuryRank?: number;
  /** Absolute earliest turn any path may fire (safety floor) */
  absoluteMinTurns?: number;
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
  initiatorId: string;
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
  /** Spy op probing for secret pacts */
  opKind?: 'standard' | 'probe_pacts';
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
    /** If true, only fires via explicit trigger — never from turn roll */
    manualOnly?: boolean;
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
  /** Resolved description with nation/region names filled in */
  displayDescription?: string;
  contextNationId?: string;
  contextRegionId?: string;
  contextAmount?: number;
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

export interface WarDeclarationPreview {
  targetId: string;
  targetName: string;
  canDeclare: boolean;
  blockReason?: string;
  warsDeclaredThisTurn: number;
  warCap: number;
  warsRemaining: number;
  blocExpulsions: Array<{ allianceId: string; allianceName: string }>;
  blocMembersJoiningWar: Array<{ countryId: string; name: string; blocName: string }>;
  alliesLikelyToJoinEnemy: Array<{ countryId: string; name: string; allianceName: string }>;
  relationHits: Array<{ countryId: string; name: string; estimatedDelta: number }>;
  triggersGlobalCondemnation: boolean;
  condemnationReason?: string;
}

export interface GameState {
  turn: number;
  playerCountryId: string;
  countries: Record<string, Country>;
  regions: Record<string, Region>;
  relations: Record<string, number>; // key: "a|b" sorted
  alliances: Alliance[];
  /** Overt bilateral deals formed via talks (trade, intel) */
  bilateralAgreements: BilateralAgreement[];
  /** Secret pacts — visible to player only until exposed */
  covertAlliances: CovertAlliance[];
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
  gameOver: boolean;
  gameOverReason?: string;
  playerWon: boolean;
  winReason?: string;
  declineMode: boolean;
  telegraphedCollapse: boolean;
  /** Tax-pressure crisis warning shown (separate from nation collapse telegraphs) */
  telegraphedTaxCrisis: boolean;
  /** Nations that have received a collapse telegraph warning */
  collapseTelegraphedNations: string[];
  selectedMapTier: 1 | 2;
  selectedCountryId: string | null;
  selectedRegionId: string | null;
  visibleLayers: LayerCategory[];
  showDefenseRanges: boolean;
  history: string[];
  /** Wars the player declared this turn (resets each turn) */
  warsDeclaredThisTurn: number;
  /** Turns remaining of global condemnation debuff */
  internationalPariahTurns: number;
  /** Target nation IDs the player has held talks with this turn */
  talksAttemptedThisTurn: string[];
  /** Target nation IDs the player has used covert backchannel with this turn */
  covertTalksAttemptedThisTurn: string[];
  /** Remaining consequential-action energy this turn */
  actionEnergy: number;
  /** Envoys / summits in progress */
  diplomaticMissions: DiplomaticMission[];
  /** Regional construction projects in progress */
  facilityBuilds: FacilityBuildOrder[];
  corporateTaxRate: number;
  incomeTaxRate: number;
  /** Turns of elevated unrest from tax pressure */
  taxPressureTurns: number;
  /** Bilateral relation snapshot before first strike / war in a dispute */
  conflictBaselines: Record<string, number>;
  /** Single in-progress military development project */
  militaryUpgrade: MilitaryUpgradeOrder | null;
  /** Active sustained strike campaigns */
  strikeCampaigns: StrikeCampaign[];
  /** Global oil supply disruption */
  globalOilShock: GlobalOilShock | null;
  /** Report generated at end of previous turn */
  lastTurnReport: TurnReportEntry[];
  /** Event context nation for event effects (sender, ally, etc.) */
  eventContextNationId?: string;
  /** Passive automated mechanics for non-playable nations */
  npcMechanicState: Record<string, NpcMechanicRuntime>;
  /** Active operational war theaters (hex boards) */
  warTheaters: WarTheaterState[];
  /** Regions held as vassals rather than fully absorbed */
  vassalRegions: VassalRegion[];
  /** Intervention pressure by warId (0–100); expeditionary builds this toward auto-war */
  interventionMeters: Record<string, number>;
  /** Theater IDs awaiting “war theater opened” modal acknowledgment */
  pendingTheaterNotices: string[];
  /** Nations that collapsed while the player continues */
  collapsedNations: string[];
}

/** Per-NPC runtime state for automated world-power mechanics */
export interface NpcMechanicRuntime {
  mechanicId: string;
  /** 0–100 intensity / progress meter */
  intensity: number;
  /** Primary effects are currently firing */
  active: boolean;
  /** Turns since activation (0 while dormant) */
  turnsActive: number;
}

export interface NationMechanic {
  id: string;
  countryId: string;
  name: string;
  description: string;
  cost: number;
  cooldown: number;
  category: 'covert' | 'diplomacy' | 'military' | 'strategic';
  effects: Record<string, number>;
  discoveryRiskBonus?: number;
  requiresTarget?: boolean;
  missionTurns?: number;
}

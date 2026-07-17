/**
 * War theater system, split by concern:
 *  - warTheaterCore.ts      shared theater-state queries and stack helpers
 *  - warTheaterCombat.ts    hex battle math, resolution, doctrine-AI impulse
 *  - warTheaterLifecycle.ts turn-tick, region fate, peace settlement
 *  - warTheaterActions.ts   player-triggered actions (move, reinforce, aid, doctrine)
 * Re-exported here so existing imports across the app are unaffected.
 */

export {
  syncWarTheaters,
  pruneForeignTheaterNotices,
  getActiveTheaters,
  getTheater,
  isRegionInActiveTheater,
  canSeeHex,
  getTheaterForWar,
  dismissTheaterNotice,
  acknowledgeAllTheaterNotices,
} from './warTheaterCore';

export {
  previewHexBattle,
  applyStrikeToTheaterHexes,
  type HexBattlePreview,
} from './warTheaterCombat';

export {
  resolveRegionFate,
  tickVassalRegions,
  getRegionHexControl,
  getTheaterControlShare,
  applyTheaterPeaceSettlement,
  tickWarTheaters,
} from './warTheaterLifecycle';

export {
  playerTheaterMove,
  playerReinforceTheater,
  setTheaterDoctrine,
  setTheaterResolveMode,
  playerDeployExpeditionary,
  getInterventionMeter,
  playerSendTheaterAid,
  setPlayerDoctrineAi,
  type TheaterAidPackage,
} from './warTheaterActions';

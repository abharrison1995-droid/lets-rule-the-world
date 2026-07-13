import type { WinConditionDef } from '../types/game';

/**
 * Long-campaign victory goals. Nothing should be reachable before ~turn 100,
 * and no path should be already met from starting relations/treasury alone.
 */
export const WIN_CONDITIONS: Record<string, WinConditionDef> = {
  usa: {
    type: 'hegemony',
    description:
      'Pax Americana (100+ turns): build a deep alliance web (6 partners ≥80, 5 bilateral deals, NATO intact, Ukraine sovereign) — or impose continental hegemony (40% world territory after turn 120).',
    absoluteMinTurns: 100,
    minAlliesHighRelation: 6,
    alliesRelationThreshold: 80,
    minBilateralAgreements: 5,
    requireAllianceId: 'nato',
    ukraineSovereigntyPct: 0.5,
    requireNoPariah: true,
    requireNotInDecline: true,
    regionControlPct: 0.4,
    minTurns: 120,
    controlHomeRegions: true,
  },
  england: {
    type: 'hegemony',
    description:
      'Atlantic leadership: endure 100 turns in NATO with 3 partners ≥70, 4 bilateral deals, and no pariah status.',
    absoluteMinTurns: 100,
    minTurns: 100,
    requireAllianceId: 'nato',
    minAlliesHighRelation: 3,
    alliesRelationThreshold: 70,
    minBilateralAgreements: 4,
    requireNoPariah: true,
    requireNotInDecline: true,
    controlHomeRegions: true,
  },
  russia: {
    type: 'conquest',
    description:
      'Imperial restoration (100+ turns): fully annex Ukraine after turn 100 with regime security intact — or seize 35% of world territory after turn 120.',
    absoluteMinTurns: 100,
    annexCountryIds: ['ukraine'],
    minRegimeSecurity: 0.5,
    requireNotInDecline: true,
    regionControlPct: 0.35,
    minTurns: 120,
    controlHomeRegions: true,
  },
  china: {
    type: 'economic',
    description:
      'Century of revival: after 100 turns reach $300B treasury, rank #1 economically, hold all home regions, and keep regime security above 60%.',
    absoluteMinTurns: 100,
    minTurns: 100,
    minTreasury: 300,
    maxTreasuryRank: 1,
    minRegimeSecurity: 0.6,
    controlHomeRegions: true,
    requireNotInDecline: true,
    minBilateralAgreements: 3,
  },
  turkey: {
    type: 'defensive',
    description:
      'Neo-Ottoman reach: after 100 turns control 20% of world regions with regime security above 55%, 3 bilateral deals, and home regions intact.',
    absoluteMinTurns: 100,
    minTurns: 100,
    regionControlPct: 0.2,
    minRegimeSecurity: 0.55,
    minBilateralAgreements: 3,
    controlHomeRegions: true,
    requireNotInDecline: true,
  },
  israel: {
    type: 'survival',
    description:
      'Iron endurance: survive 100 turns with USA relations ≥60, home territory intact, treasury ≥$60B, and no decline.',
    absoluteMinTurns: 100,
    surviveTurns: 100,
    minRelations: { usa: 60 },
    controlHomeRegions: true,
    minTreasury: 60,
    requireNotInDecline: true,
    requireNoPariah: true,
  },
  india: {
    type: 'economic',
    description:
      'Rising great power: after 100 turns reach $160B treasury, hold all home regions, and cultivate 3 bilateral deals.',
    absoluteMinTurns: 100,
    minTurns: 100,
    minTreasury: 160,
    controlHomeRegions: true,
    minBilateralAgreements: 3,
    requireNotInDecline: true,
  },
  pakistan: {
    type: 'survival',
    description:
      'Surviving the storm: endure 100 turns with treasury ≥$55B, regime security ≥45%, and all home regions held.',
    absoluteMinTurns: 100,
    surviveTurns: 100,
    minTreasury: 55,
    minRegimeSecurity: 0.45,
    controlHomeRegions: true,
    requireNotInDecline: true,
  },
  iran: {
    type: 'survival',
    description:
      'Resistance economy: endure 100 turns with treasury ≥$55B, regime security ≥45%, and home regions intact.',
    absoluteMinTurns: 100,
    surviveTurns: 100,
    minTreasury: 55,
    minRegimeSecurity: 0.45,
    controlHomeRegions: true,
    requireNotInDecline: true,
  },
  north_korea: {
    type: 'survival',
    description:
      'Juche endurance: survive 110 turns with regime security ≥55%, treasury ≥$35B, and home regions intact.',
    absoluteMinTurns: 110,
    surviveTurns: 110,
    minRegimeSecurity: 0.55,
    minTreasury: 35,
    controlHomeRegions: true,
    requireNotInDecline: true,
  },
  south_korea: {
    type: 'defensive',
    description:
      'Peninsula steadfast: survive 100 turns with USA relations ≥70, no NK occupation of SK land, and home regions intact.',
    absoluteMinTurns: 100,
    surviveTurns: 100,
    minTurns: 100,
    minRelations: { usa: 70 },
    controlHomeRegions: true,
    requireNotInDecline: true,
  },
};

export function getWinCondition(countryId: string): WinConditionDef | undefined {
  return WIN_CONDITIONS[countryId];
}

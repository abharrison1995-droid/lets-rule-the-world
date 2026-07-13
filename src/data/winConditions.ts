import type { WinConditionDef } from '../types/game';

export const WIN_CONDITIONS: Record<string, WinConditionDef> = {
  usa: {
    type: 'hegemony',
    description: 'Maintain hegemony: 3+ nations with relations >50, or control 35% of regions for 30+ turns.',
    minAlliesHighRelation: 3,
    regionControlPct: 0.35,
    minTurns: 30,
  },
  england: {
    type: 'hegemony',
    description: 'Lead NATO: stay in NATO bloc with 2+ allies above 60 relations for 35 turns.',
    minAlliesHighRelation: 2,
    minTurns: 35,
  },
  russia: {
    type: 'conquest',
    description: 'Annex all Ukrainian regions OR control 30% of world territory.',
    annexCountryIds: ['ukraine'],
    regionControlPct: 0.30,
    minTurns: 20,
  },
  china: {
    type: 'economic',
    description: 'Economic dominance: treasury reaches 1,400 TP while maintaining regime security above 0.5.',
    minTreasury: 1400,
    minRegimeSecurity: 0.5,
    minTurns: 40,
  },
  turkey: {
    type: 'defensive',
    description: 'Regional power: control 15% of regions with regime security above 0.55 for 30 turns.',
    regionControlPct: 0.15,
    minRegimeSecurity: 0.55,
    minTurns: 30,
  },
  israel: {
    type: 'survival',
    description: 'Survive 40 turns with USA relations above 50 and no territorial loss.',
    surviveTurns: 40,
    minRelations: { usa: 50 },
  },
  india: {
    type: 'economic',
    description: 'Rising power: treasury reaches 700 TP and control all home regions for 35 turns.',
    minTreasury: 700,
    minTurns: 35,
  },
  pakistan: {
    type: 'survival',
    description: 'Survive 45 turns without economic collapse (treasury above 180 TP).',
    surviveTurns: 45,
    minTreasury: 180,
  },
  iran: {
    type: 'survival',
    description: 'Resist sanctions: survive 40 turns with treasury above 175 TP.',
    surviveTurns: 40,
    minTreasury: 175,
  },
  north_korea: {
    type: 'survival',
    description: 'Regime endures: survive 50 turns with regime security above 0.4.',
    surviveTurns: 50,
    minRegimeSecurity: 0.4,
  },
  south_korea: {
    type: 'defensive',
    description: 'Peninsula stability: survive 40 turns with NK not controlling any SK region.',
    surviveTurns: 40,
    minTurns: 40,
  },
};

export function getWinCondition(countryId: string): WinConditionDef | undefined {
  return WIN_CONDITIONS[countryId];
}

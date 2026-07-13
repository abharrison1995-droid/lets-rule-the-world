import type { GameState, NpcMechanicRuntime } from '../types/game';
import { getRelation } from '../data/relations';
import { getNpcMechanicDef, NPC_MECHANICS } from '../data/npcMechanics';
import { getNpcNationIds } from './npcNation';

const SUEZ_IMPORTERS = new Set([
  'usa', 'england', 'germany', 'france', 'japan', 'south_korea', 'india', 'china', 'turkey', 'pakistan',
]);

export interface NpcMechanicStatus {
  mechanicId: string;
  name: string;
  description: string;
  active: boolean;
  intensity: number;
  statusLine: string;
  detailLines: string[];
}

function clamp100(v: number): number {
  return Math.max(0, Math.min(100, v));
}

function bumpMilitaryDev(
  dev: { troopQuality: number; missileDefense: number; droneProgram: number; strikeCapability: number; fortification: number },
  key: keyof typeof dev,
  amount: number,
  max = 5
): void {
  dev[key] = Math.min(max, dev[key] + amount);
}

function isAtWar(state: GameState, a: string, b: string): boolean {
  return state.wars.some(w => w.belligerents.includes(a) && w.belligerents.includes(b));
}

function isNationAtWar(state: GameState, nationId: string): boolean {
  return state.wars.some(w => w.belligerents.includes(nationId));
}

function avgRelations(state: GameState, fromId: string, targets: string[]): number {
  const values = targets
    .filter(id => state.countries[id])
    .map(id => getRelation(state.relations, fromId, id));
  if (values.length === 0) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function warDurationTurns(state: GameState, nationId: string): number {
  const wars = state.wars.filter(w => w.belligerents.includes(nationId));
  if (wars.length === 0) return 0;
  return Math.max(...wars.map(w => state.turn - w.startTurn));
}

function regionalMideastStress(state: GameState): number {
  const hotIds = ['israel', 'iran', 'egypt', 'saudi_arabia', 'turkey'];
  let stress = 0;
  for (const war of state.wars) {
    const involved = war.belligerents.filter(b => hotIds.includes(b));
    if (involved.length >= 2) stress += 35;
    else if (involved.length === 1) stress += 18;
  }
  const egypt = state.countries.egypt;
  if (egypt && egypt.stats.regimeSecurity < 0.45) stress += 20;
  if (state.globalOilShock && state.globalOilShock.turnsRemaining > 0) stress += 15;
  return clamp100(stress);
}

export function createDefaultNpcMechanicState(): Record<string, NpcMechanicRuntime> {
  const state: Record<string, NpcMechanicRuntime> = {};
  for (const def of NPC_MECHANICS) {
    state[def.countryId] = {
      mechanicId: def.id,
      intensity: def.countryId === 'ukraine' ? 55 : 0,
      active: def.countryId === 'ukraine',
      turnsActive: def.countryId === 'ukraine' ? 1 : 0,
    };
  }
  return state;
}

function runtime(state: GameState, npcId: string): NpcMechanicRuntime {
  if (!state.npcMechanicState[npcId]) {
    const def = getNpcMechanicDef(npcId);
    state.npcMechanicState[npcId] = {
      mechanicId: def?.id ?? 'unknown',
      intensity: 0,
      active: false,
      turnsActive: 0,
    };
  }
  return state.npcMechanicState[npcId];
}

function tickWesternAidPipeline(state: GameState): void {
  const rt = runtime(state, 'ukraine');
  const ukraine = state.countries.ukraine;
  if (!ukraine) return;

  const atWar = isAtWar(state, 'ukraine', 'russia');
  if (!atWar) {
    rt.active = false;
    rt.intensity = Math.max(0, rt.intensity - 4);
    rt.turnsActive = 0;
    return;
  }

  const westernSupport = avgRelations(state, 'ukraine', ['usa', 'england', 'germany', 'france']);
  rt.active = true;
  rt.turnsActive += 1;
  rt.intensity = clamp100(((westernSupport + 100) / 200) * 100);

  const aidScale = rt.intensity / 100;
  ukraine.stats.treasuryPoints += 0.6 + aidScale * 1.4;
  ukraine.stats.moraleBase = Math.min(0.95, ukraine.stats.moraleBase + 0.004 * aidScale);
  ukraine.stats.warReadiness = Math.min(1, (ukraine.stats.warReadiness ?? 0.7) + 0.015 * aidScale);
  ukraine.stats.defenseBudget = Math.min(0.32, ukraine.stats.defenseBudget + 0.001 * aidScale);

  if (rt.turnsActive === 1) {
    state.history.push(`Turn ${state.turn}: Western aid pipeline to Ukraine is active — support scales with allied relations.`);
  } else if (rt.intensity >= 70 && rt.turnsActive % 7 === 0) {
    state.history.push(`Turn ${state.turn}: Ukraine receives a major Western aid tranche — treasury and morale bolstered.`);
  } else if (rt.intensity < 25 && rt.turnsActive % 6 === 0) {
    state.history.push(`Turn ${state.turn}: Ukraine aid pipeline strained — Western capitals debate reduced packages.`);
  }
}

function tickZeitenwende(state: GameState): void {
  const rt = runtime(state, 'germany');
  const germany = state.countries.germany;
  if (!germany) return;

  const russiaAtWar = isNationAtWar(state, 'russia');
  const warTurns = russiaAtWar ? warDurationTurns(state, 'russia') : 0;
  const ukraineStrain = state.countries.ukraine?.stats.warExhaustion ?? 0;
  const shouldActivate = russiaAtWar && (warTurns >= 4 || ukraineStrain > 0.38);

  if (!shouldActivate) {
    rt.active = false;
    rt.turnsActive = 0;
    rt.intensity = Math.max(0, rt.intensity - 2);
    return;
  }

  if (!rt.active) {
    rt.active = true;
    rt.turnsActive = 1;
    rt.intensity = 8;
    state.history.push(`Turn ${state.turn}: Germany’s Zeitenwende accelerates — Berlin commits to sustained rearmament.`);
  } else {
    rt.turnsActive += 1;
    rt.intensity = clamp100(rt.intensity + 6 + Math.min(12, warTurns));
  }

  germany.stats.defenseBudget = Math.min(0.2, germany.stats.defenseBudget + 0.004);
  germany.stats.treasuryPoints = Math.max(8, germany.stats.treasuryPoints - 0.35);
  if (rt.intensity >= 40 && rt.turnsActive % 4 === 0) {
    bumpMilitaryDev(germany.militaryDev, 'troopQuality', 0.05);
    bumpMilitaryDev(germany.militaryDev, 'missileDefense', 0.05);
  }
  if (rt.intensity >= 75 && rt.turnsActive % 8 === 0) {
    state.history.push(`Turn ${state.turn}: German Bundestag approves another Zeitenwende tranche — defense industry surges.`);
  }
}

function tickRemilitarization(state: GameState): void {
  const rt = runtime(state, 'japan');
  const japan = state.countries.japan;
  if (!japan) return;

  const chinaTension = -getRelation(state.relations, 'japan', 'china');
  const usTie = getRelation(state.relations, 'japan', 'usa');
  const pacificWar = state.wars.some(w =>
    w.belligerents.includes('china') || w.belligerents.includes('north_korea')
  );
  const pressure = chinaTension * 0.55 + usTie * 0.25 + (pacificWar ? 25 : 0);
  rt.intensity = clamp100(rt.intensity * 0.92 + pressure * 0.08);
  rt.active = rt.intensity >= 22;

  if (!rt.active) {
    rt.turnsActive = 0;
    return;
  }

  rt.turnsActive += 1;
  japan.stats.defenseBudget = Math.min(0.14, japan.stats.defenseBudget + 0.002);
  if (rt.turnsActive % 3 === 0) {
    bumpMilitaryDev(japan.militaryDev, 'strikeCapability', 0.04);
    bumpMilitaryDev(japan.militaryDev, 'droneProgram', 0.03);
  }
  if (rt.turnsActive === 1) {
    state.history.push(`Turn ${state.turn}: Japan’s remilitarization debate hardens — incremental capability upgrades begin.`);
  } else if (rt.intensity >= 60 && rt.turnsActive % 10 === 0) {
    state.history.push(`Turn ${state.turn}: Tokyo expands strike and drone programs under remilitarization push.`);
  }
}

function tickIndependentDeterrent(state: GameState): void {
  const rt = runtime(state, 'france');
  const france = state.countries.france;
  const ukraine = state.countries.ukraine;
  if (!france) return;

  const russiaHostility = -getRelation(state.relations, 'france', 'russia');
  const ukraineWar = isNationAtWar(state, 'ukraine');
  const pressure = russiaHostility * 0.6 + (ukraineWar ? 30 : 0);
  rt.intensity = clamp100(rt.intensity * 0.9 + pressure * 0.1);
  rt.active = rt.intensity >= 30;

  if (!rt.active) {
    rt.turnsActive = 0;
    return;
  }

  rt.turnsActive += 1;
  france.stats.warReadiness = Math.min(1, (france.stats.warReadiness ?? 0.85) + 0.008);

  if (ukraine && ukraineWar) {
    const aid = 0.25 + (rt.intensity / 100) * 0.55;
    ukraine.stats.treasuryPoints += aid;
    ukraine.stats.moraleBase = Math.min(0.95, ukraine.stats.moraleBase + 0.002);
  }

  if (rt.turnsActive === 1) {
    state.history.push(`Turn ${state.turn}: France asserts independent deterrent posture — nuclear and expeditionary signaling intensifies.`);
  } else if (rt.intensity >= 55 && rt.turnsActive % 9 === 0) {
    state.history.push(`Turn ${state.turn}: Paris routes autonomous military aid to Ukraine outside NATO consensus.`);
  }
}

function tickOpecLeverage(state: GameState): void {
  const rt = runtime(state, 'saudi_arabia');
  const saudi = state.countries.saudi_arabia;
  if (!saudi) return;

  const shock = state.globalOilShock;
  if (!shock || shock.turnsRemaining <= 0) {
    rt.active = false;
    rt.turnsActive = 0;
    rt.intensity = Math.max(0, rt.intensity - 3);
    return;
  }

  rt.active = true;
  rt.turnsActive += 1;
  rt.intensity = clamp100(shock.severity * 220);

  const usaRel = getRelation(state.relations, 'saudi_arabia', 'usa');
  if (usaRel >= 35) {
    shock.severity = Math.max(0.08, shock.severity - 0.012);
    if (rt.turnsActive % 5 === 0) {
      state.history.push(`Turn ${state.turn}: Saudi Arabia uses OPEC leverage to soften the global oil shock.`);
    }
  } else if (usaRel < 10) {
    shock.severity = Math.min(0.45, shock.severity + 0.004);
    if (rt.turnsActive % 6 === 0) {
      state.history.push(`Turn ${state.turn}: Riyadh keeps barrels tight — OPEC messaging worsens the oil shock.`);
    }
  }
}

function tickSuezGatekeeper(state: GameState): void {
  const rt = runtime(state, 'egypt');
  const egypt = state.countries.egypt;
  if (!egypt) return;

  const stress = regionalMideastStress(state);
  rt.intensity = clamp100(rt.intensity * 0.85 + stress * 0.15);
  rt.active = rt.intensity >= 28;

  if (!rt.active) {
    rt.turnsActive = 0;
    return;
  }

  rt.turnsActive += 1;
  egypt.stats.regimeSecurity = Math.max(0.15, egypt.stats.regimeSecurity - 0.004 * (rt.intensity / 100));
  egypt.stats.treasuryPoints += 0.15 * (rt.intensity / 100);

  if (rt.turnsActive === 1) {
    state.history.push(`Turn ${state.turn}: Egypt’s Suez gatekeeper role stressed — regional war spillover threatens transit.`);
  } else if (rt.intensity >= 55 && rt.turnsActive % 8 === 0) {
    state.history.push(`Turn ${state.turn}: Suez transit delays ripple through global trade — importers face extra costs.`);
  }
}

/** Extra income drag on major importers when Suez is under strain */
export function getSuezTransitDrag(state: GameState, countryId: string): number {
  if (!SUEZ_IMPORTERS.has(countryId)) return 0;
  const rt = state.npcMechanicState?.egypt;
  if (!rt?.active || rt.intensity < 28) return 0;
  const country = state.countries[countryId];
  if (!country) return 0;
  return country.stats.treasuryPoints * (rt.intensity / 100) * 0.006;
}

export function getNpcMechanicStatus(state: GameState, npcId: string): NpcMechanicStatus | null {
  const def = getNpcMechanicDef(npcId);
  const rt = state.npcMechanicState?.[npcId];
  if (!def || !rt) return null;

  const detailLines: string[] = [];
  let statusLine: string;

  switch (def.id) {
    case 'western_aid_pipeline': {
      const support = avgRelations(state, 'ukraine', ['usa', 'england', 'germany', 'france']);
      statusLine = rt.active
        ? `Active — Western support index ${Math.round(rt.intensity)}% (avg relations ${Math.round(support)})`
        : def.dormantHint;
      if (rt.active) {
        detailLines.push('Treasury, morale, and war readiness for Ukraine scale with allied relations.');
      }
      break;
    }
    case 'zeitenwende':
      statusLine = rt.active
        ? `Active — rearmament phase ${Math.round(rt.intensity)}% (${rt.turnsActive}t)`
        : def.dormantHint;
      if (rt.active) {
        detailLines.push('Raises German defense budget and slowly upgrades military development.');
      }
      break;
    case 'remilitarization':
      statusLine = rt.active
        ? `Active — remil index ${Math.round(rt.intensity)}%`
        : def.dormantHint;
      if (rt.active) {
        detailLines.push('Gradual strike, drone, and defense-budget increases under Pacific tension.');
      }
      break;
    case 'independent_deterrent':
      statusLine = rt.active
        ? `Active — deterrent posture ${Math.round(rt.intensity)}%`
        : def.dormantHint;
      if (rt.active) {
        detailLines.push('Boosts French readiness and routes autonomous aid to Ukraine when at war.');
      }
      break;
    case 'opec_leverage':
      statusLine = rt.active
        ? `Active — modulating shock at ${Math.round(rt.intensity)}% leverage`
        : def.dormantHint;
      if (rt.active && state.globalOilShock) {
        detailLines.push(`Oil shock severity ${(state.globalOilShock.severity * 100).toFixed(0)}% — USA relations steer Riyadh.`);
      }
      break;
    case 'suez_gatekeeper':
      statusLine = rt.active
        ? `Active — transit strain ${Math.round(rt.intensity)}%`
        : def.dormantHint;
      if (rt.active) {
        detailLines.push('Imposes trade drag on major importers; strains Egyptian regime security.');
      }
      break;
    default:
      statusLine = rt.active ? `Active (${Math.round(rt.intensity)}%)` : def.dormantHint;
  }

  return {
    mechanicId: def.id,
    name: def.name,
    description: def.description,
    active: rt.active,
    intensity: rt.intensity,
    statusLine,
    detailLines,
  };
}

export function tickNpcMechanics(state: GameState): void {
  if (!state.npcMechanicState) {
    state.npcMechanicState = createDefaultNpcMechanicState();
  }

  tickWesternAidPipeline(state);
  tickZeitenwende(state);
  tickRemilitarization(state);
  tickIndependentDeterrent(state);
  tickOpecLeverage(state);
  tickSuezGatekeeper(state);

  for (const npcId of getNpcNationIds(state)) {
    runtime(state, npcId);
  }
}

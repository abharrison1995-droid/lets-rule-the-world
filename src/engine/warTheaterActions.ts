import type { GameState, TheaterDoctrine, TheaterResolveMode } from '../types/game';
import { axialNeighbors, getTheaterDef } from '../data/theaterDefs';
import { getEffectiveSpendCost } from './fiscal';
import { getTheater, makeStack } from './warTheaterCore';
import { resolveHexBattle } from './warTheaterCombat';

/** Player-triggered theater actions: moves, reinforcement, doctrine, expeditionary support, aid. */

const REINFORCE_COST = 4;
const AID_REINFORCE_COST = 5;
const INTERVENTION_THRESHOLD = 100;
const INTERVENTION_PER_DEPLOY = 28;

function playerCanPay(state: GameState, costTp: number): boolean {
  const country = state.countries[state.playerCountryId];
  if (!country) return false;
  return country.stats.treasuryPoints >= getEffectiveSpendCost(country, costTp);
}

function playerPay(state: GameState, costTp: number): boolean {
  const country = state.countries[state.playerCountryId];
  if (!country) return false;
  const effective = getEffectiveSpendCost(country, costTp);
  if (country.stats.treasuryPoints < effective) return false;
  country.stats.treasuryPoints -= effective;
  return true;
}

export function playerTheaterMove(
  state: GameState,
  theaterId: string,
  fromHexId: string,
  toHexId: string
): string | null {
  const theater = getTheater(state, theaterId);
  const def = theater ? getTheaterDef(theater.defId) : undefined;
  if (!theater || !def) return 'Theater not found.';
  if (theater.pendingFate) return 'Resolve captured region fate first.';

  const fromDef = def.hexes.find(h => h.id === fromHexId);
  const toDef = def.hexes.find(h => h.id === toHexId);
  if (!fromDef || !toDef) return 'Invalid hex.';

  const adjacent = axialNeighbors(fromDef.q, fromDef.r).some(([q, r]) => q === toDef.q && r === toDef.r);
  if (!adjacent) return 'Can only move to adjacent hexes.';

  const from = theater.hexes[fromHexId];
  const to = theater.hexes[toHexId];
  if (!from?.stack || from.stack.countryId !== state.playerCountryId) return 'No friendly stack there.';

  if (to.ownerId !== state.playerCountryId && to.stack && to.stack.countryId !== state.playerCountryId) {
    return resolveHexBattle(state, theater, toDef, state.playerCountryId, fromHexId);
  }

  // Peaceful move / reinforce friendly empty
  if (!to.stack || to.stack.countryId === state.playerCountryId) {
    const moving = Math.floor(from.stack.strength * 0.6);
    from.stack.strength = Math.max(4, from.stack.strength - moving);
    if (to.stack && to.stack.countryId === state.playerCountryId) {
      to.stack.strength += moving;
    } else {
      to.stack = makeStack(state.playerCountryId, moving, from.stack.tags, [...from.stack.specialists]);
      to.ownerId = state.playerCountryId;
    }
    return `Moved ${moving} strength to adjacent hex.`;
  }

  return resolveHexBattle(state, theater, toDef, state.playerCountryId, fromHexId);
}

export function playerReinforceTheater(
  state: GameState,
  theaterId: string,
  hexId: string
): string | null {
  const theater = getTheater(state, theaterId);
  if (!theater) return 'Theater not found.';
  const hex = theater.hexes[hexId];
  if (!hex || hex.ownerId !== state.playerCountryId) return 'Must reinforce a hex you control.';
  if (!playerCanPay(state, REINFORCE_COST)) return 'Insufficient treasury.';
  playerPay(state, REINFORCE_COST);

  if (!hex.stack) {
    hex.stack = makeStack(state.playerCountryId, 10, ['infantry'], []);
  } else {
    hex.stack.strength += 10;
    if (!hex.stack.tags.includes('infantry')) hex.stack.tags.push('infantry');
  }
  return `Reinforced hex (+10 strength, −${REINFORCE_COST} TP).`;
}

export function setTheaterDoctrine(
  state: GameState,
  theaterId: string,
  doctrine: TheaterDoctrine
): void {
  const theater = getTheater(state, theaterId);
  if (!theater) return;
  theater.doctrineByCountry[state.playerCountryId] = doctrine;
}

export function setTheaterResolveMode(
  state: GameState,
  theaterId: string,
  mode: TheaterResolveMode
): void {
  const theater = getTheater(state, theaterId);
  if (!theater) return;
  theater.resolveMode = mode;
}

export function playerDeployExpeditionary(
  state: GameState,
  theaterId: string,
  hexId: string,
  supportCountryId: string
): string | null {
  const theater = getTheater(state, theaterId);
  const def = theater ? getTheaterDef(theater.defId) : undefined;
  if (!theater || !def) return 'Theater not found.';

  const hexDef = def.hexes.find(h => h.id === hexId);
  const rt = theater.hexes[hexId];
  if (!hexDef || !rt) return 'Invalid hex.';
  if (rt.ownerId !== supportCountryId && rt.stack?.countryId !== supportCountryId) {
    return 'Expeditionary forces must deploy into a partner-held hex.';
  }
  if (!playerCanPay(state, 8)) return 'Insufficient treasury for expeditionary deployment.';
  playerPay(state, 8);

  const existing = rt.stack;
  if (existing && existing.countryId === supportCountryId) {
    existing.strength += 12;
    if (!existing.tags.includes('air')) existing.tags.push('air');
    existing.specialists.push('expeditionary');
  } else {
    rt.stack = makeStack(supportCountryId, 12, ['infantry', 'air'], ['expeditionary']);
    rt.ownerId = supportCountryId;
  }

  const war = state.wars.find(w => w.id === theater.warId);
  state.history.push(
    `Turn ${state.turn}: ${state.countries[state.playerCountryId]?.name} deploys expeditionary forces into ${theater.name} in support of ${state.countries[supportCountryId]?.name}.`
  );

  if (war && !war.belligerents.includes(state.playerCountryId)) {
    bumpInterventionMeter(state, war.id, INTERVENTION_PER_DEPLOY);
  }

  return 'Expeditionary detachment deployed.';
}

export function getInterventionMeter(state: GameState, warId: string): number {
  return state.interventionMeters?.[warId] ?? 0;
}

function bumpInterventionMeter(state: GameState, warId: string, amount: number): void {
  state.interventionMeters ??= {};
  const next = Math.min(INTERVENTION_THRESHOLD, (state.interventionMeters[warId] ?? 0) + amount);
  state.interventionMeters[warId] = next;
  state.history.push(
    `Turn ${state.turn}: Intervention meter ${Math.round(next)}/${INTERVENTION_THRESHOLD} for this war.`
  );
  if (next >= INTERVENTION_THRESHOLD) {
    const war = state.wars.find(w => w.id === warId);
    if (war && !war.belligerents.includes(state.playerCountryId)) {
      // Soft pull-in at threshold — join as co-belligerent
      war.belligerents.push(state.playerCountryId);
      war.isDefensive[state.playerCountryId] = false;
      state.interventionMeters[warId] = 0;
      state.history.push(
        `Turn ${state.turn}: Intervention threshold reached — ${state.countries[state.playerCountryId]?.name} is pulled into the war.`
      );
    }
  }
}

export type TheaterAidPackage = 'reinforce' | 'weapons_armor' | 'weapons_drone';

/** Aid stub — reinforce recipient stacks and/or unlock weapon tags */
export function playerSendTheaterAid(
  state: GameState,
  theaterId: string,
  recipientId: string,
  pkg: TheaterAidPackage
): string | null {
  const theater = getTheater(state, theaterId);
  if (!theater || theater.closed) return 'Theater not found.';

  const cost = pkg === 'reinforce' ? AID_REINFORCE_COST : AID_REINFORCE_COST + 2;
  if (!playerCanPay(state, cost)) return 'Insufficient treasury for aid package.';
  playerPay(state, cost);

  const friendly = Object.entries(theater.hexes).filter(
    ([, rt]) => rt.ownerId === recipientId || rt.stack?.countryId === recipientId
  );
  if (friendly.length === 0) return 'No recipient hexes to aid.';

  friendly.sort((a, b) => (b[1].stack?.strength ?? 0) - (a[1].stack?.strength ?? 0));
  const targets = friendly.slice(0, pkg === 'reinforce' ? 3 : 2);

  for (const [, rt] of targets) {
    if (!rt.stack) {
      rt.stack = makeStack(recipientId, 8, ['infantry'], ['aid']);
    } else {
      if (pkg === 'reinforce') rt.stack.strength += 8;
      if (pkg === 'weapons_armor' && !rt.stack.tags.includes('armor')) rt.stack.tags.push('armor');
      if (pkg === 'weapons_drone' && !rt.stack.tags.includes('drone')) rt.stack.tags.push('drone');
      if (pkg !== 'reinforce') rt.stack.strength += 4;
      rt.stack.specialists.push(`aid_${pkg}`);
    }
  }

  const labels: Record<TheaterAidPackage, string> = {
    reinforce: 'reinforcement convoy',
    weapons_armor: 'armor package',
    weapons_drone: 'drone package',
  };
  state.history.push(
    `Turn ${state.turn}: ${state.countries[state.playerCountryId]?.name} sends ${labels[pkg]} to ${state.countries[recipientId]?.name} in ${theater.name}.`
  );
  return `Aid delivered: ${labels[pkg]} (−${cost} TP).`;
}

export function setPlayerDoctrineAi(state: GameState, theaterId: string, enabled: boolean): void {
  const theater = getTheater(state, theaterId);
  if (!theater) return;
  theater.playerDoctrineAi = enabled;
}

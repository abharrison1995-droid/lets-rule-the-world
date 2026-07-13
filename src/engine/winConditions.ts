import type { GameState } from '../types/game';
import { getRelation } from '../data/relations';
import { getWinCondition } from '../data/winConditions';
import { formatDisplayGDP } from './treasuryDisplay';

export interface WinProgress {
  description: string;
  progress: number;
  met: boolean;
  details: string[];
}

function countHighRelationAllies(
  state: GameState,
  playerId: string,
  threshold: number
): number {
  return Object.keys(state.countries).filter(
    id => id !== playerId && getRelation(state.relations, playerId, id) > threshold
  ).length;
}

function isInAlliance(state: GameState, countryId: string, allianceId: string): boolean {
  return state.alliances.some(a => a.id === allianceId && a.members.includes(countryId));
}

function controlsAllHomeRegions(state: GameState, countryId: string): boolean {
  const homeRegions = Object.values(state.regions).filter(r => r.countryId === countryId);
  return homeRegions.length > 0 && homeRegions.every(r => r.controlledBy === countryId);
}

function annexProgress(state: GameState, playerId: string, annexIds: string[]): { met: boolean; details: string[] } {
  const details: string[] = [];
  const checks: boolean[] = [];

  for (const annexId of annexIds) {
    const annexRegions = Object.values(state.regions).filter(r => r.countryId === annexId);
    const controlledAnnex = annexRegions.filter(r => r.controlledBy === playerId).length;
    const met = annexRegions.length > 0 && controlledAnnex === annexRegions.length;
    checks.push(met);
    details.push(
      `Annex ${state.countries[annexId]?.name ?? annexId}: ${controlledAnnex}/${annexRegions.length} regions`
    );
  }

  return { met: checks.length > 0 && checks.every(Boolean), details };
}

function getUsaWinProgress(state: GameState, _player: NonNullable<GameState['countries'][string]>): WinProgress {
  const win = getWinCondition('usa')!;
  const playerId = state.playerCountryId;
  const details: string[] = [];

  const allies = countHighRelationAllies(state, playerId, win.alliesRelationThreshold ?? 50);
  const alliesMet = allies >= (win.minAlliesHighRelation ?? 3);
  details.push(`Alliance path: ${allies} / ${win.minAlliesHighRelation} nations above ${win.alliesRelationThreshold ?? 50} relations`);

  const totalRegions = Object.keys(state.regions).length;
  const controlled = Object.values(state.regions).filter(r => r.controlledBy === playerId).length;
  const controlPct = controlled / totalRegions;
  const territoryMet =
    controlPct >= (win.regionControlPct ?? 0.35) && state.turn >= (win.minTurns ?? 30);
  details.push(
    `Territory path: ${(controlPct * 100).toFixed(0)}% / ${((win.regionControlPct ?? 0.35) * 100).toFixed(0)}% · turns ${state.turn} / ${win.minTurns ?? 30}`
  );

  const met = alliesMet || territoryMet;
  const alliesProgress = Math.min(1, allies / (win.minAlliesHighRelation ?? 3));
  const territoryProgress = Math.min(
    1,
    (controlPct / (win.regionControlPct ?? 0.35) + state.turn / (win.minTurns ?? 30)) / 2
  );
  const progress = Math.max(alliesProgress, territoryProgress);

  return { description: win.description, progress, met, details };
}

function getRussiaWinProgress(state: GameState, _player: NonNullable<GameState['countries'][string]>): WinProgress {
  const win = getWinCondition('russia')!;
  const playerId = state.playerCountryId;
  const details: string[] = [];

  const annex = annexProgress(state, playerId, win.annexCountryIds ?? []);
  details.push(...annex.details);

  const totalRegions = Object.keys(state.regions).length;
  const controlled = Object.values(state.regions).filter(r => r.controlledBy === playerId).length;
  const controlPct = controlled / totalRegions;
  const conquestMet =
    controlPct >= (win.regionControlPct ?? 0.3) && state.turn >= (win.minTurns ?? 20);
  details.push(
    `Conquest path: ${(controlPct * 100).toFixed(0)}% / ${((win.regionControlPct ?? 0.3) * 100).toFixed(0)}% · turns ${state.turn} / ${win.minTurns ?? 20}`
  );

  const met = annex.met || conquestMet;
  let annexProgressVal = 0;
  for (const annexId of win.annexCountryIds ?? []) {
    const annexRegions = Object.values(state.regions).filter(r => r.countryId === annexId);
    if (annexRegions.length > 0) {
      const controlledAnnex = annexRegions.filter(r => r.controlledBy === playerId).length;
      annexProgressVal = Math.max(annexProgressVal, controlledAnnex / annexRegions.length);
    }
  }
  const conquestProgress = Math.min(
    1,
    (controlPct / (win.regionControlPct ?? 0.3) + state.turn / (win.minTurns ?? 20)) / 2
  );
  const progress = Math.max(annexProgressVal, conquestProgress);

  return { description: win.description, progress, met, details };
}

export function getWinProgress(state: GameState): WinProgress {
  const playerId = state.playerCountryId;
  const player = state.countries[playerId];
  const win = getWinCondition(playerId);

  if (!player || !win) {
    return { description: 'No win condition defined.', progress: 0, met: false, details: [] };
  }

  if (playerId === 'usa') return getUsaWinProgress(state, player);
  if (playerId === 'russia') return getRussiaWinProgress(state, player);

  const details: string[] = [];
  const checks: boolean[] = [];

  const totalRegions = Object.keys(state.regions).length;
  const controlled = Object.values(state.regions).filter(r => r.controlledBy === playerId).length;
  const controlPct = controlled / totalRegions;

  if (win.regionControlPct !== undefined) {
    const met = controlPct >= win.regionControlPct;
    checks.push(met);
    details.push(`Territory: ${(controlPct * 100).toFixed(0)}% / ${(win.regionControlPct * 100).toFixed(0)}%`);
  }

  if (win.surviveTurns !== undefined) {
    const met = state.turn >= win.surviveTurns && !state.declineMode && !state.gameOver;
    checks.push(met);
    details.push(`Survival: turn ${state.turn} / ${win.surviveTurns}`);
  }

  if (win.minTurns !== undefined && win.type !== 'survival') {
    const met = state.turn >= win.minTurns;
    checks.push(met);
    details.push(`Minimum turns: ${state.turn} / ${win.minTurns}`);
  }

  if (win.minTreasury !== undefined) {
    const met = player.stats.treasuryPoints >= win.minTreasury;
    checks.push(met);
    details.push(`Economy: ${formatDisplayGDP(player.stats.treasuryPoints)} / ${formatDisplayGDP(win.minTreasury)}`);
  }

  if (win.minRegimeSecurity !== undefined) {
    const met = player.stats.regimeSecurity >= win.minRegimeSecurity;
    checks.push(met);
    details.push(`Regime security: ${(player.stats.regimeSecurity * 100).toFixed(0)}% / ${(win.minRegimeSecurity * 100).toFixed(0)}%`);
  }

  if (win.requireAllianceId) {
    const met = isInAlliance(state, playerId, win.requireAllianceId);
    checks.push(met);
    details.push(`${win.requireAllianceId.toUpperCase()} membership: ${met ? 'yes' : 'no'}`);
  }

  if (win.minAlliesHighRelation !== undefined) {
    const threshold = win.alliesRelationThreshold ?? 50;
    const allies = countHighRelationAllies(state, playerId, threshold);
    const met = allies >= win.minAlliesHighRelation;
    checks.push(met);
    details.push(`Allies above ${threshold}: ${allies} / ${win.minAlliesHighRelation}`);
  }

  if (win.minRelations) {
    for (const [nationId, threshold] of Object.entries(win.minRelations)) {
      const rel = getRelation(state.relations, playerId, nationId);
      const met = rel >= threshold;
      checks.push(met);
      details.push(`${state.countries[nationId]?.name ?? nationId} relations: ${rel} / ${threshold}`);
    }
  }

  if (win.annexCountryIds) {
    const annex = annexProgress(state, playerId, win.annexCountryIds);
    checks.push(annex.met);
    details.push(...annex.details);
  }

  if (win.controlHomeRegions) {
    const met = controlsAllHomeRegions(state, playerId);
    checks.push(met);
    details.push(`Home regions controlled: ${met ? 'yes' : 'no'}`);
  }

  if (playerId === 'israel') {
    const met = controlsAllHomeRegions(state, 'israel');
    checks.push(met);
    details.push(`Home territory intact: ${met ? 'yes' : 'NO'}`);
  }

  if (playerId === 'south_korea') {
    const skRegions = Object.values(state.regions).filter(r => r.countryId === 'south_korea');
    const nkOccupied = skRegions.some(r => r.controlledBy === 'north_korea');
    checks.push(!nkOccupied);
    details.push(`NK occupation: ${nkOccupied ? 'YES — failing' : 'none'}`);
  }

  const met = checks.length > 0 && checks.every(Boolean);
  const progress = checks.length > 0 ? checks.filter(Boolean).length / checks.length : 0;

  return { description: win.description, progress, met, details };
}

export function checkWinConditions(state: GameState): void {
  const player = state.countries[state.playerCountryId];
  if (!player || state.gameOver || state.playerWon) return;

  const { met, description } = getWinProgress(state);
  if (!met) return;

  state.playerWon = true;
  state.winReason = `${player.name} achieves victory: ${description}`;
  state.history.push(`Turn ${state.turn}: VICTORY — ${player.name}!`);
}

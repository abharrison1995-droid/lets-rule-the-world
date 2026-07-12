import type { GameState } from '../types/game';
import { getRelation } from '../data/relations';
import { getWinCondition } from '../data/winConditions';

export interface WinProgress {
  description: string;
  progress: number;
  met: boolean;
  details: string[];
}

export function getWinProgress(state: GameState): WinProgress {
  const playerId = state.playerCountryId;
  const player = state.countries[playerId];
  const win = getWinCondition(playerId);

  if (!player || !win) {
    return { description: 'No win condition defined.', progress: 0, met: false, details: [] };
  }

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

  if (win.minGdp !== undefined) {
    const met = player.stats.gdp >= win.minGdp;
    checks.push(met);
    details.push(`GDP: $${player.stats.gdp.toFixed(0)}B / $${win.minGdp}B`);
  }

  if (win.minRegimeSecurity !== undefined) {
    const met = player.stats.regimeSecurity >= win.minRegimeSecurity;
    checks.push(met);
    details.push(`Regime security: ${(player.stats.regimeSecurity * 100).toFixed(0)}% / ${(win.minRegimeSecurity * 100).toFixed(0)}%`);
  }

  if (win.minAlliesHighRelation !== undefined) {
    const allies = Object.keys(state.countries).filter(
      id => id !== playerId && getRelation(state.relations, playerId, id) > 50
    ).length;
    const met = allies >= win.minAlliesHighRelation;
    checks.push(met);
    details.push(`High-relation nations: ${allies} / ${win.minAlliesHighRelation}`);
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
    for (const annexId of win.annexCountryIds) {
      const annexRegions = Object.values(state.regions).filter(r => r.countryId === annexId);
      const controlledAnnex = annexRegions.filter(r => r.controlledBy === playerId).length;
      const met = annexRegions.length > 0 && controlledAnnex === annexRegions.length;
      checks.push(met);
      details.push(
        `Annex ${state.countries[annexId]?.name ?? annexId}: ${controlledAnnex}/${annexRegions.length} regions`
      );
    }
  }

  // Israel: no territorial loss
  if (playerId === 'israel') {
    const homeRegions = Object.values(state.regions).filter(r => r.countryId === 'israel');
    const allControlled = homeRegions.every(r => r.controlledBy === 'israel');
    checks.push(allControlled);
    details.push(`Home territory intact: ${allControlled ? 'yes' : 'NO'}`);
  }

  // South Korea: NK must not control SK regions
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

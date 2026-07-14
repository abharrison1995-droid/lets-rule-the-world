import type { GameState, WinConditionDef } from '../types/game';
import { getRelation } from '../data/relations';
import { getWinCondition } from '../data/winConditions';
import { getUsaCampaignLadderProgress } from './usaCampaign';
import { isUsaCampaignMode } from '../data/campaignUsa';
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

function homeControlFraction(state: GameState, countryId: string): number {
  const homeRegions = Object.values(state.regions).filter(r => r.countryId === countryId);
  if (homeRegions.length === 0) return 0;
  const held = homeRegions.filter(r => r.controlledBy === countryId).length;
  return held / homeRegions.length;
}

function countPlayerBilateralAgreements(state: GameState, playerId: string): number {
  return (state.bilateralAgreements ?? []).filter(
    a => a.a === playerId || a.b === playerId
  ).length;
}

function worldControlPct(state: GameState, playerId: string): number {
  const total = Object.keys(state.regions).length;
  if (total === 0) return 0;
  const controlled = Object.values(state.regions).filter(r => r.controlledBy === playerId).length;
  return controlled / total;
}

function treasuryRank(state: GameState, playerId: string): number {
  const ranked = Object.values(state.countries)
    .map(c => ({ id: c.id, tp: c.stats.treasuryPoints }))
    .sort((a, b) => b.tp - a.tp);
  const idx = ranked.findIndex(r => r.id === playerId);
  return idx < 0 ? 999 : idx + 1;
}

function annexProgress(state: GameState, playerId: string, annexIds: string[]): { met: boolean; details: string[]; progress: number } {
  const details: string[] = [];
  const checks: boolean[] = [];
  let progressSum = 0;

  for (const annexId of annexIds) {
    const annexRegions = Object.values(state.regions).filter(r => r.countryId === annexId);
    const controlledAnnex = annexRegions.filter(r => r.controlledBy === playerId).length;
    const met = annexRegions.length > 0 && controlledAnnex === annexRegions.length;
    checks.push(met);
    progressSum += annexRegions.length > 0 ? controlledAnnex / annexRegions.length : 0;
    details.push(
      `Annex ${state.countries[annexId]?.name ?? annexId}: ${controlledAnnex}/${annexRegions.length} regions`
    );
  }

  return {
    met: checks.length > 0 && checks.every(Boolean),
    details,
    progress: annexIds.length > 0 ? progressSum / annexIds.length : 0,
  };
}

interface CheckResult {
  label: string;
  met: boolean;
  weight?: number;
}

function pushCheck(out: CheckResult[], label: string, met: boolean, weight = 1): void {
  out.push({ label, met, weight });
}

function summarizeChecks(description: string, checks: CheckResult[]): WinProgress {
  const details = checks.map(c => `${c.met ? '✓' : '○'} ${c.label}`);
  const met = checks.length > 0 && checks.every(c => c.met);
  const totalW = checks.reduce((s, c) => s + (c.weight ?? 1), 0);
  const doneW = checks.reduce((s, c) => s + (c.met ? (c.weight ?? 1) : 0), 0);
  const progress = totalW > 0 ? doneW / totalW : 0;
  return { description, progress, met, details };
}

function applyCommonGates(
  state: GameState,
  win: WinConditionDef,
  playerId: string,
  checks: CheckResult[]
): void {
  const floor = win.absoluteMinTurns ?? win.minTurns ?? win.surviveTurns ?? 100;
  pushCheck(checks, `Campaign length: turn ${state.turn} / ${floor}`, state.turn >= floor, 2);

  if (win.requireNotInDecline) {
    pushCheck(checks, `Not in decline: ${state.declineMode ? 'NO' : 'yes'}`, !state.declineMode);
  }
  if (win.requireNoPariah) {
    const ok = (state.internationalPariahTurns ?? 0) <= 0;
    pushCheck(checks, `No international pariah: ${ok ? 'yes' : `${state.internationalPariahTurns}t`}`, ok);
  }
  if (win.controlHomeRegions) {
    const ok = controlsAllHomeRegions(state, playerId);
    pushCheck(checks, `Home regions controlled: ${ok ? 'yes' : 'NO'}`, ok);
  }
  if (win.minBilateralAgreements !== undefined) {
    const n = countPlayerBilateralAgreements(state, playerId);
    pushCheck(
      checks,
      `Bilateral deals: ${n} / ${win.minBilateralAgreements}`,
      n >= win.minBilateralAgreements,
      1.5
    );
  }
  if (win.requireAllianceId) {
    const ok = isInAlliance(state, playerId, win.requireAllianceId);
    pushCheck(checks, `${win.requireAllianceId.toUpperCase()} membership: ${ok ? 'yes' : 'no'}`, ok);
  }
  if (win.ukraineSovereigntyPct !== undefined) {
    const frac = homeControlFraction(state, 'ukraine');
    const ok = frac >= win.ukraineSovereigntyPct;
    pushCheck(
      checks,
      `Ukraine sovereignty: ${(frac * 100).toFixed(0)}% / ${(win.ukraineSovereigntyPct * 100).toFixed(0)}% of home regions`,
      ok,
      1.5
    );
  }
  if (win.maxTreasuryRank !== undefined) {
    const rank = treasuryRank(state, playerId);
    pushCheck(checks, `Treasury world rank: #${rank} (need ≤#${win.maxTreasuryRank})`, rank <= win.maxTreasuryRank, 1.5);
  }
}

/** USA: diplomatic-hegemony path OR hard territory path — both gated past turn 100 / 120 */
function getUsaWinProgress(state: GameState): WinProgress {
  const win = getWinCondition('usa')!;
  const playerId = state.playerCountryId;
  const diplomatic: CheckResult[] = [];
  const territory: CheckResult[] = [];

  // Path A — Pax Americana (diplomacy)
  pushCheck(diplomatic, `Pax path — turn ${state.turn} / 100`, state.turn >= 100, 2);
  const allies = countHighRelationAllies(state, playerId, win.alliesRelationThreshold ?? 80);
  pushCheck(
    diplomatic,
    `Deep partners (≥${win.alliesRelationThreshold}): ${allies} / ${win.minAlliesHighRelation}`,
    allies >= (win.minAlliesHighRelation ?? 6),
    2
  );
  const deals = countPlayerBilateralAgreements(state, playerId);
  pushCheck(diplomatic, `Bilateral deals: ${deals} / ${win.minBilateralAgreements}`, deals >= (win.minBilateralAgreements ?? 5), 1.5);
  pushCheck(diplomatic, `NATO membership: ${isInAlliance(state, playerId, 'nato') ? 'yes' : 'no'}`, isInAlliance(state, playerId, 'nato'));
  const ukrFrac = homeControlFraction(state, 'ukraine');
  pushCheck(
    diplomatic,
    `Ukraine sovereign: ${(ukrFrac * 100).toFixed(0)}% / ${((win.ukraineSovereigntyPct ?? 0.5) * 100).toFixed(0)}%`,
    ukrFrac >= (win.ukraineSovereigntyPct ?? 0.5),
    1.5
  );
  pushCheck(diplomatic, `Not in decline: ${state.declineMode ? 'NO' : 'yes'}`, !state.declineMode);
  pushCheck(
    diplomatic,
    `No pariah status: ${(state.internationalPariahTurns ?? 0) <= 0 ? 'yes' : 'NO'}`,
    (state.internationalPariahTurns ?? 0) <= 0
  );

  // Path B — continental hegemony
  const controlPct = worldControlPct(state, playerId);
  pushCheck(territory, `Conquest path — turn ${state.turn} / ${win.minTurns ?? 120}`, state.turn >= (win.minTurns ?? 120), 2);
  pushCheck(
    territory,
    `World territory: ${(controlPct * 100).toFixed(0)}% / ${((win.regionControlPct ?? 0.4) * 100).toFixed(0)}%`,
    controlPct >= (win.regionControlPct ?? 0.4),
    2
  );
  pushCheck(territory, `Home regions held: ${controlsAllHomeRegions(state, playerId) ? 'yes' : 'NO'}`, controlsAllHomeRegions(state, playerId));
  pushCheck(territory, `Not in decline: ${state.declineMode ? 'NO' : 'yes'}`, !state.declineMode);

  const dip = summarizeChecks(win.description, diplomatic);
  const ter = summarizeChecks(win.description, territory);
  const met = dip.met || ter.met;
  const progress = Math.max(dip.progress, ter.progress);
  const details = [
    '—— Diplomatic hegemony ——',
    ...dip.details,
    '—— Continental conquest ——',
    ...ter.details,
  ];

  return { description: win.description, progress, met, details };
}

/** Russia: annex Ukraine (100+) OR world conquest (120+) — no early OR cheese */
function getRussiaWinProgress(state: GameState): WinProgress {
  const win = getWinCondition('russia')!;
  const playerId = state.playerCountryId;
  const annexPath: CheckResult[] = [];
  const conquestPath: CheckResult[] = [];

  const annex = annexProgress(state, playerId, win.annexCountryIds ?? []);
  pushCheck(annexPath, `Annex path — turn ${state.turn} / 100`, state.turn >= 100, 2);
  pushCheck(annexPath, annex.details[0] ?? 'Annex Ukraine', annex.met, 2);
  const player = state.countries[playerId];
  const sec = player?.stats.regimeSecurity ?? 0;
  pushCheck(
    annexPath,
    `Regime security: ${(sec * 100).toFixed(0)}% / ${((win.minRegimeSecurity ?? 0.5) * 100).toFixed(0)}%`,
    sec >= (win.minRegimeSecurity ?? 0.5)
  );
  pushCheck(annexPath, `Home regions held: ${controlsAllHomeRegions(state, playerId) ? 'yes' : 'NO'}`, controlsAllHomeRegions(state, playerId));
  pushCheck(annexPath, `Not in decline: ${state.declineMode ? 'NO' : 'yes'}`, !state.declineMode);

  const controlPct = worldControlPct(state, playerId);
  pushCheck(conquestPath, `Eurasian path — turn ${state.turn} / ${win.minTurns ?? 120}`, state.turn >= (win.minTurns ?? 120), 2);
  pushCheck(
    conquestPath,
    `World territory: ${(controlPct * 100).toFixed(0)}% / ${((win.regionControlPct ?? 0.35) * 100).toFixed(0)}%`,
    controlPct >= (win.regionControlPct ?? 0.35),
    2
  );
  pushCheck(conquestPath, `Home regions held: ${controlsAllHomeRegions(state, playerId) ? 'yes' : 'NO'}`, controlsAllHomeRegions(state, playerId));
  pushCheck(conquestPath, `Not in decline: ${state.declineMode ? 'NO' : 'yes'}`, !state.declineMode);

  const a = summarizeChecks(win.description, annexPath);
  const c = summarizeChecks(win.description, conquestPath);
  return {
    description: win.description,
    progress: Math.max(a.progress, c.progress),
    met: a.met || c.met,
    details: ['—— Annex Ukraine ——', ...a.details, '—— Eurasian sphere ——', ...c.details],
  };
}

export function getWinProgress(state: GameState): WinProgress {
  const playerId = state.playerCountryId;
  const player = state.countries[playerId];
  const win = getWinCondition(playerId);

  if (!player || !win) {
    return { description: 'No win condition defined.', progress: 0, met: false, details: [] };
  }

  if (isUsaCampaignMode(state.gameMode) && state.usaCampaign && playerId === 'usa') {
    return getUsaCampaignLadderProgress(state);
  }

  if (playerId === 'usa') return getUsaWinProgress(state);
  if (playerId === 'russia') return getRussiaWinProgress(state);

  const checks: CheckResult[] = [];
  applyCommonGates(state, win, playerId, checks);

  const totalRegions = Object.keys(state.regions).length;
  const controlled = Object.values(state.regions).filter(r => r.controlledBy === playerId).length;
  const controlPct = totalRegions > 0 ? controlled / totalRegions : 0;

  if (win.regionControlPct !== undefined) {
    pushCheck(
      checks,
      `Territory: ${(controlPct * 100).toFixed(0)}% / ${(win.regionControlPct * 100).toFixed(0)}%`,
      controlPct >= win.regionControlPct,
      2
    );
  }

  if (win.surviveTurns !== undefined && win.absoluteMinTurns === undefined) {
    // absoluteMinTurns already covers campaign length when set
    pushCheck(checks, `Survival: turn ${state.turn} / ${win.surviveTurns}`, state.turn >= win.surviveTurns, 2);
  }

  if (win.minTurns !== undefined && win.absoluteMinTurns === undefined && win.type !== 'survival') {
    pushCheck(checks, `Minimum turns: ${state.turn} / ${win.minTurns}`, state.turn >= win.minTurns, 2);
  }

  if (win.minTreasury !== undefined) {
    pushCheck(
      checks,
      `Economy: ${formatDisplayGDP(player.stats.treasuryPoints)} / ${formatDisplayGDP(win.minTreasury)}`,
      player.stats.treasuryPoints >= win.minTreasury,
      1.5
    );
  }

  if (win.minRegimeSecurity !== undefined) {
    pushCheck(
      checks,
      `Regime security: ${(player.stats.regimeSecurity * 100).toFixed(0)}% / ${(win.minRegimeSecurity * 100).toFixed(0)}%`,
      player.stats.regimeSecurity >= win.minRegimeSecurity
    );
  }

  if (win.minAlliesHighRelation !== undefined) {
    const threshold = win.alliesRelationThreshold ?? 50;
    const allies = countHighRelationAllies(state, playerId, threshold);
    pushCheck(
      checks,
      `Partners above ${threshold}: ${allies} / ${win.minAlliesHighRelation}`,
      allies >= win.minAlliesHighRelation,
      1.5
    );
  }

  if (win.minRelations) {
    for (const [nationId, threshold] of Object.entries(win.minRelations)) {
      const rel = getRelation(state.relations, playerId, nationId);
      pushCheck(
        checks,
        `${state.countries[nationId]?.name ?? nationId} relations: ${rel} / ${threshold}`,
        rel >= threshold
      );
    }
  }

  if (win.annexCountryIds) {
    const annex = annexProgress(state, playerId, win.annexCountryIds);
    pushCheck(checks, annex.details.join('; ') || 'Annex targets', annex.met, 2);
  }

  if (playerId === 'south_korea') {
    const skRegions = Object.values(state.regions).filter(r => r.countryId === 'south_korea');
    const nkOccupied = skRegions.some(r => r.controlledBy === 'north_korea');
    pushCheck(checks, `NK occupation of SK: ${nkOccupied ? 'YES — failing' : 'none'}`, !nkOccupied, 1.5);
  }

  // Deduplicate absolute floor if both absoluteMinTurns and surviveTurns/minTurns were pushed
  // applyCommonGates already pushed absoluteMinTurns; survive/min only if absolute unset.

  return summarizeChecks(win.description, checks);
}

export function checkWinConditions(state: GameState): void {
  const player = state.countries[state.playerCountryId];
  if (!player || state.gameOver || state.playerWon) return;

  // USA campaign victory is owned by tickUsaCampaign (mission ladder).
  if (isUsaCampaignMode(state.gameMode) && state.usaCampaign) return;

  // Hard safety: never auto-win before turn 100 for any nation
  if (state.turn < 100) return;

  const { met, description } = getWinProgress(state);
  if (!met) return;

  state.playerWon = true;
  state.winReason = `${player.name} achieves victory: ${description}`;
  state.history.push(`Turn ${state.turn}: VICTORY — ${player.name}!`);
}

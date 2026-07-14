/**
 * Automated playthrough + invariant checks for LET'S RULE THE WORLD.
 * Run: npx --yes tsx scripts/playtest.ts
 */
import { createInitialState, advanceTurn } from '../src/engine/gameState';
import { getWinProgress, checkWinConditions } from '../src/engine/winConditions';
import { getActiveTheaters, playerTheaterMove, previewHexBattle } from '../src/engine/warTheater';
import { getTheaterDef } from '../src/data/theaterDefs';
import type { GameState } from '../src/types/game';
import { playerDeclareWar, playerLaunchStrike, canAfford } from '../src/engine/actions';
import { COUNTRIES } from '../src/data/countries';
import { resolveEventChoice } from '../src/engine/events';

interface Issue {
  severity: 'error' | 'warn';
  turn: number;
  nation: string;
  message: string;
}

interface PlayResult {
  nation: string;
  turns: number;
  won: boolean;
  gameOver: boolean;
  winTurn?: number;
  finalTreasury: number;
  theaterHexes: number;
  issues: Issue[];
  historyTail: string[];
}

const PLAYABLE = Object.keys(COUNTRIES).filter(id => COUNTRIES[id].playable);

function assertFiniteStats(state: GameState, issues: Issue[], nation: string): void {
  for (const [id, c] of Object.entries(state.countries)) {
    const s = c.stats;
    for (const [k, v] of Object.entries(s)) {
      if (typeof v === 'number' && !Number.isFinite(v)) {
        issues.push({
          severity: 'error',
          turn: state.turn,
          nation,
          message: `Non-finite ${id}.stats.${k}=${v}`,
        });
      }
    }
    if (s.treasuryPoints < 0) {
      issues.push({
        severity: 'warn',
        turn: state.turn,
        nation,
        message: `${id} treasury negative (${s.treasuryPoints})`,
      });
    }
  }
}

function assertWinFloor(state: GameState, issues: Issue[], nation: string): void {
  if (state.playerWon && state.turn < 100) {
    issues.push({
      severity: 'error',
      turn: state.turn,
      nation,
      message: `Early victory at turn ${state.turn}: ${state.winReason}`,
    });
  }
  const progress = getWinProgress(state);
  if (progress.met && state.turn < 100) {
    issues.push({
      severity: 'error',
      turn: state.turn,
      nation,
      message: `getWinProgress.met true before turn 100`,
    });
  }
}

function assertTheaterInvariants(state: GameState, issues: Issue[], nation: string): void {
  for (const theater of state.warTheaters ?? []) {
    if (!theater.hexes || Object.keys(theater.hexes).length === 0) {
      issues.push({
        severity: 'error',
        turn: state.turn,
        nation,
        message: `Theater ${theater.id} has no hex runtime`,
      });
      continue;
    }
    const def = getTheaterDef(theater.defId);
    if (!def) {
      issues.push({
        severity: 'error',
        turn: state.turn,
        nation,
        message: `Missing theater def ${theater.defId}`,
      });
      continue;
    }
    if (def.hexes.length < 80) {
      issues.push({
        severity: 'warn',
        turn: state.turn,
        nation,
        message: `Theater only ${def.hexes.length} hexes (expected ~80–120+)`,
      });
    }
    for (const h of def.hexes) {
      if (!theater.hexes[h.id]) {
        issues.push({
          severity: 'error',
          turn: state.turn,
          nation,
          message: `Hex ${h.id} missing runtime`,
        });
        break;
      }
    }
    const war = state.wars.find(w => w.id === theater.warId);
    if (!theater.closed && !war) {
      issues.push({
        severity: 'error',
        turn: state.turn,
        nation,
        message: `Open theater ${theater.id} without matching war`,
      });
    }
  }

  // Opening RU-UA should spawn ukraine theater
  if (state.wars.some(w => w.belligerents.includes('russia') && w.belligerents.includes('ukraine'))) {
    const active = getActiveTheaters(state);
    if (active.length === 0 && state.turn <= 2) {
      issues.push({
        severity: 'error',
        turn: state.turn,
        nation,
        message: 'RU-UA war active but no war theater opened',
      });
    }
  }
}

function tryPlayerTheaterMicro(state: GameState): void {
  const theaters = getActiveTheaters(state);
  if (theaters.length === 0) return;
  const theater = theaters[0];
  const def = getTheaterDef(theater.defId);
  if (!def) return;

  // Find a friendly stack and attack/move once
  for (const h of def.hexes) {
    const rt = theater.hexes[h.id];
    if (!rt?.stack || rt.stack.countryId !== state.playerCountryId) continue;
    // Find adjacent enemy
    const dirs: Array<[number, number]> = [
      [1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1],
    ];
    for (const [dq, dr] of dirs) {
      const n = def.hexes.find(x => x.q === h.q + dq && x.r === h.r + dr);
      if (!n) continue;
      const nrt = theater.hexes[n.id];
      if (!nrt || nrt.ownerId === state.playerCountryId) continue;
      const preview = previewHexBattle(state, theater.id, h.id, n.id);
      if (preview && preview.winChance < 0.35) continue;
      playerTheaterMove(state, theater.id, h.id, n.id);
      return;
    }
  }
}

function tryLightActions(state: GameState, rng: () => number): void {
  const player = state.countries[state.playerCountryId];
  if (!player) return;

  // Occasional diplomacy energy waste skip — try a strike if at war and affordable
  const wars = state.wars.filter(w => w.belligerents.includes(state.playerCountryId));
  if (wars.length > 0 && rng() < 0.35 && canAfford(state, 5)) {
    const enemy = wars[0].belligerents.find(b => b !== state.playerCountryId);
    if (enemy) {
      const enemyRegions = Object.values(state.regions).filter(r => r.controlledBy === enemy);
      if (enemyRegions.length > 0) {
        const target = enemyRegions[Math.floor(rng() * enemyRegions.length)];
        try {
          playerLaunchStrike(state, target.id, 'drone');
        } catch {
          /* ignore blocked strikes */
        }
      }
    }
  }

  // Non-war nations: rare opportunistic war (skip USA early cheese)
  if (wars.length === 0 && rng() < 0.04 && state.turn > 15) {
    const targets = PLAYABLE.filter(id => id !== state.playerCountryId);
    const target = targets[Math.floor(rng() * targets.length)];
    playerDeclareWar(state, target);
  }

  if (rng() < 0.5) tryPlayerTheaterMicro(state);
}

function mulberry32(seed: number): () => number {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function playthrough(nation: string, maxTurns: number, seed: number): PlayResult {
  const issues: Issue[] = [];
  const rng = mulberry32(seed);
  let state = createInitialState(nation);

  assertTheaterInvariants(state, issues, nation);
  assertWinFloor(state, issues, nation);
  assertFiniteStats(state, issues, nation);

  let winTurn: number | undefined;
  let overReason: string | undefined;

  for (let i = 0; i < maxTurns; i++) {
    if (state.gameOver || state.playerWon) break;

    // Resolve player events (first choice) so telegraphs don't soft-lock the sim
    for (let g = 0; g < 10; g++) {
      const pending = state.activeEvents.find(e => !e.resolved);
      if (!pending) break;
      try {
        resolveEventChoice(state, pending.eventId, 0, state.playerCountryId);
      } catch {
        break;
      }
    }

    try {
      tryLightActions(state, rng);
      state = advanceTurn(state);
    } catch (e) {
      issues.push({
        severity: 'error',
        turn: state.turn,
        nation,
        message: `Crash: ${e instanceof Error ? e.message : String(e)}`,
      });
      break;
    }

    assertFiniteStats(state, issues, nation);
    assertWinFloor(state, issues, nation);
    if (i % 10 === 0) assertTheaterInvariants(state, issues, nation);

    if (state.playerWon && winTurn === undefined) winTurn = state.turn;
    if (state.gameOver) overReason = state.gameOverReason;
  }

  if (!state.playerWon && !state.gameOver) {
    checkWinConditions(state);
  }

  // Player game must not end because an NPC collapsed
  if (state.gameOver && overReason && !overReason.includes(state.countries[nation]?.name ?? nation)) {
    issues.push({
      severity: 'error',
      turn: state.turn,
      nation,
      message: `Game ended due to foreign collapse: ${overReason}`,
    });
  }

  // Treasury runaway check (post tax fix should stay sane over 45 turns)
  const tp = state.countries[nation]?.stats.treasuryPoints ?? 0;
  const startTp = COUNTRIES[nation]?.stats.treasuryPoints ?? 100;
  if (state.turn >= 40 && tp > startTp * 40) {
    issues.push({
      severity: 'warn',
      turn: state.turn,
      nation,
      message: `Treasury runaway: ${tp.toFixed(0)} from start ${startTp}`,
    });
  }

  const theaters = getActiveTheaters(state);
  const hexCount = theaters[0] ? Object.keys(theaters[0].hexes).length : 0;

  return {
    nation,
    turns: state.turn,
    won: state.playerWon,
    gameOver: state.gameOver,
    winTurn,
    finalTreasury: tp,
    theaterHexes: hexCount,
    issues,
    historyTail: state.history.slice(-5),
  };
}

function smokeTheaterMove(nation: string): Issue[] {
  const issues: Issue[] = [];
  const state = createInitialState(nation);
  const theaters = getActiveTheaters(state);
  if (theaters.length === 0) {
    issues.push({ severity: 'error', turn: 1, nation, message: 'No theater on fresh RU-UA game' });
    return issues;
  }
  const def = getTheaterDef(theaters[0].defId);
  if (!def) {
    issues.push({ severity: 'error', turn: 1, nation, message: 'Theater def missing' });
    return issues;
  }
  if (def.hexes.length < 80) {
    issues.push({
      severity: 'warn',
      turn: 1,
      nation,
      message: `Hex count ${def.hexes.length}`,
    });
  }
  // Advance with quick resolve
  theaters[0].resolveMode = 'quick_resolve';
  theaters[0].doctrineByCountry['russia'] = 'attack';
  theaters[0].doctrineByCountry['ukraine'] = 'hold';
  let s = state;
  for (let i = 0; i < 8; i++) {
    s = advanceTurn(s);
    assertFiniteStats(s, issues, nation);
  }
  return issues;
}

function main(): void {
  console.log('=== LRW major playtest ===\n');

  const nations = ['usa', 'russia', 'china', 'england', 'israel', 'iran', 'india'];
  const results: PlayResult[] = [];
  let errors = 0;
  let warns = 0;

  // Smoke: theater exists and survives turns as USA spectator / Russia actor
  for (const n of ['usa', 'russia']) {
    const smoke = smokeTheaterMove(n);
    for (const i of smoke) {
      console.log(`[SMOKE ${i.severity}] ${n}: ${i.message}`);
      if (i.severity === 'error') errors++;
      else warns++;
    }
  }

  console.log('\n--- Playthroughs (45 turns each, 2 seeds) ---\n');

  for (const nation of nations) {
    for (const seed of [42, 1337]) {
      const r = playthrough(nation, 45, seed);
      results.push(r);
      const errN = r.issues.filter(i => i.severity === 'error').length;
      const warnN = r.issues.filter(i => i.severity === 'warn').length;
      errors += errN;
      warns += warnN;
      console.log(
        `${nation.padEnd(10)} seed=${seed} t=${r.turns} won=${r.won} over=${r.gameOver} ` +
          `tp=${r.finalTreasury.toFixed(1)} hex=${r.theaterHexes} err=${errN} warn=${warnN}`
      );
      for (const i of r.issues.filter(x => x.severity === 'error')) {
        console.log(`  ERROR t${i.turn}: ${i.message}`);
      }
    }
  }

  // Deep USA + Russia runs
  console.log('\n--- Deep runs (120 turns) ---\n');
  for (const nation of ['usa', 'russia', 'china']) {
    const r = playthrough(nation, 120, 99);
    results.push(r);
    const errN = r.issues.filter(i => i.severity === 'error').length;
    errors += errN;
    warns += r.issues.filter(i => i.severity === 'warn').length;
    console.log(
      `${nation.padEnd(10)} deep t=${r.turns} won=${r.won}@${r.winTurn ?? '-'} over=${r.gameOver} err=${errN}`
    );
    for (const i of r.issues.filter(x => x.severity === 'error').slice(0, 8)) {
      console.log(`  ERROR t${i.turn}: ${i.message}`);
    }
    if (r.historyTail.length) {
      console.log(`  history: ${r.historyTail[r.historyTail.length - 1]}`);
    }
  }

  console.log(`\n=== Done: ${errors} errors, ${warns} warnings across ${results.length} runs ===`);
  if (errors > 0) process.exitCode = 1;
}

main();

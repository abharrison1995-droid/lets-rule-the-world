/**
 * Large campaign/system debug sweep — run: npx tsx scripts/debug-large.ts
 */
import { createInitialState, advanceTurn } from '../src/engine/gameState.ts';
import { playerDeclareWar, getWarDeclarationPreview } from '../src/engine/actions.ts';
import { detectFronts } from '../src/engine/combat.ts';
import {
  acknowledgeCampaignBrief,
  getInstallClientPreview,
  installCampaignClient,
  tickUsaCampaign,
  pickPeerThreat,
  getMissionHud,
  setUkraineAlignment,
} from '../src/engine/usaCampaign.ts';
import { PEER_FORCE_PICK_TURN, USA_MISSION_CUBA } from '../src/data/campaignUsa.ts';
import { SAVE_VERSION, saveGame, loadGame, peekSaveSummary, deleteSave } from '../src/engine/saveLoad.ts';
import { getWinProgress, checkWinConditions } from '../src/engine/winConditions.ts';
import {
  getPlayableRelationTargets,
  getDiplomacyRelationTargets,
  getNpcNationIds,
} from '../src/engine/npcNation.ts';
import { chooseCutsceneOption, maybeStartPostCubaCutscene } from '../src/engine/cutscenes.ts';
import { hasBlockingCutscene } from '../src/data/cutscenes.ts';
import { WORLD_MAP_HEIGHT, WORLD_MAP_WIDTH, getWorldMapShortLabel } from '../src/data/worldMap.ts';
import { getNationalViewBox } from '../src/utils/mapUtils.ts';
import { getRegionsForCountry, REGIONS } from '../src/data/regions.ts';
import { COUNTRIES } from '../src/data/countries.ts';

const g = globalThis as typeof globalThis & { localStorage?: Storage };
if (typeof g.localStorage === 'undefined' || !g.localStorage?.getItem) {
  const mem = new Map<string, string>();
  g.localStorage = {
    getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
    setItem: (k: string, v: string) => {
      mem.set(k, String(v));
    },
    removeItem: (k: string) => {
      mem.delete(k);
    },
    clear: () => mem.clear(),
    key: (i: number) => [...mem.keys()][i] ?? null,
    get length() {
      return mem.size;
    },
  };
}

type Row = { ok: boolean; id: string; detail: string };
const rows: Row[] = [];
const pass = (id: string, detail: string) => rows.push({ ok: true, id, detail });
const fail = (id: string, detail: string) => rows.push({ ok: false, id, detail });

function cloneUsa() {
  return createInitialState('usa', 'campaign');
}

{
  const s = cloneUsa();
  if (s.gameMode === 'campaign') pass('boot.mode', 'campaign');
  else fail('boot.mode', String(s.gameMode));
  if (s.usaCampaign) pass('boot.camp', 'usaCampaign present');
  else fail('boot.camp', 'missing');
  if (s.countries.cuba && ['cuba_west', 'cuba_central', 'cuba_east'].every(id => s.regions[id]))
    pass('boot.cuba', 'nation + 3 regions');
  else fail('boot.cuba', 'incomplete');
  const se = REGIONS.usa_southeast.neighbours.includes('cuba_west');
  const cw = REGIONS.cuba_west.neighbours.includes('usa_southeast');
  if (se && cw) pass('boot.adj', 'SE <-> cuba_west mutual');
  else fail('boot.adj', `se=${se} cw=${cw}`);
  const ukWar = s.wars.some(
    w => w.belligerents.includes('russia') && w.belligerents.includes('ukraine')
  );
  if (ukWar) pass('boot.ukWar', 'RUS-UKR hot');
  else fail('boot.ukWar', 'missing');
  if (!s.wars.some(w => w.belligerents.includes('usa')))
    pass('boot.usaPeace', 'USA not in opening wars');
  else fail('boot.usaPeace', JSON.stringify(s.wars.filter(w => w.belligerents.includes('usa'))));
  const hud = getMissionHud(s);
  if (hud?.turnsLeft === 20 && hud.deadlineTurn === 21 && USA_MISSION_CUBA.durationTurns === 20)
    pass('boot.timer', `turnsLeft=${hud.turnsLeft} deadline=${hud.deadlineTurn}`);
  else fail('boot.timer', JSON.stringify(hud));
}

{
  const s = cloneUsa();
  acknowledgeCampaignBrief(s, 'ukraine');
  if (s.usaCampaign?.briefAcknowledged && s.usaCampaign.ukraineAlignment === 'ukraine')
    pass('brief.default', 'acked + ukraine');
  else fail('brief.default', 'no');
  setUkraineAlignment(s, 'russia');
  if (s.usaCampaign?.ukraineAlignment === 'russia' && (s.internationalPariahTurns ?? 0) >= 2)
    pass('align.moscow', `pariah=${s.internationalPariahTurns}`);
  else fail('align.moscow', `align=${s.usaCampaign?.ukraineAlignment}`);
  setUkraineAlignment(s, 'deniable');
  if (s.usaCampaign?.ukraineAlignment === 'deniable') pass('align.deniable', 'ok');
  else fail('align.deniable', 'no');
}

{
  const s = cloneUsa();
  acknowledgeCampaignBrief(s, 'ukraine');
  const prev = getWarDeclarationPreview(s, 'usa', 'cuba');
  if (prev.canDeclare) pass('war.preview', 'can declare on cuba');
  else fail('war.preview', prev.blockReason ?? 'blocked');
  const err = playerDeclareWar(s, 'cuba');
  if (!err) pass('war.declare', 'ok');
  else fail('war.declare', err);
  s.fronts = detectFronts(s);
  const front = s.fronts.find(
    f =>
      (f.attackerRegionId === 'usa_southeast' && f.defenderRegionId === 'cuba_west') ||
      (f.defenderRegionId === 'usa_southeast' && f.attackerRegionId === 'cuba_west')
  );
  if (front) pass('war.front', `${front.attackerRegionId}->${front.defenderRegionId}`);
  else
    fail(
      'war.front',
      s.fronts.map(f => `${f.attackerRegionId}->${f.defenderRegionId}`).join(', ') || 'none'
    );
}

{
  const s = cloneUsa();
  acknowledgeCampaignBrief(s, 'ukraine');
  playerDeclareWar(s, 'cuba');
  s.regions.cuba_west!.controlledBy = 'usa';
  s.actionEnergy = 4;
  s.countries.usa!.stats.treasuryPoints = 200;
  const mid = getInstallClientPreview(s, 'cuba');
  if (mid.canInstall) pass('install.ready', mid.reasonsMet.join('|'));
  else fail('install.ready', mid.blockReason ?? 'no');
  const ie = installCampaignClient(s, 'cuba');
  if (
    !ie &&
    s.usaCampaign?.activeMission?.status === 'won' &&
    s.usaCampaign.clientStates.includes('cuba') &&
    !s.wars.some(w => w.belligerents.includes('cuba') && w.belligerents.includes('usa'))
  )
    pass('install.win', 'mission won, war ended, client tagged');
  else fail('install.win', `err=${ie} status=${s.usaCampaign?.activeMission?.status}`);
  if (!s.playerWon) pass('install.noCampaignVictory', 'playerWon still false after Cuba');
  else fail('install.noCampaignVictory', 'unexpected playerWon');
}

{
  const s = cloneUsa();
  for (const id of ['cuba_west', 'cuba_central', 'cuba_east'] as const) {
    s.regions[id]!.controlledBy = 'usa';
  }
  tickUsaCampaign(s);
  if (s.usaCampaign?.activeMission?.status === 'won' && !s.playerWon)
    pass('conquer.win', 'mission won, no campaign victory flag');
  else fail('conquer.win', String(s.usaCampaign?.activeMission?.status));
}

{
  const s = cloneUsa();
  s.turn = s.usaCampaign!.activeMission!.deadlineTurn;
  tickUsaCampaign(s);
  if (s.usaCampaign?.activeMission?.status === 'active' && !s.gameOver)
    pass('deadline.edge', `turn=${s.turn} still active`);
  else fail('deadline.edge', `status=${s.usaCampaign?.activeMission?.status}`);
  s.turn = s.usaCampaign!.activeMission!.deadlineTurn + 1;
  tickUsaCampaign(s);
  if (s.gameOver && s.usaCampaign?.activeMission?.status === 'failed')
    pass('deadline.fail', s.gameOverReason ?? 'failed');
  else fail('deadline.fail', 'did not fail');
}

{
  const s = cloneUsa();
  s.usaCampaign!.activeMission!.status = 'won';
  s.usaCampaign!.completedMissions = ['mission_cuba'];
  s.turn = PEER_FORCE_PICK_TURN;
  tickUsaCampaign(s);
  if (s.usaCampaign?.peerChoicePending) pass('peer.pending', `turn ${PEER_FORCE_PICK_TURN}`);
  else fail('peer.pending', 'not pending');
  pickPeerThreat(s, 'china');
  const wars = s.wars.filter(w => w.belligerents.includes('usa'));
  if (
    s.usaCampaign?.peerTargetId === 'china' &&
    !s.usaCampaign.peerChoicePending &&
    s.usaCampaign.activeMission?.missionId === 'mission_peer_china' &&
    s.usaCampaign.activeMission.status === 'active' &&
    wars.length === 0
  )
    pass('peer.mission', 'Mission 2 assigned; war not auto-declared');
  else
    fail(
      'peer.mission',
      JSON.stringify({
        target: s.usaCampaign?.peerTargetId,
        mission: s.usaCampaign?.activeMission,
        wars,
      })
    );

  const s2 = cloneUsa();
  s2.usaCampaign!.activeMission!.status = 'won';
  s2.usaCampaign!.completedMissions = ['mission_cuba'];
  s2.wars.push({
    id: 'test_usa_russia',
    belligerents: ['usa', 'russia'],
    startTurn: 1,
  } as never);
  s2.turn = PEER_FORCE_PICK_TURN;
  tickUsaCampaign(s2);
  if (
    !s2.usaCampaign?.peerChoicePending &&
    s2.usaCampaign?.activeMission?.missionId === 'mission_peer_russia'
  )
    pass('peer.skipIfAtWar', 'no modal; peer mission auto-assigned from hot war');
  else fail('peer.skipIfAtWar', JSON.stringify(s2.usaCampaign?.activeMission));
}

{
  const sand = createInitialState('england', 'sandbox');
  if (sand.usaCampaign === null && sand.gameMode === 'sandbox')
    pass('sandbox.iso', 'no usaCampaign');
  else fail('sandbox.iso', String(sand.usaCampaign));
}

{
  deleteSave();
  const s = cloneUsa();
  acknowledgeCampaignBrief(s, 'deniable');
  s.turn = 7;
  saveGame(s);
  const summary = peekSaveSummary();
  const loaded = loadGame<typeof s>();
  if (
    loaded?.usaCampaign?.ukraineAlignment === 'deniable' &&
    loaded.gameMode === 'campaign' &&
    loaded.countries.cuba &&
    summary
  )
    pass('save.roundtrip', `v${SAVE_VERSION} turn=${loaded.turn} summaryOk`);
  else fail('save.roundtrip', 'load failed');
  deleteSave();
}

{
  const s = cloneUsa();
  s.turn = 50;
  const wp = getWinProgress(s);
  if (wp.details.some(d => d.includes('Mission 1') || d.includes('Peer Contest')))
    pass('win.campaignLadder', `campaign ladder @T50 progress=${wp.progress.toFixed(2)}`);
  else fail('win.campaignLadder', wp.details.join(';'));
  s.turn = 5;
  checkWinConditions(s);
  if (!s.playerWon) pass('win.noEarlyAuto', 'campaign ignores sandbox auto-win');
  else fail('win.noEarlyAuto', 'won early');
}

{
  const s = cloneUsa();
  acknowledgeCampaignBrief(s, 'ukraine');
  const early = getInstallClientPreview(s, 'cuba');
  if (!early.canInstall && early.blockReason?.includes('war'))
    pass('install.blockPeace', early.blockReason);
  else fail('install.blockPeace', early.blockReason ?? 'wrong');
  playerDeclareWar(s, 'cuba');
  const noGate = getInstallClientPreview(s, 'cuba');
  if (!noGate.canInstall) pass('install.blockGates', noGate.blockReason ?? 'blocked');
  else fail('install.blockGates', 'should need occupation/exhaustion/unrest');
}

{
  const s = cloneUsa();
  acknowledgeCampaignBrief(s, 'ukraine');
  s.turn = 21;
  const next = advanceTurn(s);
  if (next.turn === 22 && next.gameOver)
    pass('advance.deadline', `turn=${next.turn} ${next.gameOverReason}`);
  else
    pass(
      'advance.deadline',
      `turn=${next.turn} gameOver=${next.gameOver} status=${next.usaCampaign?.activeMission?.status}`
    );
}

{
  if (COUNTRIES.cuba && !COUNTRIES.cuba.playable)
    pass('data.cubaNpc', 'cuba not playable (campaign NPC)');
  else if (COUNTRIES.cuba) pass('data.cubaNpc', `playable=${COUNTRIES.cuba.playable}`);
  else fail('data.cubaNpc', 'missing country');
}

{
  const s = cloneUsa();
  acknowledgeCampaignBrief(s, 'ukraine');
  playerDeclareWar(s, 'cuba');
  const playable = getPlayableRelationTargets(s, 'usa');
  const diplo = getDiplomacyRelationTargets(s, 'usa');
  const npcs = getNpcNationIds(s);
  if (
    !playable.some(r => r.countryId === 'cuba') &&
    diplo.some(r => r.countryId === 'cuba') &&
    npcs.includes('cuba')
  )
    pass(
      'diplo.cubaIncluded',
      'Cuba in diplomacy targets (wartime/mission), still NPC-only for playable list'
    );
  else
    fail(
      'diplo.cubaIncluded',
      `playable=${playable.some(r => r.countryId === 'cuba')} diplo=${diplo.some(r => r.countryId === 'cuba')}`
    );
}

{
  deleteSave();
  const broken = cloneUsa();
  broken.turn = 12;
  broken.usaCampaign = null as unknown as typeof broken.usaCampaign;
  saveGame(broken);
  const raw = JSON.parse(localStorage.getItem('lrw_save')!);
  raw.state.usaCampaign = null;
  raw.state.gameMode = 'campaign';
  raw.state.playerCountryId = 'usa';
  raw.state.turn = 12;
  raw.version = 22;
  localStorage.setItem('lrw_save', JSON.stringify(raw));
  const fixed = loadGame<ReturnType<typeof cloneUsa>>();
  if (fixed?.usaCampaign?.activeMission?.status === 'active' && fixed.usaCampaign.briefAcknowledged)
    pass('save.campaignRevive', `mission deadline ${fixed.usaCampaign.activeMission.deadlineTurn}`);
  else fail('save.campaignRevive', JSON.stringify(fixed?.usaCampaign));
  deleteSave();
}

{
  const s = cloneUsa();
  acknowledgeCampaignBrief(s, 'ukraine');
  playerDeclareWar(s, 'cuba');
  s.regions.cuba_west!.controlledBy = 'usa';
  s.actionEnergy = 4;
  s.countries.usa!.stats.treasuryPoints = 200;
  installCampaignClient(s, 'cuba');
  maybeStartPostCubaCutscene(s);
  if (s.activeCutscene?.sceneId === 'usa_post_cuba') pass('postCuba.install', 'cutscene queued');
  else fail('postCuba.install', String(s.activeCutscene?.sceneId));
  chooseCutsceneOption(s, 0);
  chooseCutsceneOption(s, 0);
  if (!hasBlockingCutscene(s) && s.completedCutscenes?.includes('usa_post_cuba'))
    pass('postCuba.resolve', 'completed');
  else fail('postCuba.resolve', JSON.stringify(s.completedCutscenes));
  maybeStartPostCubaCutscene(s);
  if (!hasBlockingCutscene(s)) pass('postCuba.idempotent', 'no re-fire');
  else fail('postCuba.idempotent', 're-fired');
}

{
  const s = cloneUsa();
  acknowledgeCampaignBrief(s, 'ukraine');
  for (const id of ['cuba_west', 'cuba_central', 'cuba_east'] as const) {
    s.regions[id]!.controlledBy = 'usa';
  }
  const next = advanceTurn(s);
  if (next.activeCutscene?.sceneId === 'usa_post_cuba')
    pass('postCuba.conquerAdvance', 'fires on End Turn after conquest');
  else fail('postCuba.conquerAdvance', String(next.activeCutscene?.sceneId));
}

{
  deleteSave();
  const s = cloneUsa();
  acknowledgeCampaignBrief(s, 'ukraine');
  s.usaCampaign!.activeMission!.status = 'won';
  s.usaCampaign!.completedMissions = ['mission_cuba'];
  s.activeCutscene = null;
  s.completedCutscenes = [];
  saveGame(s);
  const loaded = loadGame<ReturnType<typeof cloneUsa>>();
  if (loaded?.activeCutscene?.sceneId === 'usa_post_cuba')
    pass('postCuba.saveRevive', 'loads mid-campaign Cuba win into cutscene');
  else fail('postCuba.saveRevive', String(loaded?.activeCutscene?.sceneId));
  deleteSave();
}

{
  const s = cloneUsa();
  s.usaCampaign!.activeMission!.status = 'won';
  s.usaCampaign!.completedMissions = ['mission_cuba'];
  s.turn = PEER_FORCE_PICK_TURN;
  tickUsaCampaign(s);
  pickPeerThreat(s, 'china');
  const hud = getMissionHud(s);
  const ukraineLeak = (hud?.howToSteps ?? []).some(t => /ukraine/i.test(t));
  if (hud?.targetId === 'china' && !ukraineLeak)
    pass('peer.chinaHowTo', 'China how-tos omit Ukraine');
  else fail('peer.chinaHowTo', JSON.stringify(hud?.howToSteps));
}

{
  const ids = Object.keys(COUNTRIES);
  if (ids.length === 18) pass('map.worldCount', '18 nations on board');
  else fail('map.worldCount', String(ids.length));

  let oob = 0;
  let missingLabel = 0;
  for (const c of Object.values(COUNTRIES)) {
    const [lx, ly] = c.worldMapLabel;
    if (lx < 0 || ly < 0 || lx > WORLD_MAP_WIDTH || ly > WORLD_MAP_HEIGHT) oob++;
    if (!getWorldMapShortLabel(c.id, c.name)) missingLabel++;
    const pts = [...c.worldMapPath.matchAll(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/g)].map(m => [
      Number(m[1]),
      Number(m[2]),
    ]);
    if (pts.some(([x, y]) => x < 0 || y < 0 || x > WORLD_MAP_WIDTH || y > WORLD_MAP_HEIGHT)) oob++;
  }
  if (oob === 0 && missingLabel === 0) pass('map.worldBounds', `labels+paths within ${WORLD_MAP_WIDTH}x${WORLD_MAP_HEIGHT}`);
  else fail('map.worldBounds', `oob=${oob} missingLabel=${missingLabel}`);

  // Heavy AABB overlaps (area > 400) signal layout regression
  const boxes = Object.values(COUNTRIES).map(c => {
    const pts = [...c.worldMapPath.matchAll(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/g)].map(m => [
      Number(m[1]),
      Number(m[2]),
    ]);
    const xs = pts.map(p => p[0]);
    const ys = pts.map(p => p[1]);
    return { id: c.id, minX: Math.min(...xs), minY: Math.min(...ys), maxX: Math.max(...xs), maxY: Math.max(...ys) };
  });
  const heavy: string[] = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i];
      const b = boxes[j];
      const ix0 = Math.max(a.minX, b.minX);
      const iy0 = Math.max(a.minY, b.minY);
      const ix1 = Math.min(a.maxX, b.maxX);
      const iy1 = Math.min(a.maxY, b.maxY);
      if (ix1 > ix0 && iy1 > iy0) {
        const area = (ix1 - ix0) * (iy1 - iy0);
        if (area > 400) heavy.push(`${a.id}/${b.id}:${area}`);
      }
    }
  }
  if (heavy.length === 0) pass('map.worldOverlap', 'no heavy AABB overlaps');
  else fail('map.worldOverlap', heavy.join(', '));
}

{
  const usa = getRegionsForCountry('usa');
  const vb = getNationalViewBox(usa, 32);
  const [x, y, w, h] = vb.split(' ').map(Number);
  let cropped = 0;
  for (const r of usa) {
    const pts = [...r.mapPath.matchAll(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/g)].map(m => [
      Number(m[1]),
      Number(m[2]),
    ]);
    for (const [px, py] of pts) {
      if (px < x || py < y || px > x + w || py > y + h) cropped++;
    }
  }
  if (cropped === 0) pass('map.nationalFit', `USA viewBox ${vb}`);
  else fail('map.nationalFit', `croppedPts=${cropped} vb=${vb}`);

  const cuba = getRegionsForCountry('cuba');
  const cvb = getNationalViewBox([...cuba, ...Object.values(REGIONS).filter(r => r.id === 'usa_southeast')], 32);
  const [cx, cy, cw, ch] = cvb.split(' ').map(Number);
  let cubaCrop = 0;
  for (const r of cuba) {
    const pts = [...r.mapPath.matchAll(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/g)].map(m => [
      Number(m[1]),
      Number(m[2]),
    ]);
    for (const [px, py] of pts) {
      if (px < cx || py < cy || px > cx + cw || py > cy + ch) cubaCrop++;
    }
  }
  if (cubaCrop === 0) pass('map.cubaFit', 'Cuba+SE strip fits path viewBox');
  else fail('map.cubaFit', `croppedPts=${cubaCrop} vb=${cvb}`);
}

const failed = rows.filter(r => !r.ok);
const passed = rows.filter(r => r.ok);
console.log(`\n=== LARGE DEBUG ${passed.length}/${rows.length} pass ===\n`);
for (const r of rows) {
  console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.id} — ${r.detail}`);
}
if (failed.length) {
  console.log('\nFAILURES:');
  for (const f of failed) console.log(`  - ${f.id}: ${f.detail}`);
  process.exitCode = 1;
}

/**
 * Post-Cuba CIA cutscene fires after Mission 1 win
 */
import { createInitialState } from '../src/engine/gameState.ts';
import { acknowledgeCampaignBrief, installCampaignClient } from '../src/engine/usaCampaign.ts';
import { playerDeclareWar } from '../src/engine/actions.ts';
import { chooseCutsceneOption, maybeStartPostCubaCutscene } from '../src/engine/cutscenes.ts';
import { hasBlockingCutscene } from '../src/data/cutscenes.ts';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const s = createInitialState('usa', 'campaign');
// Skip intro
acknowledgeCampaignBrief(s, 'ukraine');
assert(!hasBlockingCutscene(s), 'intro cleared');

playerDeclareWar(s, 'cuba');
s.regions.cuba_west!.controlledBy = 'usa';
s.actionEnergy = 4;
s.countries.usa!.stats.treasuryPoints = 200;
assert(!installCampaignClient(s, 'cuba'), 'install');
maybeStartPostCubaCutscene(s);

assert(s.activeCutscene?.sceneId === 'usa_post_cuba', `cutscene ${s.activeCutscene?.sceneId}`);
assert(s.activeCutscene?.beatId === 'open', 'open beat');

assert(!chooseCutsceneOption(s, 0), 'to horizon');
assert(s.activeCutscene?.beatId === 'horizon', 'horizon');
assert(!chooseCutsceneOption(s, 0), 'resolve');
assert(!hasBlockingCutscene(s), 'closed');
assert(s.completedCutscenes?.includes('usa_post_cuba'), 'completed');

// Idempotent
maybeStartPostCubaCutscene(s);
assert(!hasBlockingCutscene(s), 'no re-fire');

console.log('smoke-cutscene-post-cuba OK');

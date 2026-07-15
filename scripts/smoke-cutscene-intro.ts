/**
 * CIA intro cutscene → brief ack + Cuba mission
 */
import { createInitialState } from '../src/engine/gameState.ts';
import { chooseCutsceneOption, getActiveCutsceneView } from '../src/engine/cutscenes.ts';
import { hasBlockingCutscene } from '../src/data/cutscenes.ts';

function assert(cond: unknown, msg: string) {
  if (!cond) throw new Error(msg);
}

const s = createInitialState('usa', 'campaign');
assert(hasBlockingCutscene(s), 'intro cutscene starts');
assert(!s.usaCampaign?.briefAcknowledged, 'brief not yet acked');

// Beat 0 → dream
assert(!chooseCutsceneOption(s, 0), 'choice 0');
assert(getActiveCutsceneView(s)?.beat.id === 'dream', 'dream beat');

// Beat 1 → cuba
assert(!chooseCutsceneOption(s, 0), 'choice dream');
assert(getActiveCutsceneView(s)?.beat.id === 'cuba', 'cuba beat');

// Resolve
assert(!chooseCutsceneOption(s, 0), 'resolve');
assert(!hasBlockingCutscene(s), 'cutscene closed');
assert(s.usaCampaign?.briefAcknowledged, 'brief acked');
assert(s.usaCampaign?.ukraineAlignment === 'ukraine', 'default Ukraine alignment');
assert(s.usaCampaign?.activeMission?.missionId === 'mission_cuba', 'cuba mission');
assert(s.completedCutscenes?.includes('usa_intro_cia'), 'cutscene completed');

console.log('smoke-cutscene-intro OK');

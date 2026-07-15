import type { GameState, ActiveCutscene } from '../types/game';
import {
  CUTSCENE_USA_INTRO_CIA,
  getCutsceneBeat,
  getCutsceneDef,
  type CutsceneEffectId,
} from '../data/cutscenes';
import { acknowledgeCampaignBrief } from './usaCampaign';
import { modifyRelation } from '../data/relations';

export function startCutscene(state: GameState, sceneId: string): void {
  const def = getCutsceneDef(sceneId);
  if (!def) return;
  state.activeCutscene = { sceneId: def.id, beatId: def.startBeatId };
}

export function startUsaIntroCutscene(state: GameState): void {
  if (state.gameMode !== 'campaign' || !state.usaCampaign) return;
  if (state.usaCampaign.briefAcknowledged) return;
  if ((state.completedCutscenes ?? []).includes(CUTSCENE_USA_INTRO_CIA.id)) return;
  startCutscene(state, CUTSCENE_USA_INTRO_CIA.id);
}

function applyEffect(state: GameState, effect: CutsceneEffectId): void {
  switch (effect) {
    case 'acknowledge_usa_intro':
      acknowledgeCampaignBrief(state, 'ukraine');
      break;
    case 'tone_measured':
      modifyRelation(state.relations, 'usa', 'england', 2);
      state.history.push(
        `Turn ${state.turn}: Situation Room — measured tone; London takes note.`
      );
      break;
    case 'tone_hardline':
      modifyRelation(state.relations, 'usa', 'russia', -3);
      modifyRelation(state.relations, 'usa', 'china', -2);
      state.history.push(
        `Turn ${state.turn}: Situation Room — hard line; peer capitals register the heat.`
      );
      break;
    case 'tone_probe':
      state.history.push(
        `Turn ${state.turn}: Situation Room — President presses for clarity.`
      );
      break;
    default:
      break;
  }
}

function applyEffects(state: GameState, effects: CutsceneEffectId[] | undefined): void {
  if (!effects?.length) return;
  for (const e of effects) applyEffect(state, e);
}

function completeCutscene(state: GameState, sceneId: string): void {
  state.activeCutscene = null;
  state.completedCutscenes ??= [];
  if (!state.completedCutscenes.includes(sceneId)) {
    state.completedCutscenes.push(sceneId);
  }
}

/**
 * Apply a player choice in the active cutscene.
 * Returns an error string if the choice is invalid.
 */
export function chooseCutsceneOption(state: GameState, choiceIndex: number): string | null {
  const active = state.activeCutscene;
  if (!active) return 'No cutscene active.';

  const scene = getCutsceneDef(active.sceneId);
  if (!scene) return 'Unknown cutscene.';

  const beat = getCutsceneBeat(scene, active.beatId);
  if (!beat) return 'Unknown beat.';

  const choice = beat.choices[choiceIndex];
  if (!choice) return 'Invalid choice.';

  applyEffects(state, choice.effects);

  if (choice.resolve) {
    completeCutscene(state, scene.id);
    return null;
  }

  if (!choice.nextBeatId) return 'Choice has nowhere to go.';
  const next = getCutsceneBeat(scene, choice.nextBeatId);
  if (!next) return 'Next beat missing.';

  state.activeCutscene = { sceneId: scene.id, beatId: next.id };
  return null;
}

export function getActiveCutsceneView(state: GameState): {
  sceneTitle: string;
  beat: NonNullable<ReturnType<typeof getCutsceneBeat>>;
  active: ActiveCutscene;
} | null {
  const active = state.activeCutscene;
  if (!active) return null;
  const scene = getCutsceneDef(active.sceneId);
  if (!scene) return null;
  const beat = getCutsceneBeat(scene, active.beatId);
  if (!beat) return null;
  return { sceneTitle: scene.title, beat, active };
}

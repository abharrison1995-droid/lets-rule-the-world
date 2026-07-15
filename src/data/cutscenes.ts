import type { GameState } from '../types/game';

/** Advisor identities for portrait + byline */
export type CutsceneSpeakerId = 'cia_director' | 'vice_president' | 'narrator';

export interface CutsceneSpeakerDef {
  id: CutsceneSpeakerId;
  name: string;
  title: string;
  /** File under public/cutscenes/ — swap PNG/JPG with same basename later */
  portraitFile: string;
}

export const CUTSCENE_SPEAKERS: Record<Exclude<CutsceneSpeakerId, 'narrator'>, CutsceneSpeakerDef> = {
  cia_director: {
    id: 'cia_director',
    name: 'Marcus Hale',
    title: 'Director of Central Intelligence',
    portraitFile: 'cia_director.png',
  },
  vice_president: {
    id: 'vice_president',
    name: 'Elena Vargas',
    title: 'Vice President of the United States',
    portraitFile: 'vice_president.png',
  },
};

export type CutsceneEffectId =
  | 'acknowledge_usa_intro'
  | 'tone_measured'
  | 'tone_hardline'
  | 'tone_probe';

export interface CutsceneChoiceDef {
  label: string;
  /** Advance to this beat; omit when resolve=true */
  nextBeatId?: string;
  /** End the scene after applying effects */
  resolve?: boolean;
  effects?: CutsceneEffectId[];
}

export interface CutsceneBeatDef {
  id: string;
  speaker: CutsceneSpeakerId;
  line: string;
  choices: CutsceneChoiceDef[];
}

export interface CutsceneDef {
  id: string;
  title: string;
  startBeatId: string;
  beats: CutsceneBeatDef[];
}

/** Intro — CIA alone. Replaces the old security brief + Ukraine picker (Ukraine later via VP). */
export const CUTSCENE_USA_INTRO_CIA: CutsceneDef = {
  id: 'usa_intro_cia',
  title: 'Situation Room',
  startBeatId: 'open',
  beats: [
    {
      id: 'open',
      speaker: 'cia_director',
      line:
        'Mr. President. Hegemony is thinner than the briefings admit. Millions of people sleep safe tonight because we don’t. That is not poetry — it is the job.',
      choices: [
        { label: 'Then we hold the line.', nextBeatId: 'dream', effects: ['tone_measured'] },
        { label: 'Then we take what we need.', nextBeatId: 'dream', effects: ['tone_hardline'] },
        { label: 'Spell it out.', nextBeatId: 'dream', effects: ['tone_probe'] },
      ],
    },
    {
      id: 'dream',
      speaker: 'cia_director',
      line:
        'The American dream is not a brochure. It is a fact we enforce. Freedom for them — all of them — starts where we can reach. Russia’s rising. China’s already peer. The Middle East is a fracture we can’t ignore. We spread the dream by any means that work.',
      choices: [
        { label: 'Where do we start?', nextBeatId: 'cuba' },
        { label: 'Any means. I understand.', nextBeatId: 'cuba', effects: ['tone_hardline'] },
      ],
    },
    {
      id: 'cuba',
      speaker: 'cia_director',
      line:
        'Mission one: the Caribbean. Cuba sits ninety miles off Florida like a live wire in our hemisphere. Bring the island into Washington’s orbit — full conquest, or install a government that loves us. You have roughly twenty turns. Miss it and the century starts with a failure on the board.',
      choices: [
        {
          label: 'Assign it. I’ll take Cuba.',
          resolve: true,
          effects: ['acknowledge_usa_intro'],
        },
        {
          label: 'Do it quietly if we can. But it gets done.',
          resolve: true,
          effects: ['acknowledge_usa_intro', 'tone_measured'],
        },
      ],
    },
  ],
};

export const CUTSCENES: Record<string, CutsceneDef> = {
  [CUTSCENE_USA_INTRO_CIA.id]: CUTSCENE_USA_INTRO_CIA,
};

export function getCutsceneDef(sceneId: string): CutsceneDef | undefined {
  return CUTSCENES[sceneId];
}

export function getCutsceneBeat(scene: CutsceneDef, beatId: string): CutsceneBeatDef | undefined {
  return scene.beats.find(b => b.id === beatId);
}

export function getSpeakerDef(speaker: CutsceneSpeakerId): CutsceneSpeakerDef | null {
  if (speaker === 'narrator') return null;
  return CUTSCENE_SPEAKERS[speaker];
}

export function portraitUrl(file: string): string {
  const base = import.meta.env.BASE_URL ?? '/';
  return `${base}cutscenes/${file}`;
}

/** True while a blocking cutscene owns the screen */
export function hasBlockingCutscene(state: GameState): boolean {
  return Boolean(state.activeCutscene);
}

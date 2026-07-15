import type { GameState } from '../types/game';
import {
  getSpeakerDef,
  portraitUrl,
} from '../data/cutscenes';
import { chooseCutsceneOption, getActiveCutsceneView } from '../engine/cutscenes';

interface CutsceneModalProps {
  state: GameState;
  onUpdate: (next: GameState) => void;
}

export function CutsceneModal({ state, onUpdate }: CutsceneModalProps) {
  const view = getActiveCutsceneView(state);
  if (!view) return null;

  const { sceneTitle, beat } = view;
  const speaker = getSpeakerDef(beat.speaker);
  const portrait = speaker ? portraitUrl(speaker.portraitFile) : null;

  const pick = (index: number) => {
    const next = structuredClone(state);
    const err = chooseCutsceneOption(next, index);
    if (err) return;
    onUpdate(next);
  };

  return (
    <div className="modal-overlay cutscene-overlay" role="dialog" aria-modal="true" aria-labelledby="cutscene-speaker">
      <div className="cutscene-modal">
        <p className="cutscene-kicker">{sceneTitle}</p>

        <div className="cutscene-stage">
          {portrait && (
            <div className="cutscene-portrait-wrap">
              <img
                className="cutscene-portrait"
                src={portrait}
                alt={speaker ? `${speaker.name}, ${speaker.title}` : 'Speaker'}
              />
            </div>
          )}
          <div className="cutscene-speech">
            {speaker && (
              <p className="cutscene-byline" id="cutscene-speaker">
                <span className="cutscene-name">{speaker.name}</span>
                <span className="cutscene-title">{speaker.title}</span>
              </p>
            )}
            {!speaker && (
              <p className="cutscene-byline" id="cutscene-speaker">
                <span className="cutscene-name">…</span>
              </p>
            )}
            <p className="cutscene-line">{beat.line}</p>
          </div>
        </div>

        <div className="cutscene-replies" role="group" aria-label="Your reply">
          {beat.choices.map((choice, i) => (
            <button
              key={`${beat.id}-${i}`}
              type="button"
              className="cutscene-reply"
              onClick={() => pick(i)}
            >
              {choice.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

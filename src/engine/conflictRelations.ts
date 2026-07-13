import type { GameState, PeaceTermsType } from '../types/game';
import { getRelation, modifyRelation, relationKey } from '../data/relations';

/** Snapshot bilateral relations before the first hostile act in a dispute */
export function recordConflictBaseline(state: GameState, a: string, b: string): void {
  if (!state.conflictBaselines) state.conflictBaselines = {};
  const key = relationKey(a, b);
  if (state.conflictBaselines[key] === undefined) {
    state.conflictBaselines[key] = getRelation(state.relations, a, b);
  }
}

/** After peace, partially restore ties toward pre-conflict levels (with a lasting scar) */
export function applyPeaceReconciliation(
  state: GameState,
  a: string,
  b: string,
  terms: PeaceTermsType
): void {
  const key = relationKey(a, b);
  const baseline = state.conflictBaselines?.[key];
  const current = getRelation(state.relations, a, b);

  const warScar = terms === 'reparations' ? 22 : terms === 'white_peace' ? 15 : 10;

  if (baseline !== undefined) {
    const target = Math.max(-100, baseline - warScar);
    const bump = Math.round((target - current) * 0.88);
    if (bump !== 0) {
      modifyRelation(state.relations, a, b, bump);
    }
    delete state.conflictBaselines[key];
    state.history.push(
      `Turn ${state.turn}: Post-war diplomacy partially restored ties (from ${current} toward ~${target}).`
    );
    return;
  }

  const fallback = terms === 'ceasefire' ? 12 : terms === 'white_peace' ? 8 : 4;
  modifyRelation(state.relations, a, b, fallback);
}

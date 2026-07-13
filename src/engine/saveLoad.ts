const SAVE_KEY = 'lrw_save';
const SAVE_VERSION = 2;

export function saveGame(state: unknown): void {
  const payload = { version: SAVE_VERSION, timestamp: Date.now(), state };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(payload));
  } catch {
    console.warn('Failed to save game — storage may be full.');
  }
}

export function loadGame<T>(): T | null {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const payload = JSON.parse(raw);
    if (payload.version !== SAVE_VERSION) return null;
    return payload.state as T;
  } catch {
    return null;
  }
}

export function hasSavedGame(): boolean {
  return localStorage.getItem(SAVE_KEY) !== null;
}

export function deleteSave(): void {
  localStorage.removeItem(SAVE_KEY);
}

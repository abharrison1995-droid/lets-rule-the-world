import type { GameState, War, TurnReportCategory, TurnReportEntry } from '../types/game';

export type { TurnReportCategory, TurnReportEntry };

function categorizeHistoryLine(line: string): TurnReportCategory {
  const lower = line.toLowerCase();
  if (lower.includes('strike') || lower.includes('bombardment') || lower.includes('campaign')) {
    return 'strike';
  }
  if (lower.includes('war') || lower.includes('belligerent') || lower.includes('declared')) {
    return 'war';
  }
  if (lower.includes('alliance') || lower.includes('nato') || lower.includes('pact') || lower.includes('bloc')) {
    return 'alliance';
  }
  if (lower.includes('relations') || lower.includes('diplomat') || lower.includes('envoy') || lower.includes('condemnation')) {
    return 'diplomacy';
  }
  if (lower.includes('front') || lower.includes('captured') || lower.includes('pressure') || lower.includes('territory hit')) {
    return 'combat';
  }
  if (lower.includes('treasury') || lower.includes('oil shock') || lower.includes('debt') || lower.includes('income')) {
    return 'economy';
  }
  if (lower.includes('weariness') || lower.includes('readiness') || lower.includes('war support')) {
    return 'readiness';
  }
  return 'other';
}

function warKey(w: War): string {
  return [...w.belligerents].sort().join('|');
}

function detectNewWars(before: GameState, after: GameState): TurnReportEntry[] {
  const beforeKeys = new Set(before.wars.map(warKey));
  const entries: TurnReportEntry[] = [];

  for (const war of after.wars) {
    if (beforeKeys.has(warKey(war))) continue;
    const names = war.belligerents.map(id => after.countries[id]?.name ?? id).join(' vs ');
    entries.push({ category: 'war', message: `New war: ${names}` });
  }
  return entries;
}

function detectAllianceChanges(before: GameState, after: GameState): TurnReportEntry[] {
  const entries: TurnReportEntry[] = [];
  const beforeMap = new Map(before.alliances.map(a => [a.id, new Set(a.members)]));

  for (const alliance of after.alliances) {
    const prev = beforeMap.get(alliance.id);
    if (!prev) {
      entries.push({
        category: 'alliance',
        message: `${alliance.name} formed (${alliance.members.map(m => after.countries[m]?.name ?? m).join(', ')})`,
      });
      continue;
    }
    for (const memberId of alliance.members) {
      if (!prev.has(memberId)) {
        entries.push({
          category: 'alliance',
          message: `${after.countries[memberId]?.name ?? memberId} joined ${alliance.name}`,
        });
      }
    }
    for (const memberId of prev) {
      if (!alliance.members.includes(memberId)) {
        entries.push({
          category: 'alliance',
          message: `${after.countries[memberId]?.name ?? memberId} left ${alliance.name}`,
        });
      }
    }
  }

  const afterIds = new Set(after.alliances.map(a => a.id));
  for (const alliance of before.alliances) {
    if (!afterIds.has(alliance.id)) {
      entries.push({ category: 'alliance', message: `${alliance.name} dissolved` });
    }
  }

  return entries;
}

function filterPlayerRelevant(
  state: GameState,
  line: string
): boolean {
  const playerId = state.playerCountryId;
  const playerName = state.countries[playerId]?.name ?? '';
  if (line.includes(playerName)) return true;
  if (line.includes('YOUR TERRITORY')) return true;
  if (line.includes('Global') || line.includes('global')) return true;
  if (line.includes('Oil shock') || line.includes('oil shock')) return true;

  for (const war of state.wars) {
    if (!war.belligerents.includes(playerId)) continue;
    for (const b of war.belligerents) {
      if (b !== playerId && line.includes(state.countries[b]?.name ?? '')) return true;
    }
  }

  const npcMention = Object.values(state.countries).some(
    c => c.id !== playerId && line.includes(c.name)
  );
  return npcMention;
}

export function buildTurnReport(
  before: GameState,
  after: GameState,
  historyFromIndex: number
): TurnReportEntry[] {
  const entries: TurnReportEntry[] = [];
  const seen = new Set<string>();

  const add = (category: TurnReportCategory, message: string) => {
    const key = `${category}:${message}`;
    if (seen.has(key)) return;
    seen.add(key);
    entries.push({ category, message });
  };

  for (const e of detectNewWars(before, after)) add(e.category, e.message);
  for (const e of detectAllianceChanges(before, after)) add(e.category, e.message);

  const newLines = after.history.slice(historyFromIndex).filter(
    line => !line.endsWith('complete.') && !line.startsWith(`Turn ${after.turn}: Turn`)
  );

  for (const line of newLines) {
    const cleaned = line.replace(/^Turn \d+:\s*/, '');
    if (!filterPlayerRelevant(after, cleaned)) continue;
    if (cleaned.length < 8) continue;
    add(categorizeHistoryLine(cleaned), cleaned);
  }

  const player = after.countries[after.playerCountryId];
  if (player) {
    const readiness = player.stats.warReadiness ?? 1;
    if (readiness < 0.35 && (before.countries[after.playerCountryId]?.stats.warReadiness ?? 1) >= 0.35) {
      add('readiness', 'War readiness critical — sustained operations at risk.');
    }
  }

  return entries.slice(0, 24);
}

export const TURN_REPORT_LABELS: Record<TurnReportCategory, string> = {
  war: 'Wars',
  strike: 'Strikes',
  diplomacy: 'Diplomacy',
  alliance: 'Alliances',
  economy: 'Economy',
  combat: 'Combat',
  readiness: 'War Weariness',
  other: 'World',
};

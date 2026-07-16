import type { GameState } from '../types/game';
import { getRelation } from '../data/relations';
import { getRegionsForCountry } from '../data/regions';
import { getNpcProfile, NPC_ROLE_LABELS } from '../data/npcProfiles';
import { ALLIANCES_DATA } from '../data/countries';
import { categorizeRelation, type RelationCategory } from './warDeclaration';
import { formatDisplayGDP, formatDebtRatio } from './treasuryDisplay';
import { getFiscalHeadroom } from './fiscal';
import { getNpcMechanicStatus, type NpcMechanicStatus } from './npcMechanics';

export interface NpcRelationEntry {
  countryId: string;
  name: string;
  value: number;
}

export interface NpcNationDossier {
  countryId: string;
  name: string;
  color: string;
  playable: boolean;
  roleLabel: string;
  quote: string;
  summary: string;
  foreignPolicy: string;
  behaviorNotes: string[];
  relationToPlayer: number;
  relationCategory: RelationCategory;
  standing: string[];
  keyPartners: NpcRelationEntry[];
  keyRivals: NpcRelationEntry[];
  otherRelations: NpcRelationEntry[];
  atWarWith: string[];
  alliances: string[];
  regionsControlled: number;
  regionsTotal: number;
  warExhaustion: number;
  warReadiness: number;
  mechanicStatus: NpcMechanicStatus | null;
}

function isNpcNation(state: GameState, countryId: string): boolean {
  const country = state.countries[countryId];
  return !!country && !country.playable;
}

export function getNpcNationIds(state: GameState): string[] {
  return Object.keys(state.countries)
    .filter(id => isNpcNation(state, id))
    .sort((a, b) => state.countries[a].name.localeCompare(state.countries[b].name));
}

export function getPlayableRelationTargets(
  state: GameState,
  countryId: string
): Array<{ countryId: string; name: string; value: number }> {
  return Object.keys(state.countries)
    .filter(id => id !== countryId && state.countries[id]?.playable)
    .map(id => ({
      countryId: id,
      name: state.countries[id].name,
      value: getRelation(state.relations, countryId, id),
    }))
    .sort((a, b) => b.value - a.value);
}

/**
 * Diplomacy Relations / Peace list: playable nations plus wartime opponents
 * and the active campaign mission target (so NPC Cuba appears when it matters).
 */
export function getDiplomacyRelationTargets(
  state: GameState,
  countryId: string
): Array<{ countryId: string; name: string; value: number }> {
  const byId = new Map(
    getPlayableRelationTargets(state, countryId).map(r => [r.countryId, r] as const)
  );

  const add = (id: string) => {
    if (!id || id === countryId || byId.has(id)) return;
    const country = state.countries[id];
    if (!country) return;
    byId.set(id, {
      countryId: id,
      name: country.name,
      value: getRelation(state.relations, countryId, id),
    });
  };

  for (const war of state.wars) {
    if (!war.belligerents.includes(countryId)) continue;
    for (const id of war.belligerents) add(id);
  }

  const missionTarget = state.usaCampaign?.activeMission?.targetCountryId;
  if (missionTarget) add(missionTarget);

  return [...byId.values()].sort((a, b) => b.value - a.value);
}

function relationEntries(
  state: GameState,
  npcId: string,
  ids: string[]
): NpcRelationEntry[] {
  return ids
    .filter(id => state.countries[id])
    .map(id => ({
      countryId: id,
      name: state.countries[id].name,
      value: getRelation(state.relations, npcId, id),
    }));
}

export function getNpcNationDossier(state: GameState, npcId: string): NpcNationDossier | null {
  const country = state.countries[npcId];
  if (!country || country.playable) return null;

  const profile = getNpcProfile(npcId);
  const playerId = state.playerCountryId;
  const relationToPlayer = getRelation(state.relations, playerId, npcId);
  const regions = getRegionsForCountry(npcId);
  const controlled = regions.filter(r => state.regions[r.id]?.controlledBy === npcId).length;

  const wars = state.wars.filter(w => w.belligerents.includes(npcId));
  const atWarWith = [
    ...new Set(
      wars.flatMap(w => w.belligerents.filter(b => b !== npcId).map(id => state.countries[id]?.name ?? id))
    ),
  ];

  const allianceNames = [
    ...state.alliances.filter(a => a.members.includes(npcId)).map(a => a.name),
    ...ALLIANCES_DATA.filter(a => a.members.includes(npcId)).map(a => a.name),
  ];
  const alliances = [...new Set(allianceNames)];

  const standing: string[] = [];
  const headroom = getFiscalHeadroom(country);
  standing.push(`Treasury: ${formatDisplayGDP(country.stats.treasuryPoints)} · Headroom: ${formatDisplayGDP(headroom)}`);
  if (country.debtToGdp > 0) {
    standing.push(`Debt: ${formatDebtRatio(country.debtToGdp)}`);
  }
  standing.push(`Regions held: ${controlled}/${regions.length}`);
  standing.push(`War exhaustion: ${Math.round(country.stats.warExhaustion * 100)}%`);
  standing.push(`War readiness: ${Math.round((country.stats.warReadiness ?? 1) * 100)}%`);
  if (wars.length > 0) {
    standing.push(`At war with: ${atWarWith.join(', ')}`);
  } else {
    standing.push('At war: no');
  }
  if (alliances.length > 0) {
    standing.push(`Bloc membership: ${alliances.join(', ')}`);
  }

  const collapse = country.collapseCondition;
  if (collapse.type !== 'none' && collapse.telegraphEventId) {
    standing.push(`Collapse risk: ${collapse.type} — watch morale and regime security`);
  }

  const keyPartners = profile
    ? relationEntries(state, npcId, profile.keyPartners)
    : [];
  const keyRivals = profile
    ? relationEntries(state, npcId, profile.keyRivals)
    : [];

  const profileIds = new Set([...keyPartners.map(r => r.countryId), ...keyRivals.map(r => r.countryId), playerId]);
  const otherRelations = Object.keys(state.countries)
    .filter(id => id !== npcId && !profileIds.has(id))
    .map(id => ({
      countryId: id,
      name: state.countries[id].name,
      value: getRelation(state.relations, npcId, id),
    }))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, 6);

  return {
    countryId: npcId,
    name: country.name,
    color: country.color,
    playable: false,
    roleLabel: profile?.roleLabel ?? NPC_ROLE_LABELS.regional_gatekeeper,
    quote: profile?.quote ?? country.difficultyRating.blurb,
    summary: profile?.summary ?? country.difficultyRating.blurb,
    foreignPolicy: profile?.foreignPolicy ?? 'No dossier filed.',
    behaviorNotes: profile?.behaviorNotes ?? [],
    relationToPlayer,
    relationCategory: categorizeRelation(state, playerId, npcId, relationToPlayer),
    standing,
    keyPartners,
    keyRivals,
    otherRelations,
    atWarWith,
    alliances,
    regionsControlled: controlled,
    regionsTotal: regions.length,
    warExhaustion: country.stats.warExhaustion,
    warReadiness: country.stats.warReadiness ?? 1,
    mechanicStatus: getNpcMechanicStatus(state, npcId),
  };
}

/** Occasional history lines so NPC nations feel active in the world report */
export function tickNpcWorldActivity(state: GameState): void {
  const npcIds = getNpcNationIds(state);
  let lines = 0;
  const maxLines = 2;

  for (const npcId of npcIds) {
    if (lines >= maxLines) break;
    const country = state.countries[npcId];
    const profile = getNpcProfile(npcId);
    if (!country || !profile) continue;

    const atWar = state.wars.some(w => w.belligerents.includes(npcId));
    if (atWar && country.stats.warExhaustion > 0.45 && Math.random() < 0.22) {
      state.history.push(
        `Turn ${state.turn}: ${country.name} signals war weariness — ${profile.roleLabel.toLowerCase()} strains under prolonged conflict.`
      );
      lines++;
      continue;
    }

    if (
      !atWar &&
      profile.role === 'energy_power' &&
      state.globalOilShock &&
      state.globalOilShock.turnsRemaining > 0 &&
      Math.random() < 0.18
    ) {
      state.history.push(
        `Turn ${state.turn}: ${country.name} coordinates OPEC messaging as oil shock roils markets.`
      );
      lines++;
      continue;
    }

    if (
      profile.role === 'nato_pillar' &&
      state.wars.some(w => w.belligerents.includes('russia')) &&
      Math.random() < 0.12
    ) {
      state.history.push(
        `Turn ${state.turn}: ${country.name} debates another Ukraine aid package in parliament.`
      );
      lines++;
      continue;
    }

    if (
      country.stats.regimeSecurity < 0.35 &&
      country.collapseCondition.type !== 'none' &&
      Math.random() < 0.15
    ) {
      state.history.push(
        `Turn ${state.turn}: ${country.name} faces mounting instability — ${profile.summary.split('.')[0]}.`
      );
      lines++;
    }
  }
}

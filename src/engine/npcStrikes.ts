import type { GameState } from '../types/game';
import type { StrikeType } from '../types/game';
import { getRelation } from '../data/relations';
import { getStrikeOptions, computeStrikePower } from './strikes';
import { executeStrike } from './combat';
import {
  CAMPAIGN_DEFS,
  hasCampaignOnTarget,
} from './strikeCampaigns';
import { formatDisplayCost } from './treasuryDisplay';

const MAX_NPC_STRIKE_ACTIONS_PER_TURN = 4;
const MAX_NPC_GREY_ZONE_ACTIONS_PER_TURN = 2;
const GREY_ZONE_RELATION_THRESHOLD = -45;

const ONE_OFF_WEIGHTS: Array<{ type: StrikeType; weight: number }> = [
  { type: 'artillery', weight: 35 },
  { type: 'drone', weight: 30 },
  { type: 'cruise', weight: 22 },
  { type: 'ballistic', weight: 10 },
  { type: 'icbm', weight: 3 },
];

const CAMPAIGN_WEIGHTS: Array<{ type: StrikeType; weight: number }> = [
  { type: 'artillery', weight: 40 },
  { type: 'drone', weight: 35 },
  { type: 'cruise', weight: 20 },
  { type: 'ballistic', weight: 5 },
];

const GREY_ZONE_WEIGHTS: Array<{ type: StrikeType; weight: number }> = [
  { type: 'artillery', weight: 42 },
  { type: 'drone', weight: 38 },
  { type: 'cruise', weight: 18 },
  { type: 'ballistic', weight: 2 },
];

interface StrikePair {
  sourceRegionId: string;
  targetRegionId: string;
}

function pickWeighted<T extends { weight: number }>(items: T[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

function findStrikePairs(state: GameState, attackerId: string, defenderId: string): StrikePair[] {
  const pairs: StrikePair[] = [];
  const seen = new Set<string>();

  for (const source of Object.values(state.regions)) {
    if (source.controlledBy !== attackerId) continue;

    for (const target of Object.values(state.regions)) {
      if (target.controlledBy !== defenderId) continue;
      const key = `${source.id}|${target.id}`;
      if (seen.has(key)) continue;

      const options = getStrikeOptions(state, attackerId, target.id);
      if (!options.some(o => o.available)) continue;

      seen.add(key);
      pairs.push({ sourceRegionId: source.id, targetRegionId: target.id });
    }
  }

  return pairs;
}

function npcCanAfford(attacker: { stats: { treasuryPoints: number } }, cost: number): boolean {
  return attacker.stats.treasuryPoints >= cost + 8;
}

function isAtWarBetween(state: GameState, a: string, b: string): boolean {
  return state.wars.some(w => w.belligerents.includes(a) && w.belligerents.includes(b));
}

function npcLaunchOneOff(
  state: GameState,
  attackerId: string,
  pair: StrikePair,
  strikeType: StrikeType,
  greyZone = false
): boolean {
  const attacker = state.countries[attackerId];
  const target = state.regions[pair.targetRegionId];
  if (!attacker || !target) return false;

  const options = getStrikeOptions(state, attackerId, pair.targetRegionId);
  const option = options.find(o => o.type === strikeType);
  if (!option?.available) return false;
  if (!npcCanAfford(attacker, option.cost)) return false;

  attacker.stats.treasuryPoints -= option.cost;
  const strikePower = computeStrikePower(attacker, strikeType, option.power);
  executeStrike(state, attackerId, pair.targetRegionId, strikePower, strikeType, { greyZone });

  const attackerName = attacker.name;
  const targetName = target.name;
  const playerHit = target.controlledBy === state.playerCountryId;
  if (!greyZone) {
    state.history.push(
      `Turn ${state.turn}: ${attackerName} ${strikeType} strike on ${targetName}${playerHit ? ' — YOUR TERRITORY HIT' : ''}.`
    );
  }
  return true;
}

function npcStartCampaign(
  state: GameState,
  attackerId: string,
  pair: StrikePair,
  strikeType: StrikeType
): boolean {
  const attacker = state.countries[attackerId];
  const source = state.regions[pair.sourceRegionId];
  const target = state.regions[pair.targetRegionId];
  if (!attacker || !source || !target) return false;

  if (hasCampaignOnTarget(state, pair.sourceRegionId, pair.targetRegionId)) return false;

  const def = CAMPAIGN_DEFS[strikeType];
  const options = getStrikeOptions(state, attackerId, pair.targetRegionId);
  const option = options.find(o => o.type === strikeType);
  if (!option?.available) return false;

  const totalStart = def.upfrontCost + def.sustainCost;
  const sustainBuffer = def.sustainCost * 4;
  if (!npcCanAfford(attacker, totalStart + sustainBuffer)) return false;

  attacker.stats.treasuryPoints -= totalStart;

  if (!state.strikeCampaigns) state.strikeCampaigns = [];
  state.strikeCampaigns.push({
    id: `npc_campaign_${pair.sourceRegionId}_${pair.targetRegionId}_${state.turn}`,
    attackerCountryId: attackerId,
    sourceRegionId: pair.sourceRegionId,
    targetRegionId: pair.targetRegionId,
    strikeType,
    startTurn: state.turn,
    startedUnprovoked: false,
  });

  const strikePower = computeStrikePower(attacker, strikeType, option.power * def.powerScale);
  executeStrike(state, attackerId, pair.targetRegionId, strikePower, strikeType);

  const playerHit = target.controlledBy === state.playerCountryId;
  state.history.push(
    `Turn ${state.turn}: ${attacker.name} opens ${def.label} from ${source.name} against ${target.name} (${formatDisplayCost(def.sustainCost)}/turn)${playerHit ? ' — targeting YOU' : ''}.`
  );
  return true;
}

function npcStrikeChance(attackerId: string, warAge: number): number {
  let chance = 0.5;
  if (attackerId === 'russia') chance = 0.72;
  if (attackerId === 'iran' || attackerId === 'israel') chance = 0.58;
  if (warAge > 8) chance += 0.08;
  if (warAge > 20) chance += 0.05;
  return Math.min(0.85, chance);
}

function greyZoneStrikeChance(attackerId: string, relation: number): number {
  let chance = 0.14;
  if (attackerId === 'israel' || attackerId === 'iran') chance = 0.24;
  if (attackerId === 'russia') chance = 0.2;
  if (relation <= -70) chance += 0.08;
  if (relation <= -85) chance += 0.05;
  return Math.min(0.34, chance);
}

/** Limited NPC strikes during extreme hostility without a declared war */
export function runNpcGreyZoneStrikes(state: GameState): void {
  let actions = 0;
  const countryIds = Object.keys(state.countries);

  for (const attackerId of countryIds) {
    if (actions >= MAX_NPC_GREY_ZONE_ACTIONS_PER_TURN) break;
    if (attackerId === state.playerCountryId) continue;

    const attacker = state.countries[attackerId];
    if (!attacker || attacker.stats.treasuryPoints < 20) continue;
    if ((attacker.stats.warReadiness ?? 1) < 0.3) continue;

    for (const defenderId of countryIds) {
      if (actions >= MAX_NPC_GREY_ZONE_ACTIONS_PER_TURN) break;
      if (defenderId === attackerId) continue;
      if (isAtWarBetween(state, attackerId, defenderId)) continue;

      const relation = getRelation(state.relations, attackerId, defenderId);
      if (relation > GREY_ZONE_RELATION_THRESHOLD) continue;
      if (Math.random() > greyZoneStrikeChance(attackerId, relation)) continue;

      const pairs = findStrikePairs(state, attackerId, defenderId);
      if (pairs.length === 0) continue;

      const pair = pairs[Math.floor(Math.random() * pairs.length)];
      const affordable = GREY_ZONE_WEIGHTS.filter(w => {
        const opt = getStrikeOptions(state, attackerId, pair.targetRegionId).find(o => o.type === w.type);
        return opt?.available && npcCanAfford(attacker, opt.cost);
      });
      if (affordable.length === 0) continue;

      const pick = pickWeighted(affordable);
      if (npcLaunchOneOff(state, attackerId, pair, pick.type, true)) {
        actions++;
      }
    }
  }
}

/** NPC belligerents launch strikes and sustained campaigns during active wars. */
export function runNpcWartimeStrikes(state: GameState): void {
  if (state.wars.length === 0) return;

  let actions = 0;

  for (const war of state.wars) {
    if (actions >= MAX_NPC_STRIKE_ACTIONS_PER_TURN) break;

    const warAge = state.turn - war.startTurn;
    const belligerents = [...war.belligerents];

    for (const attackerId of belligerents) {
      if (actions >= MAX_NPC_STRIKE_ACTIONS_PER_TURN) break;
      if (attackerId === state.playerCountryId) continue;

      const attacker = state.countries[attackerId];
      if (!attacker || attacker.stats.treasuryPoints < 15) continue;
      if (Math.random() > npcStrikeChance(attackerId, warAge)) continue;

      const enemies = belligerents.filter(id => id !== attackerId);
      const enemyId = enemies[Math.floor(Math.random() * enemies.length)];
      if (!enemyId) continue;

      const pairs = findStrikePairs(state, attackerId, enemyId);
      if (pairs.length === 0) continue;

      const pair = pairs[Math.floor(Math.random() * pairs.length)];
      const preferCampaign =
        warAge >= 2 &&
        Math.random() < 0.28 &&
        !hasCampaignOnTarget(state, pair.sourceRegionId, pair.targetRegionId);

      if (preferCampaign) {
        const pick = pickWeighted(CAMPAIGN_WEIGHTS);
        if (npcStartCampaign(state, attackerId, pair, pick.type)) {
          actions++;
          continue;
        }
      }

      const affordable = ONE_OFF_WEIGHTS.filter(w => {
        const opt = getStrikeOptions(state, attackerId, pair.targetRegionId).find(o => o.type === w.type);
        return opt?.available && npcCanAfford(attacker, opt.cost);
      });
      if (affordable.length === 0) continue;

      const pick = pickWeighted(affordable);
      if (npcLaunchOneOff(state, attackerId, pair, pick.type)) {
        actions++;
      }
    }
  }
}

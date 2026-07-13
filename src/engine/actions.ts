import type { GameState, MilitaryDev } from '../types/game';
import { getMechanicsForNation } from '../data/mechanics';
import { modifyRelation } from '../data/relations';
import { declareWar, applyGlobalCondemnation } from './diplomacy';
import { recordConflictBaseline } from './conflictRelations';
import {
  getWarDeclarationPreview,
  wouldTriggerGlobalCondemnation,
} from './warDeclaration';
import { executeStrike } from './combat';
import { playerStartMilitaryUpgrade } from './militaryDevUpgrades';
import { getRegionsForCountry } from '../data/regions';
import type { TalkOptionId, PeaceTermsType, CovertTalkOptionId } from '../types/game';
import type { NegotiationResult } from './talks';
import {
  dispatchTalkMission,
  dispatchCovertMission,
  dispatchInvokeUsSupportMission,
} from './diplomaticMissions';
import { executePressAction } from './pressActions';
import type { PressActionId } from '../types/game';
import {
  spendActionEnergy,
  actionEnergyBlockReason,
  ACTION_ENERGY_COSTS,
} from './actionEnergy';
import {
  getEffectiveSpendCost,
  getDebtServicePerTurn,
} from './fiscal';
import { formatDisplayCost } from './treasuryDisplay';
import type { StrikeType } from './strikes';
import { getStrikeOptions, computeStrikePower } from './strikes';
import { getReadinessBlockReason } from './warReadiness';

export function isAtWarWith(state: GameState, a: string, b: string): boolean {
  return state.wars.some(w => w.belligerents.includes(a) && w.belligerents.includes(b));
}

export function canAfford(state: GameState, costTp: number): boolean {
  const country = state.countries[state.playerCountryId];
  if (!country) return false;
  const effective = getEffectiveSpendCost(country, costTp);
  return country.stats.treasuryPoints >= effective;
}

export function deductCost(state: GameState, costTp: number): boolean {
  const country = state.countries[state.playerCountryId];
  if (!country) return false;

  const effective = getEffectiveSpendCost(country, costTp);
  if (country.stats.treasuryPoints >= effective) {
    country.stats.treasuryPoints -= effective;
    return true;
  }
  return false;
}

export function playerDeclareWar(state: GameState, targetId: string): string | null {
  const preview = getWarDeclarationPreview(state, state.playerCountryId, targetId);
  if (!preview.canDeclare) return preview.blockReason ?? 'Cannot declare war.';

  const energyCost = ACTION_ENERGY_COSTS.declare_war;
  if (!spendActionEnergy(state, energyCost)) {
    return actionEnergyBlockReason(state, energyCost)!;
  }

  declareWar(state, state.playerCountryId, targetId);
  recordConflictBaseline(state, state.playerCountryId, targetId);
  state.warsDeclaredThisTurn += 1;

  const condemnation = wouldTriggerGlobalCondemnation(
    { ...state, warsDeclaredThisTurn: state.warsDeclaredThisTurn - 1 },
    state.playerCountryId,
    targetId
  );
  if (condemnation.triggers && condemnation.reason) {
    applyGlobalCondemnation(state, state.playerCountryId, condemnation.reason);
  }

  state.countries[state.playerCountryId].stats.warPopularity = Math.max(
    0,
    state.countries[state.playerCountryId].stats.warPopularity - 0.1
  );
  return null;
}

export { getWarDeclarationPreview, canDeclareWarThisTurn, getWarsRemaining } from './warDeclaration';

export function playerNegotiate(
  state: GameState,
  targetId: string,
  option: TalkOptionId,
  peaceTerms?: PeaceTermsType
): NegotiationResult {
  const result = dispatchTalkMission(state, targetId, option, peaceTerms);
  return { success: result.success, message: result.message };
}

export function playerCovertNegotiate(
  state: GameState,
  targetId: string,
  option: CovertTalkOptionId
): NegotiationResult {
  const result = dispatchCovertMission(state, targetId, option);
  return { success: result.success, message: result.message };
}

export function playerPressAction(
  state: GameState,
  actionId: PressActionId,
  targetId: string
): { success: boolean; message: string } {
  return executePressAction(state, actionId, targetId);
}

export function playerProbeCovertPacts(state: GameState, targetNationId: string): string | null {
  if (targetNationId === state.playerCountryId) return 'Cannot probe yourself.';
  const target = state.countries[targetNationId];
  if (!target) return 'Invalid target.';

  const energyCost = ACTION_ENERGY_COSTS.probe_pacts;
  if (!spendActionEnergy(state, energyCost)) {
    return actionEnergyBlockReason(state, energyCost)!;
  }

  const baseCost = 7;
  const targetCI = (target.stats.regimeSecurity ?? 0.5) * 25;
  const discoveryRisk = Math.max(
    10,
    30 + (1 - state.budget.covert) * 15 + targetCI - state.counterIntelLevel * 8
  );

  if (!deductCost(state, baseCost)) {
    state.actionEnergy += energyCost;
    return `Insufficient funds (need ${formatDisplayCost(baseCost)}).`;
  }

  state.activeCovertOps.push({
    id: `probe_${state.turn}_${targetNationId}`,
    sourceNation: state.playerCountryId,
    targetNation: targetNationId,
    cost: baseCost,
    discoveryRiskPercent: discoveryRisk,
    effectIfHidden: {},
    effectIfDiscovered: { relationsPenalty: -12 },
    opKind: 'probe_pacts',
    turnStarted: state.turn,
    discovered: false,
  });

  state.history.push(
    `Turn ${state.turn}: Intelligence probe launched against ${target.name} (seeking secret pacts).`
  );
  return null;
}

export function playerLaunchStrike(
  state: GameState,
  targetRegionId: string,
  strikeType: StrikeType = 'cruise'
): string | null {
  const region = state.regions[targetRegionId];
  if (!region) return 'Invalid target region.';

  const attacker = state.countries[state.playerCountryId];
  if (!attacker) return 'Invalid player.';

  const options = getStrikeOptions(state, state.playerCountryId, targetRegionId);
  const option = options.find(o => o.type === strikeType);
  if (!option) return 'Unknown strike type.';
  if (!option.available) return option.blockReason ?? 'Strike unavailable.';

  const readinessBlock = getReadinessBlockReason(state, state.playerCountryId);
  if (readinessBlock) return readinessBlock;

  if (!spendActionEnergy(state, option.energyCost)) {
    return actionEnergyBlockReason(state, option.energyCost)!;
  }

  if (!deductCost(state, option.cost)) {
    state.actionEnergy += option.energyCost;
    return `Insufficient funds (need ${formatDisplayCost(option.cost)}).`;
  }

  const strikePower = computeStrikePower(attacker, strikeType, option.power);

  executeStrike(state, state.playerCountryId, targetRegionId, strikePower, strikeType);
  state.history.push(
    `Turn ${state.turn}: ${option.label} launched at ${region.name} (${state.countries[region.controlledBy]?.name}).`
  );
  return null;
}

export function playerLaunchCovertOp(state: GameState, targetNationId: string): string | null {
  if (targetNationId === state.playerCountryId) return 'Cannot target yourself.';
  const target = state.countries[targetNationId];
  if (!target) return 'Invalid target.';

  const energyCost = ACTION_ENERGY_COSTS.covert_op;
  if (!spendActionEnergy(state, energyCost)) {
    return actionEnergyBlockReason(state, energyCost)!;
  }

  const baseCost = 6;
  const targetCI = (target.stats.regimeSecurity ?? 0.5) * 20;
  const discoveryRisk = Math.max(5, 25 + (1 - state.budget.covert) * 20 + targetCI - state.counterIntelLevel * 5);

  if (!deductCost(state, baseCost)) {
    state.actionEnergy += energyCost;
    return `Insufficient funds (need ${formatDisplayCost(baseCost)}).`;
  }

  state.activeCovertOps.push({
    id: `covert_${state.turn}_${targetNationId}`,
    sourceNation: state.playerCountryId,
    targetNation: targetNationId,
    cost: baseCost,
    discoveryRiskPercent: discoveryRisk,
    effectIfHidden: { targetMorale: -0.04, targetUnrest: 8 },
    effectIfDiscovered: { targetMorale: -0.01, relationsPenalty: -15 },
    turnStarted: state.turn,
    discovered: false,
  });

  state.history.push(`Turn ${state.turn}: Covert operation launched against ${target.name}.`);
  return null;
}

export function playerExecuteMechanic(
  state: GameState,
  mechanicId: string,
  targetNationId?: string
): string | null {
  const mechanics = getMechanicsForNation(state.playerCountryId);
  const mechanic = mechanics.find(m => m.id === mechanicId);
  if (!mechanic) return 'Unknown action.';

  if (mechanic.requiresTarget && !targetNationId) {
    return 'Select a target nation first.';
  }

  const lastUsed = state.mechanicCooldowns[mechanicId] ?? 0;
  if (state.turn - lastUsed < mechanic.cooldown) {
    return `On cooldown (${mechanic.cooldown - (state.turn - lastUsed)} turns remaining).`;
  }

  const energyCost = ACTION_ENERGY_COSTS.nation_mechanic;
  if (!spendActionEnergy(state, energyCost)) {
    return actionEnergyBlockReason(state, energyCost)!;
  }

  if (!deductCost(state, mechanic.cost)) {
    state.actionEnergy += energyCost;
    return `Insufficient funds (need ${formatDisplayCost(mechanic.cost)}).`;
  }

  const player = state.countries[state.playerCountryId];

  if (mechanic.effects.counterIntel && !targetNationId) {
    state.counterIntelLevel = Math.min(1, state.counterIntelLevel + mechanic.effects.counterIntel);
    if (mechanic.effects.relationsBoost) {
      for (const otherId of Object.keys(state.countries)) {
        if (otherId === state.playerCountryId) continue;
        modifyRelation(
          state.relations,
          state.playerCountryId,
          otherId,
          mechanic.effects.relationsBoost * 0.3
        );
      }
    }
    state.history.push(`Turn ${state.turn}: ${mechanic.name} strengthened intelligence sharing.`);
    state.mechanicCooldowns[mechanicId] = state.turn;
    return null;
  }

  if (mechanic.category === 'strategic' && mechanic.id === 'invoke_us_support' && targetNationId) {
    const duration = mechanic.missionTurns ?? 7;
    const result = dispatchInvokeUsSupportMission(
      state,
      targetNationId,
      mechanic.cost,
      energyCost,
      duration
    );
    if (!result.success) {
      state.actionEnergy += energyCost;
      if (player) player.stats.treasuryPoints += getEffectiveSpendCost(player, mechanic.cost);
      return result.message;
    }
    state.mechanicCooldowns[mechanicId] = state.turn;
    return null;
  }

  if (mechanic.category === 'covert' && targetNationId) {
    const target = state.countries[targetNationId];
    if (!target) return 'Invalid target.';
    state.activeCovertOps.push({
      id: `mech_${mechanicId}_${state.turn}`,
      sourceNation: state.playerCountryId,
      targetNation: targetNationId,
      cost: mechanic.cost,
      discoveryRiskPercent: 20 + (mechanic.discoveryRiskBonus ?? 0) * 100,
      effectIfHidden: mechanic.effects,
      effectIfDiscovered: {
        ...mechanic.effects,
        relationsPenalty: -20,
      },
      mechanicId,
      turnStarted: state.turn,
      discovered: false,
    });
    state.history.push(`Turn ${state.turn}: ${mechanic.name} deployed against ${target.name}.`);
  } else if (mechanic.effects.relationsBoost) {
    for (const otherId of Object.keys(state.countries)) {
      if (otherId === state.playerCountryId) continue;
      modifyRelation(state.relations, state.playerCountryId, otherId, mechanic.effects.relationsBoost * 0.3);
    }
    state.history.push(`Turn ${state.turn}: ${mechanic.name} improved international standing.`);
  } else if (mechanic.effects.gdpGrowthBoost) {
    player.stats.baseGrowthRate += mechanic.effects.gdpGrowthBoost;
    state.history.push(`Turn ${state.turn}: ${mechanic.name} boosted economic growth.`);
  } else if (mechanic.effects.defenseBoost) {
    for (const region of getRegionsForCountry(state.playerCountryId)) {
      for (const ds of region.garrison.defenseSystems) {
        ds.rating += mechanic.effects.defenseBoost;
      }
      if (region.garrison.defenseSystems.length === 0) {
        region.garrison.defenseSystems.push({
          id: `${region.id}-temp`,
          type: 'generic',
          rating: mechanic.effects.defenseBoost,
        });
      }
    }
    state.history.push(`Turn ${state.turn}: ${mechanic.name} deployed.`);
  } else if (mechanic.effects.deterrence) {
    player.stats.moraleBase = Math.min(1, player.stats.moraleBase + 0.05);
    if (targetNationId) {
      modifyRelation(state.relations, state.playerCountryId, targetNationId, mechanic.effects.relationsPenalty ?? -5);
    }
    state.history.push(`Turn ${state.turn}: ${mechanic.name} signaled.`);
  } else if (mechanic.effects.borderPressure && targetNationId) {
    const targetRegions = getRegionsForCountry(targetNationId);
    const border = targetRegions.find(r =>
      r.neighbours.some(n => state.regions[n]?.countryId === state.playerCountryId)
    );
    if (border) {
      border.unrest = Math.min(100, border.unrest + mechanic.effects.borderPressure);
      border.garrison.troops = Math.max(100, border.garrison.troops * 0.9);
    }
    state.history.push(`Turn ${state.turn}: ${mechanic.name} pressured ${state.countries[targetNationId]?.name} border.`);
  }

  state.mechanicCooldowns[mechanicId] = state.turn;
  return null;
}

export function playerInvestMilitary(
  state: GameState,
  category: keyof MilitaryDev
): string | null {
  return playerStartMilitaryUpgrade(state, category);
}

export function accumulateTreasury(state: GameState): void {
  const country = state.countries[state.playerCountryId];
  if (!country) return;
  const contribution = country.stats.treasuryPoints * state.budget.reserve * 0.008;
  const debtService = getDebtServicePerTurn(country);
  country.stats.treasuryPoints += Math.max(0, contribution - debtService);
}

/** @deprecated Use accumulateTreasury */
export const accumulateReserve = accumulateTreasury;

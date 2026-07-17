import { useCallback, useState } from 'react';
import type {
  BudgetAllocation,
  DomesticSplit,
  FacilityType,
  GameState,
  MilitaryDev,
  PeaceTermsType,
  TalkOptionId,
  CovertTalkOptionId,
  PressActionId,
} from '../types/game';
import {
  playerDeclareWar,
  playerLaunchStrike,
  playerLaunchCovertOp,
  playerExecuteMechanic,
  playerInvestMilitary,
  playerNegotiate,
  playerCovertNegotiate,
  playerProbeCovertPacts,
  playerPressAction,
} from '../engine/actions';
import { dispatchTalkMission } from '../engine/diplomaticMissions';
import { playerDomesticPropaganda, playerForeignInfluence } from '../engine/propaganda';
import { playerStartFacilityBuild } from '../engine/facilities';
import { playerStartStrikeCampaign, playerCancelStrikeCampaign } from '../engine/strikeCampaigns';
import { resolveEventChoice } from '../engine/events';
import { installCampaignClient } from '../engine/usaCampaign';
import { maybeStartPostCubaCutscene } from '../engine/cutscenes';
import { detectFronts } from '../engine/combat';
import type { StrikeType } from '../engine/strikes';

type StrikeConfirmRequest =
  | { kind: 'strike'; regionId: string; strikeType: StrikeType }
  | { kind: 'campaign'; sourceRegionId: string; targetRegionId: string; strikeType: StrikeType };

type FacilityConfirmRequest = { regionId: string; facilityType: FacilityType };

/**
 * Every player action that mutates game state: request → confirm (for
 * strikes/war/facilities) → structuredClone + engine call → feedback/update.
 * Owns the toast feedback state since nearly every handler here sets it.
 */
export function useGameActions(
  state: GameState | null,
  updateState: (next: GameState) => void,
  setState: (next: GameState) => void
) {
  const [feedback, setFeedback] = useState<string | null>(null);
  const [talksResult, setTalksResult] = useState<string | null>(null);
  const [warConfirmTarget, setWarConfirmTarget] = useState<string | null>(null);
  const [strikeConfirm, setStrikeConfirm] = useState<StrikeConfirmRequest | null>(null);
  const [facilityConfirm, setFacilityConfirm] = useState<FacilityConfirmRequest | null>(null);

  const showFeedback = useCallback((msg: string | null) => {
    setFeedback(msg);
    if (msg) setTimeout(() => setFeedback(null), 3000);
  }, []);

  const handleRequestStrike = useCallback((regionId: string, strikeType: StrikeType) => {
    setStrikeConfirm({ kind: 'strike', regionId, strikeType });
  }, []);

  const handleRequestCampaign = useCallback((
    sourceRegionId: string,
    targetRegionId: string,
    strikeType: StrikeType
  ) => {
    setStrikeConfirm({ kind: 'campaign', sourceRegionId, targetRegionId, strikeType });
  }, []);

  const handleConfirmStrike = useCallback(() => {
    if (!state || !strikeConfirm) return;
    const newState = structuredClone(state);
    let err: string | null = null;

    if (strikeConfirm.kind === 'strike') {
      err = playerLaunchStrike(newState, strikeConfirm.regionId, strikeConfirm.strikeType);
    } else {
      err = playerStartStrikeCampaign(
        newState,
        strikeConfirm.sourceRegionId,
        strikeConfirm.targetRegionId,
        strikeConfirm.strikeType
      );
    }

    setStrikeConfirm(null);
    if (err) showFeedback(err);
    else updateState(newState);
  }, [state, strikeConfirm, updateState, showFeedback]);

  const handleCancelStrike = useCallback(() => {
    setStrikeConfirm(null);
  }, []);

  const handleCancelCampaign = useCallback((campaignId: string) => {
    if (!state) return;
    const newState = structuredClone(state);
    const err = playerCancelStrikeCampaign(newState, campaignId);
    if (err) showFeedback(err);
    else updateState(newState);
  }, [state, updateState, showFeedback]);

  const handleRequestWar = useCallback((targetId: string) => {
    setWarConfirmTarget(targetId);
  }, []);

  const handleInstallClient = useCallback((targetId: string) => {
    if (!state) return;
    const newState = structuredClone(state);
    const err = installCampaignClient(newState, targetId);
    if (err) showFeedback(err);
    else {
      maybeStartPostCubaCutscene(newState);
      updateState(newState);
      showFeedback('Client government installed.');
    }
  }, [state, updateState, showFeedback]);

  const handleConfirmWar = useCallback(() => {
    if (!state || !warConfirmTarget) return;
    const newState = structuredClone(state);
    const err = playerDeclareWar(newState, warConfirmTarget);
    setWarConfirmTarget(null);
    if (err) showFeedback(err);
    else {
      newState.fronts = detectFronts(newState);
      updateState(newState);
      showFeedback(`War declared on ${newState.countries[warConfirmTarget]?.name ?? warConfirmTarget}.`);
    }
  }, [state, warConfirmTarget, updateState, showFeedback]);

  const handleCancelWar = useCallback(() => {
    setWarConfirmTarget(null);
  }, []);

  const handleNegotiate = useCallback((
    targetId: string,
    option: TalkOptionId,
    peaceTerms?: PeaceTermsType
  ) => {
    if (!state) return null;
    const newState = structuredClone(state);
    const result = playerNegotiate(newState, targetId, option, peaceTerms);
    setTalksResult(result.message);
    showFeedback(result.message);
    if (result.success) updateState(newState);
    return result;
  }, [state, updateState, showFeedback]);

  const handleCovertNegotiate = useCallback((
    targetId: string,
    option: CovertTalkOptionId
  ) => {
    if (!state) return null;
    const newState = structuredClone(state);
    const result = playerCovertNegotiate(newState, targetId, option);
    setTalksResult(result.message);
    showFeedback(result.message);
    if (result.success) updateState(newState);
    return result;
  }, [state, updateState, showFeedback]);

  const handleProbePacts = useCallback((targetId: string) => {
    if (!state) return;
    const newState = structuredClone(state);
    const err = playerProbeCovertPacts(newState, targetId);
    if (err) showFeedback(err);
    else {
      showFeedback('Intelligence probe launched — results next turn.');
      updateState(newState);
    }
  }, [state, updateState, showFeedback]);

  const handlePressAction = useCallback((actionId: PressActionId, targetId: string) => {
    if (!state) return;
    const newState = structuredClone(state);
    const result = playerPressAction(newState, actionId, targetId);
    showFeedback(result.message);
    if (result.success) updateState(newState);
  }, [state, updateState, showFeedback]);

  const handleProposePeace = useCallback((targetId: string, terms: PeaceTermsType) => {
    if (!state) return;
    const newState = structuredClone(state);
    const result = dispatchTalkMission(newState, targetId, 'peace', terms);
    showFeedback(result.message);
    if (result.success) updateState(newState);
  }, [state, updateState, showFeedback]);

  const handleDomesticPropaganda = useCallback(() => {
    if (!state) return;
    const newState = structuredClone(state);
    const err = playerDomesticPropaganda(newState);
    if (err) showFeedback(err);
    else updateState(newState);
  }, [state, updateState, showFeedback]);

  const handleForeignInfluence = useCallback((targetId: string) => {
    if (!state) return;
    const newState = structuredClone(state);
    const err = playerForeignInfluence(newState, targetId);
    if (err) showFeedback(err);
    else updateState(newState);
  }, [state, updateState, showFeedback]);

  const handleDomesticSplitChange = useCallback((split: DomesticSplit) => {
    if (!state) return;
    setState({ ...state, domesticSplit: split });
  }, [state, setState]);

  const handleCovertOp = useCallback((targetId: string) => {
    if (!state) return;
    const newState = structuredClone(state);
    const err = playerLaunchCovertOp(newState, targetId);
    if (err) showFeedback(err);
    else updateState(newState);
  }, [state, updateState, showFeedback]);

  const handleMechanic = useCallback((mechanicId: string, targetId?: string) => {
    if (!state) return;
    const newState = structuredClone(state);
    const err = playerExecuteMechanic(newState, mechanicId, targetId);
    if (err) showFeedback(err);
    else updateState(newState);
  }, [state, updateState, showFeedback]);

  const handleInvestMilitary = useCallback((category: keyof MilitaryDev) => {
    if (!state) return;
    const newState = structuredClone(state);
    const err = playerInvestMilitary(newState, category);
    if (err) showFeedback(err);
    else updateState(newState);
  }, [state, updateState, showFeedback]);

  const handleEventChoice = useCallback((eventId: string, choiceIndex: number, targetCountryId: string) => {
    if (!state) return;
    const newState = structuredClone(state);
    resolveEventChoice(newState, eventId, choiceIndex, targetCountryId);
    updateState(newState);
  }, [state, updateState]);

  const handleBudgetChange = useCallback((budget: BudgetAllocation) => {
    if (!state) return;
    setState({ ...state, budget });
  }, [state, setState]);

  const handleTaxChange = useCallback((corporateTaxRate: number, incomeTaxRate: number) => {
    if (!state) return;
    setState({ ...state, corporateTaxRate, incomeTaxRate });
  }, [state, setState]);

  const handleRequestFacilityBuild = useCallback((regionId: string, type: FacilityType) => {
    setFacilityConfirm({ regionId, facilityType: type });
  }, []);

  const handleConfirmFacilityBuild = useCallback(() => {
    if (!state || !facilityConfirm) return;
    const newState = structuredClone(state);
    const err = playerStartFacilityBuild(
      newState,
      facilityConfirm.regionId,
      facilityConfirm.facilityType
    );
    setFacilityConfirm(null);
    if (err) showFeedback(err);
    else updateState(newState);
  }, [state, facilityConfirm, updateState, showFeedback]);

  const handleCancelFacilityBuild = useCallback(() => {
    setFacilityConfirm(null);
  }, []);

  return {
    feedback,
    showFeedback,
    talksResult,
    warConfirmTarget,
    strikeConfirm,
    facilityConfirm,
    handleRequestStrike,
    handleRequestCampaign,
    handleConfirmStrike,
    handleCancelStrike,
    handleCancelCampaign,
    handleRequestWar,
    handleInstallClient,
    handleConfirmWar,
    handleCancelWar,
    handleNegotiate,
    handleCovertNegotiate,
    handleProbePacts,
    handlePressAction,
    handleProposePeace,
    handleDomesticPropaganda,
    handleForeignInfluence,
    handleDomesticSplitChange,
    handleCovertOp,
    handleMechanic,
    handleInvestMilitary,
    handleEventChoice,
    handleBudgetChange,
    handleTaxChange,
    handleRequestFacilityBuild,
    handleConfirmFacilityBuild,
    handleCancelFacilityBuild,
  };
}

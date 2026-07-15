import { useState, useCallback } from 'react';
import type {
  GameState,
  GameMode,
  TurnReportEntry,
  BudgetAllocation,
  MilitaryDev,
  DomesticSplit,
  PeaceTermsType,
  TalkOptionId,
  CovertTalkOptionId,
  PressActionId,
  FacilityType,
} from './types/game';
import { createInitialState, advanceTurn } from './engine/gameState';
import { saveGame, loadGame, peekSaveSummary, listSaveSummaries, deleteSave } from './engine/saveLoad';
import { resolveEventChoice } from './engine/events';
import { getEventById } from './data/events';
import {
  playerDeclareWar,
  playerLaunchStrike,
  playerLaunchCovertOp,
  playerExecuteMechanic,
  playerInvestMilitary,
  getWarDeclarationPreview,
  playerNegotiate,
  playerCovertNegotiate,
  playerProbeCovertPacts,
  playerPressAction,
} from './engine/actions';
import { dispatchTalkMission } from './engine/diplomaticMissions';
import { playerDomesticPropaganda, playerForeignInfluence } from './engine/propaganda';
import { playerStartFacilityBuild, getFacilityConfirmPreview } from './engine/facilities';
import { playerStartStrikeCampaign, playerCancelStrikeCampaign } from './engine/strikeCampaigns';
import { getStrikeConfirmPreview, getCampaignConfirmPreview } from './engine/strikePreview';
import { TitleScreen } from './components/TitleScreen';
import { ModeSelect } from './components/ModeSelect';
import { CampaignSelect } from './components/CampaignSelect';
import { SaveSelect } from './components/SaveSelect';
import { EndScreen } from './components/EndScreen';
import { NationSelect } from './components/NationSelect';
import { GameHeader } from './components/GameHeader';
import { WorldMap } from './components/WorldMap';
import { HemisphereChooser } from './components/HemisphereChooser';
import { NationalMap } from './components/NationalMap';
import { LayerTray } from './components/LayerTray';
import { DiplomacyPanel } from './components/DiplomacyPanel';
import { WarConfirmModal } from './components/WarConfirmModal';
import { StrikeConfirmModal } from './components/StrikeConfirmModal';
import { FacilityConfirmModal } from './components/FacilityConfirmModal';
import { EconomyPanel } from './components/EconomyPanel';
import { EventModal } from './components/EventModal';
import { RegionActionPanel } from './components/RegionActionPanel';
import { SidePanel } from './components/SidePanel';
import { TurnSummaryModal } from './components/TurnSummaryModal';
import { PeerChoiceModal } from './components/PeerChoiceModal';
import { NationIntroModal } from './components/NationIntroModal';
import { WarTheaterScreen } from './components/WarTheaterScreen';
import { WarTheaterNoticeModal } from './components/WarTheaterNoticeModal';
import { CampaignMissionPanel } from './components/CampaignMissionPanel';
import { CutsceneModal } from './components/CutsceneModal';
import { BottomSheet } from './components/BottomSheet';
import { installCampaignClient } from './engine/usaCampaign';
import { hasBlockingCutscene } from './data/cutscenes';
import { maybeStartPostCubaCutscene } from './engine/cutscenes';
import { detectFronts } from './engine/combat';
import type { StrikeType } from './engine/strikes';
import { useMobileLayout } from './hooks/useMobileLayout';
import { getHemisphereForCountry, type HemisphereId } from './data/hemispheres';
import './App.css';

type Screen = 'title' | 'mode' | 'campaigns' | 'saves' | 'nation' | 'game';

type StrikeConfirmRequest =
  | { kind: 'strike'; regionId: string; strikeType: StrikeType }
  | { kind: 'campaign'; sourceRegionId: string; targetRegionId: string; strikeType: StrikeType };

type FacilityConfirmRequest = { regionId: string; facilityType: FacilityType };

export default function App() {
  const [screen, setScreen] = useState<Screen>('title');
  const [state, setState] = useState<GameState | null>(null);
  const [showDiplomacy, setShowDiplomacy] = useState(false);
  const [showEconomy, setShowEconomy] = useState(false);
  const [showSidePanel, setShowSidePanel] = useState(() =>
    typeof window !== 'undefined' ? !window.matchMedia('(max-width: 768px)').matches : true
  );
  const [saveSummary, setSaveSummary] = useState(() => peekSaveSummary());
  const [pendingMode, setPendingMode] = useState<GameMode>('campaign');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [warConfirmTarget, setWarConfirmTarget] = useState<string | null>(null);
  const [strikeConfirm, setStrikeConfirm] = useState<StrikeConfirmRequest | null>(null);
  const [facilityConfirm, setFacilityConfirm] = useState<FacilityConfirmRequest | null>(null);
  const [turnSummary, setTurnSummary] = useState<TurnReportEntry[] | null>(null);
  const [talksResult, setTalksResult] = useState<string | null>(null);
  const [showNationIntro, setShowNationIntro] = useState(false);
  const [showTheater, setShowTheater] = useState(false);
  const [theaterFocusId, setTheaterFocusId] = useState<string | undefined>(undefined);
  const [showMission, setShowMission] = useState(false);
  const isMobile = useMobileLayout();
  const [mobileWorldView, setMobileWorldView] = useState<'chooser' | HemisphereId>('chooser');
  const [lastHemisphere, setLastHemisphere] = useState<HemisphereId>('eurasia');

  const refreshSaveMeta = useCallback(() => {
    setSaveSummary(peekSaveSummary());
  }, []);

  const returnToTitle = useCallback(() => {
    setScreen('title');
    setState(null);
    setShowDiplomacy(false);
    setShowEconomy(false);
    setShowTheater(false);
    setShowMission(false);
    refreshSaveMeta();
  }, [refreshSaveMeta]);

  const showFeedback = (msg: string | null) => {
    setFeedback(msg);
    if (msg) setTimeout(() => setFeedback(null), 3000);
  };

  const updateState = useCallback((newState: GameState) => {
    setState(newState);
    saveGame(newState);
    setSaveSummary(peekSaveSummary());
  }, []);

  const startGame = useCallback((countryId: string, mode: GameMode = pendingMode) => {
    deleteSave();
    const newState = createInitialState(countryId, mode);
    setPendingMode(mode);
    setState(newState);
    setScreen('game');
    setShowDiplomacy(false);
    setShowEconomy(false);
    setShowTheater(false);
    setShowMission(false);
    setFeedback(null);
    setShowNationIntro(false);
    setMobileWorldView('chooser');
    setLastHemisphere(getHemisphereForCountry(countryId));
    refreshSaveMeta();
  }, [pendingMode, refreshSaveMeta]);

  const startUsaCampaign = useCallback(() => {
    startGame('usa', 'campaign');
  }, [startGame]);

  const loadSaved = useCallback(() => {
    const saved = loadGame<GameState>();
    if (saved) {
      setState(saved);
      setScreen('game');
      refreshSaveMeta();
    } else {
      showFeedback('Save file incompatible or missing.');
      refreshSaveMeta();
      setScreen('title');
    }
  }, [refreshSaveMeta]);

  const handleDeleteSave = useCallback(() => {
    deleteSave();
    refreshSaveMeta();
    setScreen('title');
  }, [refreshSaveMeta]);

  const endTurn = useCallback(() => {
    if (!state || state.gameOver || state.playerWon) return;
    if (hasBlockingCutscene(state)) return;
    const next = advanceTurn(state);
    setTurnSummary(next.lastTurnReport?.length ? next.lastTurnReport : null);
    updateState(next);
  }, [state, updateState]);

  const handleSave = useCallback(() => {
    if (state) {
      saveGame(state);
      refreshSaveMeta();
      showFeedback('Game saved.');
    }
  }, [state, refreshSaveMeta]);

  const handleCountryClick = useCallback((countryId: string) => {
    if (!state) return;
    if (isMobile && mobileWorldView !== 'chooser') {
      setLastHemisphere(mobileWorldView);
    }
    setState({
      ...state,
      selectedMapTier: 2,
      selectedCountryId: countryId,
      selectedRegionId: null,
    });
  }, [state, isMobile, mobileWorldView]);

  const handleBackToWorld = useCallback(() => {
    if (!state) return;
    setState({ ...state, selectedMapTier: 1, selectedCountryId: null, selectedRegionId: null });
    if (isMobile) {
      setMobileWorldView(lastHemisphere);
    }
  }, [state, isMobile, lastHemisphere]);

  const handleRegionClick = useCallback((regionId: string) => {
    if (!state) return;
    setState({ ...state, selectedRegionId: regionId });
  }, [state]);

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
  }, [state, strikeConfirm, updateState]);

  const handleCancelStrike = useCallback(() => {
    setStrikeConfirm(null);
  }, []);

  const handleCancelCampaign = useCallback((campaignId: string) => {
    if (!state) return;
    const newState = structuredClone(state);
    const err = playerCancelStrikeCampaign(newState, campaignId);
    if (err) showFeedback(err);
    else updateState(newState);
  }, [state, updateState]);

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
  }, [state, updateState]);

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
  }, [state, warConfirmTarget, updateState]);

  const handleCancelWar = useCallback(() => {
    setWarConfirmTarget(null);
  }, []);

  const handleNegotiate = useCallback((
    targetId: string,
    option: TalkOptionId,
    peaceTerms?: PeaceTermsType
  ) => {
    if (!state) return;
    const newState = structuredClone(state);
    const result = playerNegotiate(newState, targetId, option, peaceTerms);
    setTalksResult(result.message);
    showFeedback(result.message);
    if (result.success) updateState(newState);
  }, [state, updateState]);

  const handleCovertNegotiate = useCallback((
    targetId: string,
    option: CovertTalkOptionId
  ) => {
    if (!state) return;
    const newState = structuredClone(state);
    const result = playerCovertNegotiate(newState, targetId, option);
    setTalksResult(result.message);
    showFeedback(result.message);
    if (result.success) updateState(newState);
  }, [state, updateState]);

  const handleProbePacts = useCallback((targetId: string) => {
    if (!state) return;
    const newState = structuredClone(state);
    const err = playerProbeCovertPacts(newState, targetId);
    if (err) showFeedback(err);
    else {
      showFeedback('Intelligence probe launched — results next turn.');
      updateState(newState);
    }
  }, [state, updateState]);

  const handlePressAction = useCallback((actionId: PressActionId, targetId: string) => {
    if (!state) return;
    const newState = structuredClone(state);
    const result = playerPressAction(newState, actionId, targetId);
    showFeedback(result.message);
    if (result.success) updateState(newState);
  }, [state, updateState]);

  const handleProposePeace = useCallback((targetId: string, terms: PeaceTermsType) => {
    if (!state) return;
    const newState = structuredClone(state);
    const result = dispatchTalkMission(newState, targetId, 'peace', terms);
    showFeedback(result.message);
    if (result.success) updateState(newState);
  }, [state, updateState]);

  const handleDomesticPropaganda = useCallback(() => {
    if (!state) return;
    const newState = structuredClone(state);
    const err = playerDomesticPropaganda(newState);
    if (err) showFeedback(err);
    else updateState(newState);
  }, [state, updateState]);

  const handleForeignInfluence = useCallback((targetId: string) => {
    if (!state) return;
    const newState = structuredClone(state);
    const err = playerForeignInfluence(newState, targetId);
    if (err) showFeedback(err);
    else updateState(newState);
  }, [state, updateState]);

  const handleDomesticSplitChange = useCallback((split: DomesticSplit) => {
    if (!state) return;
    setState({ ...state, domesticSplit: split });
  }, [state]);

  const handleCovertOp = useCallback((targetId: string) => {
    if (!state) return;
    const newState = structuredClone(state);
    const err = playerLaunchCovertOp(newState, targetId);
    if (err) showFeedback(err);
    else updateState(newState);
  }, [state, updateState]);

  const handleMechanic = useCallback((mechanicId: string, targetId?: string) => {
    if (!state) return;
    const newState = structuredClone(state);
    const err = playerExecuteMechanic(newState, mechanicId, targetId);
    if (err) showFeedback(err);
    else updateState(newState);
  }, [state, updateState]);

  const handleInvestMilitary = useCallback((category: keyof MilitaryDev) => {
    if (!state) return;
    const newState = structuredClone(state);
    const err = playerInvestMilitary(newState, category);
    if (err) showFeedback(err);
    else updateState(newState);
  }, [state, updateState]);

  const handleEventChoice = useCallback((eventId: string, choiceIndex: number, targetCountryId: string) => {
    if (!state) return;
    const newState = structuredClone(state);
    resolveEventChoice(newState, eventId, choiceIndex, targetCountryId);
    updateState(newState);
  }, [state, updateState]);

  const handleBudgetChange = useCallback((budget: BudgetAllocation) => {
    if (!state) return;
    setState({ ...state, budget });
  }, [state]);

  const handleTaxChange = useCallback((corporateTaxRate: number, incomeTaxRate: number) => {
    if (!state) return;
    setState({ ...state, corporateTaxRate, incomeTaxRate });
  }, [state]);

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
  }, [state, facilityConfirm, updateState]);

  const handleCancelFacilityBuild = useCallback(() => {
    setFacilityConfirm(null);
  }, []);

  const pendingEvent = state?.activeEvents.find(
    e => !e.resolved && (!e.targetCountryId || e.targetCountryId === state.playerCountryId)
  );
  const pendingEventData = pendingEvent ? getEventById(pendingEvent.eventId) : null;

  if (screen === 'title') {
    return (
      <TitleScreen
        saveSummary={saveSummary}
        onNewGame={() => setScreen('mode')}
        onOpenSaves={() => setScreen('saves')}
      />
    );
  }

  if (screen === 'saves') {
    return (
      <SaveSelect
        saves={listSaveSummaries()}
        onBack={() => setScreen('title')}
        onLoad={() => loadSaved()}
        onDelete={() => handleDeleteSave()}
      />
    );
  }

  if (screen === 'mode') {
    return (
      <ModeSelect
        onBack={() => setScreen('title')}
        onSelectCampaign={() => setScreen('campaigns')}
      />
    );
  }

  if (screen === 'campaigns') {
    return (
      <CampaignSelect
        onBack={() => setScreen('mode')}
        onSelectUsa={startUsaCampaign}
      />
    );
  }

  // Nation select retained for future Sandbox unlock; not in current player flow
  if (screen === 'nation') {
    return (
      <NationSelect
        gameMode={pendingMode}
        onSelect={(id) => startGame(id, pendingMode)}
        onBack={() => setScreen('mode')}
      />
    );
  }

  if (!state) return null;

  if (state.gameOver || state.playerWon) {
    return (
      <EndScreen
        state={state}
        onReturnToTitle={returnToTitle}
        onNewGame={() => {
          setState(null);
          setScreen('mode');
          refreshSaveMeta();
        }}
      />
    );
  }

  const cutsceneOpen = hasBlockingCutscene(state);
  const peerChoiceOpen = Boolean(
    state.usaCampaign?.peerChoicePending &&
      state.usaCampaign.briefAcknowledged &&
      !cutsceneOpen
  );
  const deferTheaterNotice = cutsceneOpen || peerChoiceOpen || Boolean(
    state.usaCampaign && !state.usaCampaign.briefAcknowledged
  );

  return (
    <div className="game-layout">
      {cutsceneOpen && (
        <CutsceneModal state={state} onUpdate={updateState} />
      )}
      {peerChoiceOpen && (
        <PeerChoiceModal state={state} onConfirm={updateState} />
      )}
      <GameHeader
        state={state}
        endTurnDisabled={cutsceneOpen}
        onEndTurn={endTurn}
        onOpenDiplomacy={() => {
          setShowMission(false);
          setShowDiplomacy(true);
          setShowEconomy(false);
          setShowTheater(false);
        }}
        onOpenEconomy={() => {
          setShowMission(false);
          setShowEconomy(true);
          setShowDiplomacy(false);
          setShowTheater(false);
        }}
        onOpenTheater={() => {
          setTheaterFocusId(undefined);
          setShowTheater(true);
          setShowDiplomacy(false);
          setShowEconomy(false);
          setShowMission(false);
        }}
        onOpenMission={
          state.usaCampaign
            ? () => {
                setShowMission(true);
                setShowDiplomacy(false);
                setShowEconomy(false);
                setShowTheater(false);
              }
            : undefined
        }
        onSave={handleSave}
      />

      <div className="game-body">
        <main className="game-main">
          {showTheater ? (
            <WarTheaterScreen
              state={state}
              initialTheaterId={theaterFocusId}
              onClose={() => { setShowTheater(false); setTheaterFocusId(undefined); }}
              onUpdate={updateState}
            />
          ) : state.selectedMapTier === 1 ? (
            isMobile ? (
              mobileWorldView === 'chooser' ? (
                <HemisphereChooser
                  state={state}
                  onSelect={(hemisphere) => setMobileWorldView(hemisphere)}
                />
              ) : (
                <WorldMap
                  state={state}
                  hemisphere={mobileWorldView}
                  onCountryClick={handleCountryClick}
                  onBack={() => setMobileWorldView('chooser')}
                />
              )
            ) : (
              <WorldMap state={state} onCountryClick={handleCountryClick} />
            )
          ) : state.selectedCountryId ? (
            <>
              <NationalMap
                state={state}
                countryId={state.selectedCountryId}
                onBack={handleBackToWorld}
                onRegionClick={handleRegionClick}
                backLabel={isMobile ? '← Back' : '← World Map'}
              />
              <LayerTray
                visibleLayers={state.visibleLayers}
                showDefenseRanges={state.showDefenseRanges}
                onToggleLayer={(layer) => {
                  const visible = state.visibleLayers.includes(layer)
                    ? state.visibleLayers.filter(l => l !== layer)
                    : [...state.visibleLayers, layer];
                  setState({ ...state, visibleLayers: visible });
                }}
                onToggleDefenseRanges={() =>
                  setState({ ...state, showDefenseRanges: !state.showDefenseRanges })
                }
              />
            </>
          ) : null}

          {state.selectedRegionId && (
            <RegionActionPanel
              state={state}
              regionId={state.selectedRegionId}
              onClose={() => setState({ ...state, selectedRegionId: null })}
              onRequestStrike={handleRequestStrike}
              onRequestCampaign={handleRequestCampaign}
              onCancelCampaign={handleCancelCampaign}
              onBuildFacility={handleRequestFacilityBuild}
            />
          )}
        </main>

        <SidePanel
          state={state}
          open={showSidePanel}
          onToggle={() => setShowSidePanel(!showSidePanel)}
          onDeclareWar={handleRequestWar}
          onInstallClient={handleInstallClient}
          onFocusCountry={handleCountryClick}
        />
      </div>

      {feedback && <div className="toast">{feedback}</div>}

      {showDiplomacy && (
        <DiplomacyPanel
          state={state}
          onClose={() => setShowDiplomacy(false)}
          onRequestWar={handleRequestWar}
          onPressAction={handlePressAction}
          onProposePeace={handleProposePeace}
          onNegotiate={handleNegotiate}
          onCovertNegotiate={handleCovertNegotiate}
          onCovertOp={handleCovertOp}
          onProbePacts={handleProbePacts}
          onExecuteMechanic={handleMechanic}
          onInstallClient={handleInstallClient}
          onFocusCountry={handleCountryClick}
          onOpenTheater={(theaterId) => {
            setTheaterFocusId(theaterId);
            setShowTheater(true);
            setShowDiplomacy(false);
          }}
          feedback={feedback}
          talksResult={talksResult}
        />
      )}
      {showMission && state.usaCampaign && (
        <BottomSheet onClose={() => setShowMission(false)} className="mission-sheet-panel">
          <div className="panel-header">
            <h3>Campaign Mission</h3>
            <button type="button" className="btn-close" onClick={() => setShowMission(false)}>
              ×
            </button>
          </div>
          <CampaignMissionPanel
            state={state}
            onDeclareWar={(id) => {
              setShowMission(false);
              handleRequestWar(id);
            }}
            onInstallClient={(id) => {
              handleInstallClient(id);
            }}
            onFocusTarget={(id) => {
              setShowMission(false);
              handleCountryClick(id);
            }}
          />
        </BottomSheet>
      )}
      {state &&
        (state.pendingTheaterNotices?.length ?? 0) > 0 &&
        !showTheater &&
        !deferTheaterNotice && (
        <WarTheaterNoticeModal
          state={state}
          onDismiss={updateState}
          onOpenTheater={(theaterId) => {
            setTheaterFocusId(theaterId);
            setShowTheater(true);
            setShowDiplomacy(false);
            setShowMission(false);
          }}
        />
      )}
      {turnSummary && state && (
        <TurnSummaryModal
          turn={state.turn}
          entries={turnSummary}
          onClose={() => setTurnSummary(null)}
        />
      )}
      {strikeConfirm && state && (() => {
        const preview = strikeConfirm.kind === 'strike'
          ? getStrikeConfirmPreview(state, strikeConfirm.regionId, strikeConfirm.strikeType)
          : getCampaignConfirmPreview(
              state,
              strikeConfirm.sourceRegionId,
              strikeConfirm.targetRegionId,
              strikeConfirm.strikeType
            );
        if (!preview) return null;
        return (
          <StrikeConfirmModal
            preview={preview}
            onConfirm={handleConfirmStrike}
            onCancel={handleCancelStrike}
          />
        );
      })()}
      {facilityConfirm && state && (() => {
        const preview = getFacilityConfirmPreview(
          state,
          facilityConfirm.regionId,
          facilityConfirm.facilityType
        );
        if (!preview) return null;
        return (
          <FacilityConfirmModal
            preview={preview}
            onConfirm={handleConfirmFacilityBuild}
            onCancel={handleCancelFacilityBuild}
          />
        );
      })()}
      {warConfirmTarget && (
        <WarConfirmModal
          preview={getWarDeclarationPreview(state, state.playerCountryId, warConfirmTarget)}
          onConfirm={handleConfirmWar}
          onCancel={handleCancelWar}
        />
      )}
      {showEconomy && (
        <EconomyPanel
          state={state}
          onBudgetChange={handleBudgetChange}
          onTaxChange={handleTaxChange}
          onDomesticSplitChange={handleDomesticSplitChange}
          onInvestMilitary={handleInvestMilitary}
          onDomesticPropaganda={handleDomesticPropaganda}
          onForeignInfluence={handleForeignInfluence}
          onClose={() => setShowEconomy(false)}
          feedback={feedback}
        />
      )}
      {showNationIntro && (
        <NationIntroModal
          state={state}
          onContinue={() => setShowNationIntro(false)}
        />
      )}

      {pendingEventData && pendingEvent && (
        <EventModal
          event={pendingEventData}
          activeEvent={pendingEvent}
          onChoice={(i) => handleEventChoice(pendingEvent.eventId, i, pendingEvent.targetCountryId ?? state.playerCountryId)}
        />
      )}

      {isMobile && (
        <nav className="mobile-action-bar">
          <button
            className={showEconomy ? 'active' : ''}
            onClick={() => { setShowEconomy(true); setShowDiplomacy(false); }}
          >
            💰 Economy
          </button>
          <button
            className={showDiplomacy ? 'active' : ''}
            onClick={() => { setShowDiplomacy(true); setShowEconomy(false); }}
          >
            🤝 Diplomacy
          </button>
          <button
            className={showSidePanel ? 'active' : ''}
            onClick={() => setShowSidePanel(!showSidePanel)}
          >
            📊 Intel
          </button>
          <button
            className="mobile-end-turn"
            onClick={endTurn}
            disabled={cutsceneOpen}
          >
            End Turn ▶
          </button>
        </nav>
      )}
    </div>
  );
}

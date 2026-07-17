import { useState, useCallback, lazy, Suspense } from 'react';
import type {
  GameState,
  GameMode,
  TurnReportEntry,
} from './types/game';
import { createInitialState, advanceTurn } from './engine/gameState';
import { saveGame, loadGame, peekSaveSummary, listSaveSummaries, deleteSave } from './engine/saveLoad';
import { getEventById } from './data/events';
import { getWarDeclarationPreview } from './engine/actions';
import { getFacilityConfirmPreview } from './engine/facilities';
import { getStrikeConfirmPreview, getCampaignConfirmPreview } from './engine/strikePreview';
import { TitleScreen } from './components/TitleScreen';
import { ModeSelect } from './components/ModeSelect';
import { CampaignSelect } from './components/CampaignSelect';
import { SaveSelect } from './components/SaveSelect';
import { EndScreen } from './components/EndScreen';
import { NationSelect } from './components/NationSelect';
import { GameHeader } from './components/GameHeader';
import { WorldMap } from './components/WorldMap';
import { NationalMap } from './components/NationalMap';
import { LayerTray } from './components/LayerTray';
import { WarConfirmModal } from './components/WarConfirmModal';
import { StrikeConfirmModal } from './components/StrikeConfirmModal';
import { FacilityConfirmModal } from './components/FacilityConfirmModal';
import { EventModal } from './components/EventModal';
import { RegionActionPanel } from './components/RegionActionPanel';
import { SidePanel } from './components/SidePanel';
import { TurnSummaryModal } from './components/TurnSummaryModal';
import { PeerChoiceModal } from './components/PeerChoiceModal';
import { NationIntroModal } from './components/NationIntroModal';
import { WarTheaterNoticeModal } from './components/WarTheaterNoticeModal';
import { CampaignMissionPanel } from './components/CampaignMissionPanel';
import { CutsceneModal } from './components/CutsceneModal';
import { BottomSheet } from './components/BottomSheet';
import { hasBlockingCutscene } from './data/cutscenes';
import { useMobileLayout } from './hooks/useMobileLayout';
import { useGameActions } from './hooks/useGameActions';
import './App.css';

// Lazily loaded: heavy, and not every playthrough opens them.
const DiplomacyPanel = lazy(() =>
  import('./components/DiplomacyPanel').then(m => ({ default: m.DiplomacyPanel }))
);
const EconomyPanel = lazy(() =>
  import('./components/EconomyPanel').then(m => ({ default: m.EconomyPanel }))
);
const WarTheaterScreen = lazy(() =>
  import('./components/WarTheaterScreen').then(m => ({ default: m.WarTheaterScreen }))
);

const PANEL_LOADING = <p className="muted panel-loading">Loading…</p>;

type Screen = 'title' | 'mode' | 'campaigns' | 'saves' | 'nation' | 'game';

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
  const [turnSummary, setTurnSummary] = useState<TurnReportEntry[] | null>(null);
  const [showNationIntro, setShowNationIntro] = useState(false);
  const [showTheater, setShowTheater] = useState(false);
  const [theaterFocusId, setTheaterFocusId] = useState<string | undefined>(undefined);
  const [showMission, setShowMission] = useState(false);
  const isMobile = useMobileLayout();

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

  const updateState = useCallback((newState: GameState) => {
    setState(newState);
    saveGame(newState);
    setSaveSummary(peekSaveSummary());
  }, []);

  const {
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
  } = useGameActions(state, updateState, setState);

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
    showFeedback(null);
    setShowNationIntro(false);
    refreshSaveMeta();
  }, [pendingMode, refreshSaveMeta, showFeedback]);

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
  }, [refreshSaveMeta, showFeedback]);

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
  }, [state, refreshSaveMeta, showFeedback]);

  const handleCountryClick = useCallback((countryId: string) => {
    if (!state) return;
    setState({
      ...state,
      selectedMapTier: 2,
      selectedCountryId: countryId,
      selectedRegionId: null,
    });
  }, [state]);

  const handleBackToWorld = useCallback(() => {
    if (!state) return;
    setState({ ...state, selectedMapTier: 1, selectedCountryId: null, selectedRegionId: null });
  }, [state]);

  const handleRegionClick = useCallback((regionId: string) => {
    if (!state) return;
    setState({ ...state, selectedRegionId: regionId });
  }, [state]);

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
        onSelectSandbox={() => {
          setPendingMode('sandbox');
          setScreen('nation');
        }}
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
            <Suspense fallback={PANEL_LOADING}>
              <WarTheaterScreen
                state={state}
                initialTheaterId={theaterFocusId}
                onClose={() => { setShowTheater(false); setTheaterFocusId(undefined); }}
                onUpdate={updateState}
              />
            </Suspense>
          ) : state.selectedMapTier === 1 ? (
            <WorldMap state={state} onCountryClick={handleCountryClick} />
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
        <Suspense fallback={PANEL_LOADING}>
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
        </Suspense>
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
        <Suspense fallback={PANEL_LOADING}>
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
        </Suspense>
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

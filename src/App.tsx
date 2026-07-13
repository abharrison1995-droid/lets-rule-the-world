import { useState, useCallback } from 'react';
import type { GameState, BudgetAllocation, MilitaryDev, DomesticSplit, PeaceTermsType } from './types/game';
import { createInitialState, advanceTurn } from './engine/gameState';
import { saveGame, loadGame, hasSavedGame, deleteSave } from './engine/saveLoad';
import { resolveEventChoice } from './engine/events';
import { getEventById } from './data/events';
import {
  playerDeclareWar,
  playerLaunchStrike,
  playerLaunchCovertOp,
  playerExecuteMechanic,
  playerInvestMilitary,
  getWarDeclarationPreview,
} from './engine/actions';
import { proposePeace } from './engine/peace';
import { playerDomesticPropaganda, playerForeignInfluence } from './engine/propaganda';
import { NationSelect } from './components/NationSelect';
import { GameHeader } from './components/GameHeader';
import { WorldMap } from './components/WorldMap';
import { HemisphereChooser } from './components/HemisphereChooser';
import { NationalMap } from './components/NationalMap';
import { LayerTray } from './components/LayerTray';
import { DiplomacyPanel } from './components/DiplomacyPanel';
import { WarConfirmModal } from './components/WarConfirmModal';
import { EconomyPanel } from './components/EconomyPanel';
import { EventModal } from './components/EventModal';
import { RegionActionPanel } from './components/RegionActionPanel';
import { SidePanel } from './components/SidePanel';
import { useMobileLayout } from './hooks/useMobileLayout';
import { getHemisphereForCountry, type HemisphereId } from './data/hemispheres';
import './App.css';

type Screen = 'menu' | 'game';

export default function App() {
  const [screen, setScreen] = useState<Screen>('menu');
  const [state, setState] = useState<GameState | null>(null);
  const [showDiplomacy, setShowDiplomacy] = useState(false);
  const [showEconomy, setShowEconomy] = useState(false);
  const [showSidePanel, setShowSidePanel] = useState(() =>
    typeof window !== 'undefined' ? !window.matchMedia('(max-width: 768px)').matches : true
  );
  const [saveExists, setSaveExists] = useState(hasSavedGame());
  const [feedback, setFeedback] = useState<string | null>(null);
  const [warConfirmTarget, setWarConfirmTarget] = useState<string | null>(null);
  const isMobile = useMobileLayout();
  const [mobileWorldView, setMobileWorldView] = useState<'chooser' | HemisphereId>('chooser');
  const [lastHemisphere, setLastHemisphere] = useState<HemisphereId>('eurasia');

  const showFeedback = (msg: string | null) => {
    setFeedback(msg);
    if (msg) setTimeout(() => setFeedback(null), 3000);
  };

  const updateState = useCallback((newState: GameState) => {
    setState(newState);
    saveGame(newState);
    setSaveExists(true);
  }, []);

  const startGame = useCallback((countryId: string) => {
    deleteSave();
    const newState = createInitialState(countryId);
    setState(newState);
    setScreen('game');
    setShowDiplomacy(false);
    setShowEconomy(false);
    setFeedback(null);
    setMobileWorldView('chooser');
    setLastHemisphere(getHemisphereForCountry(countryId));
  }, []);

  const loadSaved = useCallback(() => {
    const saved = loadGame<GameState>();
    if (saved) {
      setState(saved);
      setScreen('game');
    } else {
      showFeedback('Save file incompatible or missing.');
    }
  }, []);

  const endTurn = useCallback(() => {
    if (!state || state.gameOver || state.playerWon) return;
    const next = advanceTurn(state);
    updateState(next);
  }, [state, updateState]);

  const handleSave = useCallback(() => {
    if (state) {
      saveGame(state);
      setSaveExists(true);
      showFeedback('Game saved.');
    }
  }, [state]);

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

  const handleStrike = useCallback((regionId: string) => {
    if (!state) return;
    const newState = structuredClone(state);
    const err = playerLaunchStrike(newState, regionId);
    if (err) showFeedback(err);
    else updateState(newState);
  }, [state, updateState]);

  const handleRequestWar = useCallback((targetId: string) => {
    setWarConfirmTarget(targetId);
  }, []);

  const handleConfirmWar = useCallback(() => {
    if (!state || !warConfirmTarget) return;
    const newState = structuredClone(state);
    const err = playerDeclareWar(newState, warConfirmTarget);
    setWarConfirmTarget(null);
    if (err) showFeedback(err);
    else updateState(newState);
  }, [state, warConfirmTarget, updateState]);

  const handleCancelWar = useCallback(() => {
    setWarConfirmTarget(null);
  }, []);

  const handleProposePeace = useCallback((targetId: string, terms: PeaceTermsType) => {
    if (!state) return;
    const newState = structuredClone(state);
    const result = proposePeace(newState, targetId, terms);
    showFeedback(result.message);
    if (result.accepted) updateState(newState);
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

  const handleEventChoice = useCallback((eventId: string, choiceIndex: number) => {
    if (!state) return;
    const newState = structuredClone(state);
    resolveEventChoice(newState, eventId, choiceIndex, state.playerCountryId);
    updateState(newState);
  }, [state, updateState]);

  const handleBudgetChange = useCallback((budget: BudgetAllocation) => {
    if (!state) return;
    setState({ ...state, budget });
  }, [state]);

  const pendingEvent = state?.activeEvents.find(e => !e.resolved);
  const pendingEventData = pendingEvent ? getEventById(pendingEvent.eventId) : null;

  if (screen === 'menu') {
    return <NationSelect onSelect={startGame} onLoad={loadSaved} hasSave={saveExists} />;
  }

  if (!state) return null;

  if (state.gameOver) {
    return (
      <div className="game-over-screen">
        <h1>Game Over</h1>
        <p>{state.gameOverReason}</p>
        <p>Survived {state.turn} turns.</p>
        <button onClick={() => { setScreen('menu'); setState(null); }}>Return to Menu</button>
      </div>
    );
  }

  if (state.playerWon) {
    return (
      <div className="game-over-screen victory">
        <h1>Victory!</h1>
        <p>{state.winReason}</p>
        <p>Completed in {state.turn} turns.</p>
        <button onClick={() => { setScreen('menu'); setState(null); }}>Return to Menu</button>
      </div>
    );
  }

  return (
    <div className="game-layout">
      <GameHeader
        state={state}
        onEndTurn={endTurn}
        onOpenDiplomacy={() => { setShowDiplomacy(true); setShowEconomy(false); }}
        onOpenEconomy={() => { setShowEconomy(true); setShowDiplomacy(false); }}
        onSave={handleSave}
      />

      <div className="game-body">
        <main className="game-main">
          {state.selectedMapTier === 1 ? (
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
              onStrike={handleStrike}
              onClosePanel={() => setState({ ...state, selectedRegionId: null })}
            />
          )}
        </main>

        <SidePanel state={state} open={showSidePanel} onToggle={() => setShowSidePanel(!showSidePanel)} />
      </div>

      {feedback && <div className="toast">{feedback}</div>}

      {showDiplomacy && (
        <DiplomacyPanel
          state={state}
          onClose={() => setShowDiplomacy(false)}
          onRequestWar={handleRequestWar}
          onProposePeace={handleProposePeace}
          onCovertOp={handleCovertOp}
          onExecuteMechanic={handleMechanic}
          feedback={feedback}
        />
      )}
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
          onDomesticSplitChange={handleDomesticSplitChange}
          onInvestMilitary={handleInvestMilitary}
          onDomesticPropaganda={handleDomesticPropaganda}
          onForeignInfluence={handleForeignInfluence}
          onClose={() => setShowEconomy(false)}
          feedback={feedback}
        />
      )}
      {pendingEventData && (
        <EventModal
          event={pendingEventData}
          onChoice={(i) => handleEventChoice(pendingEvent!.eventId, i)}
        />
      )}
    </div>
  );
}

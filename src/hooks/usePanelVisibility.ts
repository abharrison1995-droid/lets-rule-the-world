import { useState } from 'react';

/**
 * Which side panels/modals are open, plus which war theater is focused.
 * Pure state — call sites keep composing their own open/close combinations
 * (header buttons and the mobile action bar intentionally close different
 * subsets of panels; that's existing behavior, preserved as-is here).
 */
export function usePanelVisibility() {
  const [showDiplomacy, setShowDiplomacy] = useState(false);
  const [showEconomy, setShowEconomy] = useState(false);
  const [showSidePanel, setShowSidePanel] = useState(() =>
    typeof window !== 'undefined' ? !window.matchMedia('(max-width: 768px)').matches : true
  );
  const [showNationIntro, setShowNationIntro] = useState(false);
  const [showTheater, setShowTheater] = useState(false);
  const [theaterFocusId, setTheaterFocusId] = useState<string | undefined>(undefined);
  const [showMission, setShowMission] = useState(false);

  return {
    showDiplomacy, setShowDiplomacy,
    showEconomy, setShowEconomy,
    showSidePanel, setShowSidePanel,
    showNationIntro, setShowNationIntro,
    showTheater, setShowTheater,
    theaterFocusId, setTheaterFocusId,
    showMission, setShowMission,
  };
}

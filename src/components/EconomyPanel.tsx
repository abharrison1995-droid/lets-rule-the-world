import { useState } from 'react';
import type { GameState, BudgetAllocation, MilitaryDev, DomesticSplit } from '../types/game';
import { formatGDP, formatPercent } from '../engine/gameState';
import { normalizeBudget } from '../engine/economy';
import { normalizeDomesticSplit } from '../engine/propaganda';
import { BottomSheet } from './BottomSheet';

interface EconomyPanelProps {
  state: GameState;
  onBudgetChange: (budget: BudgetAllocation) => void;
  onDomesticSplitChange: (split: DomesticSplit) => void;
  onInvestMilitary: (category: keyof MilitaryDev) => void;
  onDomesticPropaganda: () => void;
  onForeignInfluence: (targetId: string) => void;
  onClose: () => void;
  feedback: string | null;
}

const BUDGET_LABELS: Record<keyof BudgetAllocation, string> = {
  military: 'Military',
  diplomacy: 'Diplomacy / Soft Power',
  domestic: 'Domestic / Propaganda',
  covert: 'Covert Ops',
  reserve: 'Reserve (War Chest)',
};

const MIL_LABELS: Record<keyof MilitaryDev, string> = {
  troopQuality: 'Troop Quality',
  missileDefense: 'Missile Defense',
  droneProgram: 'Drone Program',
  strikeCapability: 'Strike Capability',
  fortification: 'Fortification',
};

const DOMESTIC_LABELS: Record<keyof DomesticSplit, string> = {
  propaganda: 'Propaganda',
  counterIntel: 'Counter-Intelligence',
  services: 'Public Services',
};

export function EconomyPanel({
  state,
  onBudgetChange,
  onDomesticSplitChange,
  onInvestMilitary,
  onDomesticPropaganda,
  onForeignInfluence,
  onClose,
  feedback,
}: EconomyPanelProps) {
  const country = state.countries[state.playerCountryId];
  const [influenceTarget, setInfluenceTarget] = useState('');
  if (!country) return null;

  const total = Object.values(state.budget).reduce((s, v) => s + v, 0);

  const handleChange = (key: keyof BudgetAllocation, value: number) => {
    onBudgetChange(normalizeBudget({ ...state.budget, [key]: value / 100 }));
  };

  const handleDomesticChange = (key: keyof DomesticSplit, value: number) => {
    onDomesticSplitChange(
      normalizeDomesticSplit({ ...state.domesticSplit, [key]: value / 100 })
    );
  };

  return (
    <BottomSheet onClose={onClose} className="economy-panel">
      <div className="panel-header">
        <h3>Economy & Budget</h3>
        <button className="btn-close" onClick={onClose}>×</button>
      </div>

      {feedback && <p className="feedback-msg">{feedback}</p>}

      <div className="stat-grid">
        <div className="stat-item">
          <span className="stat-label">GDP</span>
          <span className="stat-value">{formatGDP(country.stats.gdp)}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Reserve</span>
          <span className="stat-value">${state.reserveFunds.toFixed(0)}B</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Counter-Intel</span>
          <span className="stat-value">{formatPercent(state.counterIntelLevel)}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Propaganda Sat.</span>
          <span className="stat-value">{formatPercent(country.stats.propagandaSaturation)}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">War Popularity</span>
          <span className="stat-value">{formatPercent(country.stats.warPopularity)}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Morale</span>
          <span className="stat-value">{formatPercent(country.stats.moraleBase)}</span>
        </div>
      </div>

      <section className="panel-section">
        <h4>Budget Allocation {Math.abs(total - 1) > 0.01 && <span className="warning">({formatPercent(total)})</span>}</h4>
        {(Object.keys(BUDGET_LABELS) as Array<keyof BudgetAllocation>).map(key => (
          <div key={key} className="budget-slider">
            <label>{BUDGET_LABELS[key]}</label>
            <input type="range" min="0" max="60" value={Math.round(state.budget[key] * 100)} onChange={e => handleChange(key, Number(e.target.value))} />
            <span className="budget-pct">{Math.round(state.budget[key] * 100)}%</span>
          </div>
        ))}
      </section>

      <section className="panel-section">
        <h4>Domestic Sub-Allocation</h4>
        <p className="muted small">Splits your domestic budget between propaganda, counter-intel, and services.</p>
        {(Object.keys(DOMESTIC_LABELS) as Array<keyof DomesticSplit>).map(key => (
          <div key={key} className="budget-slider">
            <label>{DOMESTIC_LABELS[key]}</label>
            <input type="range" min="0" max="80" value={Math.round(state.domesticSplit[key] * 100)} onChange={e => handleDomesticChange(key, Number(e.target.value))} />
            <span className="budget-pct">{Math.round(state.domesticSplit[key] * 100)}%</span>
          </div>
        ))}
      </section>

      <section className="panel-section">
        <h4>Propaganda Actions</h4>
        <button className="btn-action" onClick={onDomesticPropaganda}>
          📢 Domestic Propaganda Campaign ($15B)
        </button>
        <p className="muted small">Boosts war popularity & morale. Diminishing returns when saturation is high.</p>
        <select className="target-select" value={influenceTarget} onChange={e => setInfluenceTarget(e.target.value)}>
          <option value="">Foreign influence target...</option>
          {Object.values(state.countries)
            .filter(c => c.id !== state.playerCountryId)
            .map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button className="btn-action" disabled={!influenceTarget} onClick={() => influenceTarget && onForeignInfluence(influenceTarget)}>
          🌐 Foreign Influence Campaign ($20B)
        </button>
      </section>

      <section className="panel-section">
        <h4>Military Development ($40B per upgrade)</h4>
        <div className="mil-dev-grid">
          {(Object.keys(MIL_LABELS) as Array<keyof MilitaryDev>).map(key => {
            const val = country.militaryDev[key];
            return (
              <div key={key} className="mil-dev-item">
                <span>{MIL_LABELS[key]}</span>
                <div className="mil-dev-bar">
                  {Array.from({ length: 5 }, (_, i) => (
                    <div key={i} className={`mil-dev-pip ${i < val ? 'filled' : ''}`} />
                  ))}
                </div>
                <button className="btn-small" disabled={val >= 5} onClick={() => onInvestMilitary(key)}>+1</button>
              </div>
            );
          })}
        </div>
      </section>
    </BottomSheet>
  );
}
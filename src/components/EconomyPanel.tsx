import { useState } from 'react';
import type { GameState, BudgetAllocation, MilitaryDev, DomesticSplit } from '../types/game';
import { formatPercent } from '../engine/gameState';
import { normalizeBudget } from '../engine/economy';
import { normalizeDomesticSplit } from '../engine/propaganda';
import { BottomSheet } from './BottomSheet';
import { getFiscalHeadroom } from '../engine/fiscal';
import { getProjectedPlayerIncome } from '../engine/taxation';
import {
  getPendingMilitaryUpgrade,
  getTurnsUntilMilitaryUpgrade,
  MIL_UPGRADE_TURNS,
  MIL_CATEGORY_LABELS,
} from '../engine/militaryDevUpgrades';
import {
  formatDisplayGDP,
  formatDisplayDebt,
  formatDebtRatio,
  formatDisplayCost,
} from '../engine/treasuryDisplay';

interface EconomyPanelProps {
  state: GameState;
  onBudgetChange: (budget: BudgetAllocation) => void;
  onDomesticSplitChange: (split: DomesticSplit) => void;
  onTaxChange: (corporateTax: number, incomeTax: number) => void;
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
  onTaxChange,
  onInvestMilitary,
  onDomesticPropaganda,
  onForeignInfluence,
  onClose,
  feedback,
}: EconomyPanelProps) {
  const country = state.countries[state.playerCountryId];
  const [influenceTarget, setInfluenceTarget] = useState('');
  if (!country) return null;

  const headroom = getFiscalHeadroom(country);
  const debt = country.debtToGdp ?? 0;
  const projectedIncome = getProjectedPlayerIncome(state);
  const corporateTax = state.corporateTaxRate ?? 0.22;
  const incomeTax = state.incomeTaxRate ?? 0.25;
  const milUpgrade = getPendingMilitaryUpgrade(state);
  const milUpgradeBusy = milUpgrade !== null;

  const total = Object.values(state.budget).reduce((s, v) => s + v, 0);

  const handleChange = (key: keyof BudgetAllocation, value: number) => {
    onBudgetChange(normalizeBudget({ ...state.budget, [key]: value / 100 }));
  };

  const handleDomesticChange = (key: keyof DomesticSplit, value: number) => {
    onDomesticSplitChange(
      normalizeDomesticSplit({ ...state.domesticSplit, [key]: value / 100 })
    );
  };

  const govLabel =
    country.governmentType === 'democratic'
      ? 'democratic'
      : country.governmentType === 'autocratic'
        ? 'autocratic'
        : 'hybrid';

  return (
    <BottomSheet onClose={onClose} className="economy-panel">
      <div className="panel-header">
        <h3>Economy & Budget</h3>
        <button className="btn-close" onClick={onClose}>×</button>
      </div>

      {feedback && <p className="feedback-msg">{feedback}</p>}

      <div className="stat-grid">
        <div className="stat-item">
          <span className="stat-label">Treasury</span>
          <span className="stat-value">{formatDisplayGDP(country.stats.treasuryPoints)}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Income / Turn</span>
          <span className="stat-value positive-text">+{formatDisplayGDP(projectedIncome)}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Spendable</span>
          <span className="stat-value">{formatDisplayGDP(headroom)}</span>
        </div>
        {debt > 0 && (
          <div className="stat-item">
            <span className="stat-label">National Debt</span>
            <span className="stat-value warning-text">
              {formatDebtRatio(debt)} ({formatDisplayDebt(country.stats.treasuryPoints, debt)})
            </span>
          </div>
        )}
        <div className="stat-item">
          <span className="stat-label">Counter-Intel</span>
          <span className="stat-value">{formatPercent(state.counterIntelLevel)}</span>
        </div>
        <div className="stat-item">
          <span className="stat-label">Morale</span>
          <span className="stat-value">{formatPercent(country.stats.moraleBase)}</span>
        </div>
        {(state.taxPressureTurns ?? 0) > 0 && (
          <div className="stat-item">
            <span className="stat-label">Tax Pressure</span>
            <span className="stat-value warning-text">{state.taxPressureTurns} turns</span>
          </div>
        )}
      </div>

      <section className="panel-section">
        <h4>Taxation</h4>
        <p className="muted small">
          Corporate tax funds the treasury but slows growth when high. Income tax raises revenue but erodes morale and can trigger unrest in {govLabel} states.
        </p>
        <div className="budget-slider">
          <label>Corporate Tax</label>
          <input
            type="range"
            min="5"
            max="55"
            value={Math.round(corporateTax * 100)}
            onChange={e => onTaxChange(Number(e.target.value) / 100, incomeTax)}
          />
          <span className="budget-pct">{Math.round(corporateTax * 100)}%</span>
        </div>
        <div className="budget-slider">
          <label>Income Tax</label>
          <input
            type="range"
            min="5"
            max="55"
            value={Math.round(incomeTax * 100)}
            onChange={e => onTaxChange(corporateTax, Number(e.target.value) / 100)}
          />
          <span className="budget-pct">{Math.round(incomeTax * 100)}%</span>
        </div>
      </section>

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
          📢 Domestic Propaganda Campaign ({formatDisplayCost(3)})
        </button>
        <p className="muted small">Boosts war popularity & morale. Diminishing returns when saturation is high.</p>
        <select className="target-select" value={influenceTarget} onChange={e => setInfluenceTarget(e.target.value)}>
          <option value="">Foreign influence target...</option>
          {Object.values(state.countries)
            .filter(c => c.id !== state.playerCountryId)
            .map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button className="btn-action" disabled={!influenceTarget} onClick={() => influenceTarget && onForeignInfluence(influenceTarget)}>
          🌐 Foreign Influence Campaign ({formatDisplayCost(3)})
        </button>
      </section>

      <section className="panel-section">
        <h4>Military Development ({formatDisplayCost(7)} · {MIL_UPGRADE_TURNS} turns each)</h4>
        <p className="muted small">One upgrade at a time. Higher tiers take several turns to complete.</p>
        {milUpgrade && (
          <p className="warning-text">
            🏗 {MIL_CATEGORY_LABELS[milUpgrade.category]} in progress — {getTurnsUntilMilitaryUpgrade(state)} turn(s) left
          </p>
        )}
        <div className="mil-dev-grid">
          {(Object.keys(MIL_LABELS) as Array<keyof MilitaryDev>).map(key => {
            const val = country.militaryDev[key];
            const isUpgrading = milUpgrade?.category === key;
            return (
              <div key={key} className="mil-dev-item">
                <span>{MIL_LABELS[key]}</span>
                <div className="mil-dev-bar">
                  {Array.from({ length: 5 }, (_, i) => (
                    <div key={i} className={`mil-dev-pip ${i < val ? 'filled' : ''} ${isUpgrading && i === val ? 'pending' : ''}`} />
                  ))}
                </div>
                <button
                  className="btn-small"
                  disabled={val >= 5 || milUpgradeBusy}
                  onClick={() => onInvestMilitary(key)}
                >
                  {isUpgrading ? '…' : '+1'}
                </button>
              </div>
            );
          })}
        </div>
      </section>
    </BottomSheet>
  );
}

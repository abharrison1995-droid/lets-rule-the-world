import type { SpendFiscalPreview } from '../engine/fiscal';
import { formatDisplayGDP } from '../engine/treasuryDisplay';

function formatDebtTrend(delta: number): string {
  const pct = (delta * 100).toFixed(2);
  return `${delta > 0 ? '+' : ''}${pct}% GDP/turn`;
}

interface FiscalImpactLineProps {
  fiscal: SpendFiscalPreview | null;
}

export function FiscalImpactLine({ fiscal }: FiscalImpactLineProps) {
  if (!fiscal) return null;

  const debtShift =
    Math.abs(fiscal.debtDeltaAfter - fiscal.debtDeltaNow) > 0.00005
      ? ` · Debt trend ${formatDebtTrend(fiscal.debtDeltaNow)} → ${formatDebtTrend(fiscal.debtDeltaAfter)}`
      : fiscal.debtDeltaAfter > 0.0005
        ? ` · Debt trend ${formatDebtTrend(fiscal.debtDeltaAfter)}`
        : '';

  return (
    <p className="fiscal-impact-line muted small">
      Treasury after: <strong>{formatDisplayGDP(fiscal.treasuryAfter)}</strong>
      {debtShift}
    </p>
  );
}

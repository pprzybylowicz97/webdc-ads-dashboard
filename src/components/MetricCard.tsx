import { clsx } from 'clsx';

import { formatChange } from '@/lib/format';

interface MetricCardProps {
  label: string;
  value: string;
  /** Zmiana vs okres porównawczy, w procentach. */
  change?: number | null;
  /**
   * Czy wzrost jest dobry. Dla kosztu na konwersję jest odwrotnie niż dla CTR,
   * więc kierunek musi podać wywołujący — kolor nie może zgadywać.
   */
  higherIsBetter?: boolean;
  hint?: string;
}

export function MetricCard({
  label,
  value,
  change,
  higherIsBetter = true,
  hint,
}: MetricCardProps) {
  const isGood =
    change === null || change === undefined || change === 0
      ? null
      : change > 0 === higherIsBetter;

  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-xs font-medium text-text-muted uppercase">{label}</p>
      <p className="tabular mt-2 text-2xl font-semibold">{value}</p>

      {change !== undefined && (
        <p
          className={clsx(
            'tabular mt-1 text-sm',
            isGood === null && 'text-text-muted',
            isGood === true && 'text-positive',
            isGood === false && 'text-negative',
          )}
        >
          {formatChange(change ?? null)}
          <span className="ml-1 text-text-muted">vs poprzedni okres</span>
        </p>
      )}

      {hint && <p className="mt-2 text-xs text-text-muted">{hint}</p>}
    </div>
  );
}

'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

import { CampaignTable } from './CampaignTable';
import { MetricCard } from './MetricCard';
import type { AdsAccount } from '@/lib/accounts';
import {
  DATE_RANGE_DAYS,
  DATE_RANGE_LABELS,
  DATE_RANGES,
  type Campaign,
  type DateRange,
} from '@/lib/ads/types';
import {
  deriveMetrics,
  hasRealConversionValue,
  percentChange,
  subtractMetrics,
  sumMetrics,
} from '@/lib/metrics';
import {
  formatCurrency,
  formatNumber,
  formatOptional,
  formatPercent,
} from '@/lib/format';

interface ApiResponse {
  accountLabel: string;
  currency: string;
  provider: string;
  fetchedAt: string;
  campaigns: Campaign[];
  baselineCampaigns: Campaign[] | null;
}

interface DashboardProps {
  accounts: readonly AdsAccount[];
  defaultAccountId: string;
}

export function Dashboard({ accounts, defaultAccountId }: DashboardProps) {
  const [accountId, setAccountId] = useState(defaultAccountId);
  const [range, setRange] = useState<DateRange>('LAST_7_DAYS');
  const [data, setData] = useState<ApiResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        account: accountId,
        range,
        compare: '1',
      });
      const response = await fetch(`/api/campaigns?${params}`);
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error ?? `Błąd ${response.status}`);
      }
      setData(body as ApiResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się pobrać danych.');
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [accountId, range]);

  useEffect(() => {
    void load();
  }, [load]);

  const totals = data ? sumMetrics(data.campaigns) : null;
  const derived = totals ? deriveMetrics(totals) : null;

  // Okres porównawczy: 30 dni minus wybrane okno. Sensowny tylko wtedy,
  // gdy wybrane okno jest krótsze niż baza — inaczej odejmowanie da zero.
  const baselineTotals =
    data?.baselineCampaigns && totals
      ? subtractMetrics(sumMetrics(data.baselineCampaigns), totals)
      : null;
  const previous = baselineTotals ? deriveMetrics(baselineTotals) : null;

  const conversionValueMissing =
    totals !== null && totals.conversions > 0 && !hasRealConversionValue(totals);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-text-muted uppercase">
            Konto
          </span>
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm"
          >
            {accounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.label}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-text-muted uppercase">
            Okres
          </span>
          <select
            value={range}
            onChange={(e) => setRange(e.target.value as DateRange)}
            className="rounded-md border border-border bg-surface px-3 py-2 text-sm"
          >
            {DATE_RANGES.map((r) => (
              <option key={r} value={r}>
                {DATE_RANGE_LABELS[r]}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm disabled:opacity-50"
        >
          <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} />
          Odśwież
        </button>
      </div>

      {error && (
        <div className="rounded-lg border border-negative/40 bg-surface p-4 text-sm">
          <p className="font-medium text-negative">Nie udało się pobrać danych</p>
          <p className="mt-1 text-text-muted">{error}</p>
        </div>
      )}

      {loading && !data && (
        <p className="text-sm text-text-muted">Pobieram dane…</p>
      )}

      {data && derived && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard
              label="Koszt"
              value={formatCurrency(derived.cost, data.currency)}
              change={
                previous ? percentChange(derived.cost, previous.cost) : undefined
              }
              // Sam wzrost kosztu nie jest ani dobry, ani zły — liczy się efekt,
              // więc kierunku tu nie oceniamy kolorem pozytywnym.
              higherIsBetter
            />
            <MetricCard
              label="CTR"
              value={formatPercent(derived.ctrPercent)}
              change={
                previous
                  ? percentChange(derived.ctrPercent, previous.ctrPercent)
                  : undefined
              }
              higherIsBetter
            />
            <MetricCard
              label="Konwersje"
              value={formatNumber(derived.conversions, 0)}
              change={
                previous
                  ? percentChange(derived.conversions, previous.conversions)
                  : undefined
              }
              higherIsBetter
            />
            <MetricCard
              label="Koszt / konwersję"
              value={formatOptional(derived.costPerConversion, (v) =>
                formatCurrency(v, data.currency),
              )}
              change={
                previous && derived.costPerConversion && previous.costPerConversion
                  ? percentChange(
                      derived.costPerConversion,
                      previous.costPerConversion,
                    )
                  : undefined
              }
              higherIsBetter={false}
            />
          </div>

          {conversionValueMissing && (
            <div className="flex gap-3 rounded-lg border border-warning/40 bg-surface p-4">
              <AlertTriangle className="size-5 shrink-0 text-warning" />
              <div className="text-sm">
                <p className="font-medium">Wartość konwersji nie jest śledzona</p>
                <p className="mt-1 text-text-muted">
                  Suma wartości konwersji równa się liczbie konwersji, czyli każda
                  ma przypisaną wartość 1 zamiast realnej kwoty sprzedaży. ROAS na
                  tym koncie nic nie mówi, dopóki nie podepniesz wartości
                  transakcji.
                </p>
              </div>
            </div>
          )}

          <CampaignTable
            campaigns={data.campaigns}
            currency={data.currency}
            days={DATE_RANGE_DAYS[range]}
          />

          <p className="text-xs text-text-muted">
            Źródło danych: {data.provider} · pobrano{' '}
            {new Date(data.fetchedAt).toLocaleString('pl-PL')}
          </p>
        </>
      )}
    </div>
  );
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Download, RefreshCw } from 'lucide-react';

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
  range: DateRange;
  fetchedAt: string;
  campaigns: Campaign[];
  baselineCampaigns: Campaign[] | null;
}

/** Parametry, dla których dane zostały już pobrane. */
interface LoadedParams {
  accountId: string;
  range: DateRange;
  compare: boolean;
}

interface DashboardProps {
  accounts: readonly AdsAccount[];
  defaultAccountId: string;
}

export function Dashboard({ accounts, defaultAccountId }: DashboardProps) {
  const [accountId, setAccountId] = useState(defaultAccountId);
  const [range, setRange] = useState<DateRange>('LAST_7_DAYS');
  const [compare, setCompare] = useState(false);

  const [data, setData] = useState<ApiResponse | null>(null);
  const [loadedParams, setLoadedParams] = useState<LoadedParams | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams({
        account: accountId,
        range,
        compare: compare ? '1' : '0',
      });
      const response = await fetch(`/api/campaigns?${params}`);
      const body = await response.json();

      if (!response.ok) {
        throw new Error(body.error ?? `Błąd ${response.status}`);
      }

      setData(body as ApiResponse);
      setLoadedParams({ accountId, range, compare });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Nie udało się pobrać danych.');
    } finally {
      setLoading(false);
    }
  }, [accountId, range, compare]);

  /*
   * Pobieramy automatycznie tylko raz, przy wejściu na stronę.
   *
   * Świadomie NIE reagujemy na zmianę selektorów: przy dostawcy `zapier` każde
   * pobranie kosztuje zadanie z miesięcznego limitu, a automatyczne odświeżanie
   * przy każdym kliknięciu w listę potrafi spalić kilkanaście zadań w minutę.
   * Zmiana ustawień oznacza dane jako nieaktualne i czeka na kliknięcie.
   */
  const didInitialLoad = useRef(false);
  useEffect(() => {
    if (didInitialLoad.current) return;
    didInitialLoad.current = true;
    void load();
  }, [load]);

  const isStale =
    loadedParams === null ||
    loadedParams.accountId !== accountId ||
    loadedParams.range !== range ||
    loadedParams.compare !== compare;

  const totals = data ? sumMetrics(data.campaigns) : null;
  const derived = totals ? deriveMetrics(totals) : null;

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

        <label className="flex items-center gap-2 py-2 text-sm">
          <input
            type="checkbox"
            checked={compare}
            onChange={(e) => setCompare(e.target.checked)}
            className="size-4"
          />
          Porównaj z poprzednim okresem
          <span className="text-xs text-text-muted">(2× zadania)</span>
        </label>

        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className={
            isStale
              ? 'flex items-center gap-2 rounded-md bg-accent px-3 py-2 text-sm font-medium text-white disabled:opacity-50'
              : 'flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm disabled:opacity-50'
          }
        >
          {isStale ? (
            <Download className="size-4" />
          ) : (
            <RefreshCw className={loading ? 'size-4 animate-spin' : 'size-4'} />
          )}
          {isStale ? 'Pobierz dane' : 'Odśwież'}
        </button>
      </div>

      <p className="text-xs text-text-muted">
        Każde pobranie zużywa {compare ? '2 zadania' : '1 zadanie'} Zapiera.
        Wyniki są cache&apos;owane przez 30 minut — ponowne pobranie tych samych
        ustawień w tym czasie jest darmowe.
      </p>

      {isStale && data && !loading && (
        <p className="rounded-lg border border-warning/40 bg-surface p-3 text-sm text-text-muted">
          Ustawienia zmienione. Poniżej wciąż widzisz dane dla:{' '}
          <strong>
            {accounts.find((a) => a.id === loadedParams?.accountId)?.label}
          </strong>
          , {loadedParams && DATE_RANGE_LABELS[loadedParams.range]}. Kliknij
          „Pobierz dane”, żeby zaktualizować.
        </p>
      )}

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
            />
            <MetricCard
              label="CTR"
              value={formatPercent(derived.ctrPercent)}
              change={
                previous
                  ? percentChange(derived.ctrPercent, previous.ctrPercent)
                  : undefined
              }
            />
            <MetricCard
              label="Konwersje"
              value={formatNumber(derived.conversions, 0)}
              change={
                previous
                  ? percentChange(derived.conversions, previous.conversions)
                  : undefined
              }
            />
            <MetricCard
              label="Koszt / konwersję"
              value={formatOptional(derived.costPerConversion, (v) =>
                formatCurrency(v, data.currency),
              )}
              change={
                previous &&
                derived.costPerConversion !== null &&
                previous.costPerConversion !== null
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
            days={DATE_RANGE_DAYS[data.range]}
          />

          <p className="text-xs text-text-muted">
            Źródło danych: {data.provider} · {data.accountLabel} ·{' '}
            {DATE_RANGE_LABELS[data.range]} · pobrano{' '}
            {new Date(data.fetchedAt).toLocaleString('pl-PL')}
          </p>
        </>
      )}
    </div>
  );
}

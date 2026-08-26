/**
 * Przeliczenia metryk. Czyste funkcje, zero I/O — cała logika liczbowa siedzi
 * tutaj, żeby dało się ją przetestować bez sieci i bez Reacta.
 *
 * Dwie pułapki Google Ads, które ta warstwa zamyka raz na zawsze:
 *  1. koszty są w mikrojednostkach (1 000 000 mikro = 1 zł),
 *  2. `ctr` to ułamek (0.0223), a nie procent — pomnożenie przez 100 w komponencie
 *     to klasyczne źródło raportów zawyżonych stukrotnie.
 */

import type { Campaign, RawMetrics } from './ads/types';

const MICROS_PER_UNIT = 1_000_000;

/** Mikrojednostki → waluta. */
export function fromMicros(micros: number): number {
  return micros / MICROS_PER_UNIT;
}

/** Dzielenie odporne na zero — zwraca null zamiast Infinity/NaN. */
function safeDivide(numerator: number, denominator: number): number | null {
  if (!denominator) return null;
  const result = numerator / denominator;
  return Number.isFinite(result) ? result : null;
}

/** Metryki po przeliczeniu, gotowe do pokazania. */
export interface DerivedMetrics {
  cost: number;
  impressions: number;
  clicks: number;
  conversions: number;
  /** Procent (2.23), nie ułamek. */
  ctrPercent: number;
  averageCpc: number | null;
  costPerConversion: number | null;
  /** Procent. Null, gdy brak kliknięć. */
  conversionRatePercent: number | null;
  /**
   * Null, gdy konto nie ma realnej wartości konwersji — patrz
   * `hasRealConversionValue`. Świadomie null, a nie 1.0: pokazanie ROAS = 1,0
   * sugerowałoby, że kampania wychodzi na zero, co byłoby nieprawdą.
   */
  roas: number | null;
}

/**
 * Czy konto ma skonfigurowaną realną wartość konwersji.
 *
 * Gdy `conversionsValue` równa się `conversions`, każda konwersja ma przypisaną
 * wartość 1 — czyli wartość sprzedaży nie jest w ogóle śledzona. Tak było na
 * koncie MODOhome (92 konwersje, wartość 92). ROAS jest wtedy bez znaczenia.
 */
export function hasRealConversionValue(metrics: RawMetrics): boolean {
  if (metrics.conversions === 0) return false;
  return Math.abs(metrics.conversionsValue - metrics.conversions) > 0.001;
}

export function deriveMetrics(metrics: RawMetrics): DerivedMetrics {
  const cost = fromMicros(metrics.costMicros);
  return {
    cost,
    impressions: metrics.impressions,
    clicks: metrics.clicks,
    conversions: metrics.conversions,
    ctrPercent: metrics.ctr * 100,
    averageCpc: metrics.averageCpcMicros
      ? fromMicros(metrics.averageCpcMicros)
      : safeDivide(cost, metrics.clicks),
    costPerConversion: safeDivide(cost, metrics.conversions),
    conversionRatePercent: (() => {
      const rate = safeDivide(metrics.conversions, metrics.clicks);
      return rate === null ? null : rate * 100;
    })(),
    roas: hasRealConversionValue(metrics)
      ? safeDivide(metrics.conversionsValue, cost)
      : null,
  };
}

/** Sumuje surowe metryki wielu kampanii do jednego zestawu na poziom konta. */
export function sumMetrics(campaigns: Campaign[]): RawMetrics {
  const total = campaigns.reduce(
    (acc, c) => ({
      costMicros: acc.costMicros + c.metrics.costMicros,
      impressions: acc.impressions + c.metrics.impressions,
      clicks: acc.clicks + c.metrics.clicks,
      ctr: 0, // policzone poniżej z sum, nie uśrednione ze średnich
      conversions: acc.conversions + c.metrics.conversions,
      conversionsValue: acc.conversionsValue + c.metrics.conversionsValue,
      averageCpcMicros: 0, // jw.
    }),
    {
      costMicros: 0,
      impressions: 0,
      clicks: 0,
      ctr: 0,
      conversions: 0,
      conversionsValue: 0,
      averageCpcMicros: 0,
    } satisfies RawMetrics,
  );

  // CTR i CPC liczymy z sum, nie jako średnią ze średnich — inaczej kampania
  // z 10 wyświetleniami ważyłaby tyle samo, co ta z 10 000.
  total.ctr = total.impressions ? total.clicks / total.impressions : 0;
  total.averageCpcMicros = total.clicks
    ? Math.round(total.costMicros / total.clicks)
    : 0;

  return total;
}

/**
 * Wykorzystanie budżetu dziennego w procentach.
 *
 * Kampania trwale przy ~100% to sygnał, że algorytm jest ograniczony budżetem,
 * a nie popytem — dokładnie sytuacja MODOhome (6,97 zł średnio przy limicie 7 zł).
 */
export function budgetUtilisationPercent(
  costMicros: number,
  dailyBudgetMicros: number | null,
  days: number,
): number | null {
  if (!dailyBudgetMicros || days <= 0) return null;
  const averageDailySpend = costMicros / days;
  return (averageDailySpend / dailyBudgetMicros) * 100;
}

/** Zmiana względna między okresami, w procentach. Null, gdy brak bazy. */
export function percentChange(
  current: number,
  previous: number,
): number | null {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

/**
 * Metryki wcześniejszego okresu, wyliczone przez odjęcie krótszego okna
 * od dłuższego (np. 30 dni minus 7 dni = poprzednie 23 dni).
 *
 * Google Ads nie ma stałej "poprzedni okres", a robienie drugiego zapytania
 * z ręcznie liczonym zakresem dat łatwo rozjeżdża się o strefę czasową konta.
 */
export function subtractMetrics(
  longer: RawMetrics,
  shorter: RawMetrics,
): RawMetrics {
  const costMicros = Math.max(0, longer.costMicros - shorter.costMicros);
  const impressions = Math.max(0, longer.impressions - shorter.impressions);
  const clicks = Math.max(0, longer.clicks - shorter.clicks);

  return {
    costMicros,
    impressions,
    clicks,
    ctr: impressions ? clicks / impressions : 0,
    conversions: Math.max(0, longer.conversions - shorter.conversions),
    conversionsValue: Math.max(
      0,
      longer.conversionsValue - shorter.conversionsValue,
    ),
    averageCpcMicros: clicks ? Math.round(costMicros / clicks) : 0,
  };
}

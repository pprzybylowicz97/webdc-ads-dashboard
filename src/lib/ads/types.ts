/**
 * Typy domenowe warstwy reklamowej.
 *
 * Celowo niezależne od dostawcy: ani Zapier, ani Google Ads API nie przeciekają
 * tutaj swoimi kształtami. Dzięki temu UI nie wie, skąd przyszły dane, a zmiana
 * dostawcy nie dotyka komponentów.
 */

/** Okno czasowe raportu. Mapowane na stałe DURING w GAQL. */
export type DateRange =
  | 'TODAY'
  | 'YESTERDAY'
  | 'LAST_7_DAYS'
  | 'LAST_14_DAYS'
  | 'LAST_30_DAYS'
  | 'THIS_MONTH'
  | 'LAST_MONTH';

export const DATE_RANGES: readonly DateRange[] = [
  'TODAY',
  'YESTERDAY',
  'LAST_7_DAYS',
  'LAST_14_DAYS',
  'LAST_30_DAYS',
  'THIS_MONTH',
  'LAST_MONTH',
] as const;

/** Etykiety po polsku do UI. */
export const DATE_RANGE_LABELS: Record<DateRange, string> = {
  TODAY: 'Dziś',
  YESTERDAY: 'Wczoraj',
  LAST_7_DAYS: 'Ostatnie 7 dni',
  LAST_14_DAYS: 'Ostatnie 14 dni',
  LAST_30_DAYS: 'Ostatnie 30 dni',
  THIS_MONTH: 'Ten miesiąc',
  LAST_MONTH: 'Poprzedni miesiąc',
};

/** Liczba dni w oknie — potrzebna do liczenia wykorzystania budżetu dziennego. */
export const DATE_RANGE_DAYS: Record<DateRange, number> = {
  TODAY: 1,
  YESTERDAY: 1,
  LAST_7_DAYS: 7,
  LAST_14_DAYS: 14,
  LAST_30_DAYS: 30,
  THIS_MONTH: new Date().getDate(),
  LAST_MONTH: 30,
};

export type CampaignStatus = 'ENABLED' | 'PAUSED' | 'REMOVED' | 'UNKNOWN';

/**
 * Surowe metryki tak, jak zwraca je Google Ads — bez przeliczeń.
 *
 * WAŻNE: `costMicros` i `averageCpcMicros` są w mikrojednostkach waluty
 * (1 000 000 mikro = 1 zł), a `ctr` to ułamek (0.0223), nie procent.
 * Przeliczaniem zajmuje się wyłącznie `lib/metrics.ts` — nigdy komponenty.
 */
export interface RawMetrics {
  costMicros: number;
  impressions: number;
  clicks: number;
  /** Ułamek, nie procent. 0.0223 === 2,23%. */
  ctr: number;
  conversions: number;
  /**
   * Suma wartości konwersji. Uwaga: jeśli równa się dokładnie `conversions`,
   * konto nie ma skonfigurowanej realnej wartości sprzedaży — ROAS jest wtedy
   * bez sensu. Patrz `metrics.ts` → `hasRealConversionValue`.
   */
  conversionsValue: number;
  averageCpcMicros: number;
}

/** Kampania z surowymi metrykami, w kształcie niezależnym od dostawcy. */
export interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  channelType: string;
  /** Dzienny budżet w mikrojednostkach. Null, gdy dostawca go nie zwrócił. */
  dailyBudgetMicros: number | null;
  metrics: RawMetrics;
}

/** Wynik zapytania o kampanie dla jednego konta i jednego okna czasowego. */
export interface CampaignReport {
  accountId: string;
  accountLabel: string;
  currency: string;
  range: DateRange;
  campaigns: Campaign[];
  /** Znacznik czasu pobrania — do pokazania "dane z godz. X". */
  fetchedAt: string;
}

/**
 * Kontrakt dostawcy danych.
 *
 * Implementacje: `ZapierAdsProvider` (działa bez developer tokena) oraz
 * `GoogleAdsProvider` (bezpośrednio do API). Wybór w `provider.ts`.
 */
export interface AdsProvider {
  readonly name: 'zapier' | 'google-ads';
  fetchCampaigns(accountId: string, range: DateRange): Promise<Campaign[]>;
}

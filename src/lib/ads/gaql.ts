/**
 * Budowanie zapytań GAQL (Google Ads Query Language).
 *
 * Wydzielone osobno, bo obaj dostawcy wysyłają dokładnie ten sam GAQL —
 * różnią się tylko transportem. Dzięki temu dane z Zapiera i z API bezpośrednio
 * są porównywalne co do pola.
 */

import type { DateRange } from './types';

/** Pola pobierane dla raportu kampanii. Kolejność bez znaczenia dla API. */
const CAMPAIGN_FIELDS = [
  'campaign.id',
  'campaign.name',
  'campaign.status',
  'campaign.advertising_channel_type',
  'campaign_budget.amount_micros',
  'metrics.cost_micros',
  'metrics.impressions',
  'metrics.clicks',
  'metrics.ctr',
  'metrics.conversions',
  'metrics.conversions_value',
  'metrics.average_cpc',
] as const;

/**
 * Zapytanie o kampanie z metrykami w danym oknie czasowym.
 *
 * `DateRange` jest unią literałów, więc do zapytania nie da się wstrzyknąć
 * dowolnego stringa — wartość zawsze pochodzi z zamkniętego zbioru.
 */
export function campaignReportQuery(range: DateRange, limit = 50): string {
  return [
    `SELECT ${CAMPAIGN_FIELDS.join(', ')}`,
    'FROM campaign',
    `WHERE segments.date DURING ${range}`,
    'ORDER BY metrics.cost_micros DESC',
    `LIMIT ${limit}`,
  ].join(' ');
}

/**
 * Zapytanie o same kampanie, bez metryk i bez filtra dat.
 *
 * Potrzebne, bo kampania bez wydatku w oknie czasowym w ogóle nie wraca
 * z zapytania z `segments.date` — a chcemy pokazać, że istnieje i jest wstrzymana.
 */
export function campaignListQuery(limit = 50): string {
  return [
    'SELECT campaign.id, campaign.name, campaign.status,',
    'campaign.advertising_channel_type, campaign_budget.amount_micros',
    'FROM campaign',
    'ORDER BY campaign.id DESC',
    `LIMIT ${limit}`,
  ].join(' ');
}

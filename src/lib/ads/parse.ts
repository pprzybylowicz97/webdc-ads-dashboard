/**
 * Parsowanie odpowiedzi googleAds:search.
 *
 * Wspólne dla obu dostawców: Zapier w akcji "raw request" oddaje surowe body
 * Google Ads API, więc kształt jest identyczny jak przy wywołaniu bezpośrednim.
 * Jeden parser = jedno miejsce, w którym mogą się rozjechać typy.
 */

import type { Campaign, CampaignStatus, RawMetrics } from './types';

/** Fragment odpowiedzi API — tylko pola, o które pytamy w gaql.ts. */
interface SearchRow {
  campaign?: {
    id?: string;
    name?: string;
    status?: string;
    advertisingChannelType?: string;
  };
  campaignBudget?: { amountMicros?: string | number };
  metrics?: {
    costMicros?: string | number;
    impressions?: string | number;
    clicks?: string | number;
    ctr?: number;
    conversions?: number;
    conversionsValue?: number;
    averageCpc?: string | number;
  };
}

export interface SearchResponse {
  results?: SearchRow[];
}

/**
 * Google Ads zwraca int64 jako string (bo nie mieści się w JS number),
 * a pola bez danych pomija całkowicie. Oba przypadki lądują tu.
 */
function toNumber(value: string | number | undefined): number {
  if (value === undefined || value === null) return 0;
  const parsed = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(parsed) ? parsed : 0;
}

function toStatus(value: string | undefined): CampaignStatus {
  switch (value) {
    case 'ENABLED':
    case 'PAUSED':
    case 'REMOVED':
      return value;
    default:
      return 'UNKNOWN';
  }
}

function toMetrics(row: SearchRow): RawMetrics {
  const m = row.metrics ?? {};
  return {
    costMicros: toNumber(m.costMicros),
    impressions: toNumber(m.impressions),
    clicks: toNumber(m.clicks),
    ctr: m.ctr ?? 0,
    conversions: m.conversions ?? 0,
    conversionsValue: m.conversionsValue ?? 0,
    averageCpcMicros: toNumber(m.averageCpc),
  };
}

export function parseSearchResponse(body: SearchResponse): Campaign[] {
  const rows = body.results ?? [];
  return rows.flatMap((row) => {
    const id = row.campaign?.id;
    if (!id) return [];

    const budgetMicros = row.campaignBudget?.amountMicros;

    return [
      {
        id,
        name: row.campaign?.name ?? '(bez nazwy)',
        status: toStatus(row.campaign?.status),
        channelType: row.campaign?.advertisingChannelType ?? 'UNKNOWN',
        dailyBudgetMicros:
          budgetMicros === undefined ? null : toNumber(budgetMicros),
        metrics: toMetrics(row),
      } satisfies Campaign,
    ];
  });
}

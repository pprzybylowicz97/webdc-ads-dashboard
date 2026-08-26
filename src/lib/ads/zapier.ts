/**
 * Dostawca korzystający z Zapier MCP jako pośrednika do Google Ads.
 *
 * Sens istnienia: Zapier ma własny, zatwierdzony przez Google developer token.
 * Dzięki temu dashboard czyta prawdziwe dane, zanim Twój wniosek o token
 * przejdzie akceptację — a UI już wtedy jest gotowe.
 *
 * Koszt: każde odświeżenie zużywa zadanie Zapiera, więc odpowiedzi są
 * cache'owane po stronie route handlera (patrz app/api/campaigns/route.ts).
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';

import { campaignReportQuery } from './gaql';
import { parseSearchResponse, type SearchResponse } from './parse';
import type { AdsProvider, Campaign, DateRange } from './types';

const API_VERSION = 'v22';

/** Kształt odpowiedzi akcji "raw request" Zapiera. */
interface ZapierRawResult {
  results?: Array<{ status?: number; body?: SearchResponse }>;
}

function readServerUrl(): string {
  const url = process.env.ZAPIER_MCP_URL;
  if (!url) {
    throw new Error(
      'Brak ZAPIER_MCP_URL. Adres serwera MCP znajdziesz w ustawieniach ' +
        'Zapier MCP (zawiera klucz dostępu — trzymaj go tylko w zmiennych środowiskowych).',
    );
  }
  return url;
}

async function callZapier(query: string, accountId: string): Promise<unknown> {
  const client = new Client(
    { name: 'webdc-ads-dashboard', version: '0.1.0' },
    { capabilities: {} },
  );
  const transport = new StreamableHTTPClientTransport(new URL(readServerUrl()));

  await client.connect(transport);
  try {
    return await client.callTool({
      name: 'execute_zapier_write_action',
      arguments: {
        selected_api: 'GoogleAdsCLIAPI',
        action: '_zap_raw_request',
        tool_name: 'google_ads_make_api_mutating_request',
        params: {
          url: `https://googleads.googleapis.com/${API_VERSION}/customers/${accountId}/googleAds:search`,
          method: 'POST',
          fail_on_errors: 'true',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query }),
        },
      },
    });
  } finally {
    await client.close();
  }
}

/**
 * Zapier oddaje wynik jako tekstowy blok treści z JSON-em w środku,
 * a nie jako ustrukturyzowany obiekt — stąd ta rozbiórka.
 */
function unwrap(raw: unknown): SearchResponse {
  const content = (raw as { content?: Array<{ type: string; text?: string }> })
    ?.content;
  const text = content?.find((c) => c.type === 'text')?.text;

  if (!text) {
    throw new Error('Zapier nie zwrócił treści tekstowej w odpowiedzi.');
  }

  let parsed: ZapierRawResult;
  try {
    parsed = JSON.parse(text) as ZapierRawResult;
  } catch {
    // Zapier zwraca błędy aplikacji jako zwykły tekst, nie JSON.
    throw new Error(`Zapier zwrócił błąd: ${text.slice(0, 300)}`);
  }

  const body = parsed.results?.[0]?.body;
  if (!body) {
    throw new Error(
      `Odpowiedź Zapiera bez ciała HTTP: ${text.slice(0, 300)}`,
    );
  }
  return body;
}

export class ZapierAdsProvider implements AdsProvider {
  readonly name = 'zapier' as const;

  async fetchCampaigns(
    accountId: string,
    range: DateRange,
  ): Promise<Campaign[]> {
    const raw = await callZapier(campaignReportQuery(range), accountId);
    return parseSearchResponse(unwrap(raw));
  }
}

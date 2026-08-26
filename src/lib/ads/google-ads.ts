/**
 * Dostawca uderzający bezpośrednio do Google Ads API.
 *
 * WYMAGA developer tokena zatwierdzonego przez Google (wniosek z konta
 * menedżerskiego, akceptacja ręczna). Dopóki go nie masz, użyj dostawcy
 * `zapier` — patrz provider.ts.
 */

import { campaignReportQuery } from './gaql';
import { parseSearchResponse, type SearchResponse } from './parse';
import type { AdsProvider, Campaign, DateRange } from './types';

/**
 * Wersja API. v22 potwierdzona jako działająca 2026-08-26;
 * v17-v21 zwracały 404. Podnosząc wersję, sprawdź najpierw
 * GET /v{N}/customers:listAccessibleCustomers.
 */
const API_VERSION = 'v22';
const API_BASE = `https://googleads.googleapis.com/${API_VERSION}`;
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

interface GoogleAdsCredentials {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  developerToken: string;
  /** Customer ID konta menedżerskiego. Ustaw TYLKO jeśli konto jest pod managerem. */
  loginCustomerId?: string;
}

function readCredentials(): GoogleAdsCredentials {
  const {
    GOOGLE_ADS_CLIENT_ID,
    GOOGLE_ADS_CLIENT_SECRET,
    GOOGLE_ADS_REFRESH_TOKEN,
    GOOGLE_ADS_DEVELOPER_TOKEN,
    GOOGLE_ADS_LOGIN_CUSTOMER_ID,
  } = process.env;

  const missing = Object.entries({
    GOOGLE_ADS_CLIENT_ID,
    GOOGLE_ADS_CLIENT_SECRET,
    GOOGLE_ADS_REFRESH_TOKEN,
    GOOGLE_ADS_DEVELOPER_TOKEN,
  })
    .filter(([, v]) => !v)
    .map(([k]) => k);

  if (missing.length) {
    throw new Error(
      `Brak zmiennych środowiskowych dla dostawcy google-ads: ${missing.join(', ')}`,
    );
  }

  return {
    clientId: GOOGLE_ADS_CLIENT_ID!,
    clientSecret: GOOGLE_ADS_CLIENT_SECRET!,
    refreshToken: GOOGLE_ADS_REFRESH_TOKEN!,
    developerToken: GOOGLE_ADS_DEVELOPER_TOKEN!,
    loginCustomerId: GOOGLE_ADS_LOGIN_CUSTOMER_ID,
  };
}

/** Access tokeny Google żyją ~1h; trzymamy w pamięci procesu z zapasem. */
let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(creds: GoogleAdsCredentials): Promise<string> {
  if (cachedToken && cachedToken.expiresAt > Date.now()) {
    return cachedToken.value;
  }

  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: creds.clientId,
      client_secret: creds.clientSecret,
      refresh_token: creds.refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  if (!response.ok) {
    throw new Error(
      `Odświeżenie tokena OAuth nie powiodło się (${response.status}). ` +
        'Sprawdź GOOGLE_ADS_REFRESH_TOKEN i dane klienta OAuth.',
    );
  }

  const data = (await response.json()) as {
    access_token: string;
    expires_in: number;
  };

  cachedToken = {
    value: data.access_token,
    // 60 s zapasu, żeby token nie wygasł w locie między sprawdzeniem a użyciem.
    expiresAt: Date.now() + (data.expires_in - 60) * 1000,
  };

  return cachedToken.value;
}

export class GoogleAdsProvider implements AdsProvider {
  readonly name = 'google-ads' as const;

  async fetchCampaigns(
    accountId: string,
    range: DateRange,
  ): Promise<Campaign[]> {
    const creds = readCredentials();
    const accessToken = await getAccessToken(creds);

    const headers: Record<string, string> = {
      Authorization: `Bearer ${accessToken}`,
      'developer-token': creds.developerToken,
      'Content-Type': 'application/json',
    };

    // Ustawiamy tylko, gdy jawnie skonfigurowane. Przy koncie, do którego login
    // ma dostęp bezpośredni, zbędny login-customer-id powoduje
    // "User doesn't have permission to access customer" — sprawdzone na MODOhome.
    if (creds.loginCustomerId) {
      headers['login-customer-id'] = creds.loginCustomerId;
    }

    const response = await fetch(
      `${API_BASE}/customers/${accountId}/googleAds:search`,
      {
        method: 'POST',
        headers,
        body: JSON.stringify({ query: campaignReportQuery(range) }),
      },
    );

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(
        `Google Ads API zwróciło ${response.status}: ${detail.slice(0, 500)}`,
      );
    }

    return parseSearchResponse((await response.json()) as SearchResponse);
  }
}

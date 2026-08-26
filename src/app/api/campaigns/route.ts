import { NextResponse } from 'next/server';
import { z } from 'zod';

import { requireAccount } from '@/lib/accounts';
import { getProvider, resolveProviderName } from '@/lib/ads/provider';
import { DATE_RANGES, type Campaign, type DateRange } from '@/lib/ads/types';

/** Dane reklamowe są prywatne i zmienne — nie renderujemy tego statycznie. */
export const dynamic = 'force-dynamic';

const querySchema = z.object({
  account: z.string().min(1),
  range: z.enum(DATE_RANGES as unknown as [DateRange, ...DateRange[]]),
  /**
   * Gdy '1', dociągamy dodatkowo okno 30-dniowe do wyliczenia okresu
   * porównawczego. UWAGA: podwaja liczbę zużytych zadań Zapiera, dlatego
   * domyślnie wyłączone.
   */
  compare: z.enum(['0', '1']).optional().default('0'),
});

/**
 * Cache w pamięci procesu.
 *
 * Powód: przy dostawcy `zapier` każde pobranie zużywa zadanie Zapiera, a plan
 * bywa ciasny (100 zadań/mies. na darmowym). TTL jest długi celowo — dane
 * reklamowe za wczoraj czy ostatnie 7 dni nie zmieniają się co minutę, a każde
 * trafienie w cache to zadanie oszczędzone.
 *
 * Na Vercelu cache żyje tyle, co instancja funkcji — to świadomie "best effort",
 * nie gwarancja: druga instancja ma pusty cache i pobierze od nowa. Gdy limit
 * zadań zacznie boleć, następny krok to Vercel KV (cache współdzielony) albo
 * dzienny snapshot do bazy zamiast pobierania na żądanie.
 */
const CACHE_TTL_MS = 30 * 60 * 1000;
const cache = new Map<string, { at: number; campaigns: Campaign[] }>();

async function fetchCached(
  accountId: string,
  range: DateRange,
): Promise<Campaign[]> {
  const key = `${accountId}:${range}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) {
    return hit.campaigns;
  }

  const campaigns = await getProvider().fetchCampaigns(accountId, range);
  cache.set(key, { at: Date.now(), campaigns });
  return campaigns;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = querySchema.safeParse({
    account: url.searchParams.get('account'),
    range: url.searchParams.get('range'),
    compare: url.searchParams.get('compare') ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Nieprawidłowe parametry zapytania.', detail: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const { range, compare } = parsed.data;

  try {
    const account = requireAccount(parsed.data.account);
    const campaigns = await fetchCached(account.id, range);

    // Okres porównawczy liczymy jako "30 dni minus wybrane okno". Dłuższy zakres
    // pobieramy osobno, a odejmowaniem zajmuje się warstwa metryk w UI.
    const baseline =
      compare === '1' && range !== 'LAST_30_DAYS'
        ? await fetchCached(account.id, 'LAST_30_DAYS')
        : null;

    return NextResponse.json({
      accountId: account.id,
      accountLabel: account.label,
      currency: account.currency,
      range,
      provider: resolveProviderName(),
      fetchedAt: new Date().toISOString(),
      campaigns,
      baselineCampaigns: baseline,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Nieznany błąd pobierania danych.';

    // 502, bo zawodzi zależność zewnętrzna (Zapier albo Google Ads),
    // a nie żądanie użytkownika — inaczej trudno odróżnić to od literówki w URL.
    return NextResponse.json({ error: message }, { status: 502 });
  }
}

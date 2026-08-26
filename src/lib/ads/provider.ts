/**
 * Wybór dostawcy danych.
 *
 * Przełącznik jest jednym miejscem, w którym projekt wie, skąd bierze dane.
 * Migracja z Zapiera na bezpośrednie API to zmiana jednej zmiennej środowiskowej
 * — UI, przeliczenia i parser zostają nietknięte.
 */

import { GoogleAdsProvider } from './google-ads';
import { ZapierAdsProvider } from './zapier';
import type { AdsProvider } from './types';

export type ProviderName = AdsProvider['name'];

export function resolveProviderName(): ProviderName {
  const configured = process.env.ADS_PROVIDER?.trim().toLowerCase();
  if (configured === 'google-ads') return 'google-ads';
  if (configured === 'zapier') return 'zapier';
  if (configured) {
    throw new Error(
      `Nieznana wartość ADS_PROVIDER: "${configured}". Dozwolone: zapier, google-ads.`,
    );
  }
  // Domyślnie Zapier — działa bez zatwierdzonego developer tokena.
  return 'zapier';
}

export function getProvider(): AdsProvider {
  return resolveProviderName() === 'google-ads'
    ? new GoogleAdsProvider()
    : new ZapierAdsProvider();
}

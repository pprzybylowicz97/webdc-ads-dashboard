/**
 * Konta Google Ads dostępne z loginu pprzybylowicz97@gmail.com.
 *
 * ID zweryfikowane na żywo 2026-08-26 przez
 * GET https://googleads.googleapis.com/v22/customers:listAccessibleCustomers
 * które zwróciło dokładnie te cztery customer resource names.
 */

export interface AdsAccount {
  /** Customer ID bez myślników — tak, jak trafia do URL-a API. */
  id: string;
  /** Nazwa do pokazania w UI. */
  label: string;
  currency: string;
  /** Czy to konto ma być domyślnie wybrane po wejściu na dashboard. */
  default?: boolean;
}

export const ACCOUNTS: readonly AdsAccount[] = [
  { id: '9365259298', label: 'MODOhome', currency: 'PLN', default: true },
  { id: '3613576001', label: 'WEBDC Patryk Przybyłowicz', currency: 'PLN' },
  { id: '7334619178', label: 'Webdc', currency: 'PLN' },
  { id: '1891081791', label: 'WEBDC.pl', currency: 'PLN' },
] as const;

export const DEFAULT_ACCOUNT_ID =
  ACCOUNTS.find((a) => a.default)?.id ?? ACCOUNTS[0].id;

export function getAccount(id: string): AdsAccount | undefined {
  return ACCOUNTS.find((a) => a.id === id);
}

/**
 * Waliduje ID konta przychodzące z zewnątrz (query string, body).
 *
 * Zwraca konto tylko dla ID z listy powyżej. To celowa allowlista: bez niej
 * dowolny customer ID z requestu trafiłby prosto do URL-a Google Ads API.
 */
export function requireAccount(id: string | null | undefined): AdsAccount {
  const account = id ? getAccount(id) : undefined;
  if (!account) {
    throw new Error(`Nieznane konto Google Ads: ${id ?? '(brak)'}`);
  }
  return account;
}

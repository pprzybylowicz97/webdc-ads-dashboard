# WEBDC — Dashboard Google Ads

Dashboard wydajności kampanii Google Ads dla kont WEBDC. Next.js 15, deploy na Vercel.

## Dlaczego dwa dostawcy danych

Google Ads API nie wpuszcza nikogo bez **developer tokena**, o który wnioskuje się
z konta menedżerskiego i który Google akceptuje ręcznie. Zanim wniosek przejdzie,
projekt nie miałby skąd brać danych.

Dlatego warstwa danych ma dwie implementacje za jednym interfejsem
(`src/lib/ads/types.ts` → `AdsProvider`):

| Dostawca | Kiedy | Co potrzebuje |
|---|---|---|
| `zapier` *(domyślny)* | od razu | adres serwera Zapier MCP |
| `google-ads` | gdy token przyjdzie | developer token + OAuth |

Obaj wysyłają **identyczne zapytanie GAQL** i dostają identyczny JSON, więc parser
(`src/lib/ads/parse.ts`) jest wspólny, a przejście z jednego na drugiego to zmiana
`ADS_PROVIDER` — bez dotykania UI i przeliczeń.

## Uruchomienie lokalne

```bash
npm install
cp .env.example .env.local   # uzupełnij ZAPIER_MCP_URL
npm run dev
```

Adres serwera MCP znajdziesz w ustawieniach Zapier MCP. **Zawiera klucz dostępu** —
trzyma się go wyłącznie w zmiennych środowiskowych.

## Skrypty

| Komenda | Co robi |
|---|---|
| `npm run dev` | serwer deweloperski |
| `npm run build` | build produkcyjny |
| `npm test` | testy warstwy metryk (vitest) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |

## Struktura

```
src/
├── app/
│   ├── api/campaigns/route.ts   # endpoint + cache 5 min
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── Dashboard.tsx            # stan, wybór konta i okresu (client)
│   ├── CampaignTable.tsx
│   └── MetricCard.tsx
└── lib/
    ├── accounts.ts              # allowlista kont Google Ads
    ├── metrics.ts               # przeliczenia — czyste funkcje
    ├── format.ts                # formatowanie pl-PL
    └── ads/
        ├── types.ts             # typy domenowe + kontrakt dostawcy
        ├── gaql.ts              # budowanie zapytań
        ├── parse.ts             # parser odpowiedzi (wspólny)
        ├── zapier.ts            # dostawca przez Zapier MCP
        ├── google-ads.ts        # dostawca bezpośredni
        └── provider.ts          # przełącznik
```

Zasada podziału: **UI nigdy nie liczy**. Komponenty dostają surowe metryki
i wołają `lib/metrics.ts`. Dzięki temu cała matematyka jest testowalna bez sieci
i bez Reacta — patrz `src/lib/__tests__/metrics.test.ts` (20 testów na prawdziwych
danych MODOhome).

## Pułapki Google Ads zamknięte w kodzie

Każda z nich kosztowała realny błąd przy pierwszym podejściu:

1. **Wersja API.** Działa `v22`. `v17`–`v21` zwracają 404. Podnosząc wersję,
   sprawdź najpierw `GET /v{N}/customers:listAccessibleCustomers`.
2. **`login-customer-id`.** Przy koncie z dostępem bezpośrednim ten nagłówek
   powoduje `User doesn't have permission to access customer`. Ustawiaj go
   **tylko** dla kont pod managerem.
3. **Koszty w mikrojednostkach.** `costMicros` dzielimy przez 1 000 000.
4. **CTR to ułamek, nie procent.** `0.0223` = 2,23%. Klasyczne źródło raportów
   zawyżonych stukrotnie.
5. **`int64` przychodzi jako string.** Google nie mieści go w JS number.
6. **Wartość konwersji.** Gdy `conversionsValue` równa się `conversions`, konto
   nie śledzi realnej wartości sprzedaży i **ROAS nic nie znaczy**. Dashboard
   pokazuje wtedy ostrzeżenie zamiast liczby.
7. **CTR sumy ≠ średnia CTR-ów.** Agregujemy z sum kliknięć i wyświetleń,
   inaczej kampania z 10 wyświetleniami waży tyle, co ta z 10 000.
8. **Kampanie bez wydatku znikają.** Zapytanie z `segments.date` nie zwróci
   kampanii bez kosztu w oknie — stąd osobne `campaignListQuery()`.

## Deploy na Vercel

1. Wypchnij repo na GitHub.
2. Vercel → **Add New… → Project** → wybierz to repo. Next.js wykrywa się sam.
3. **Settings → Environment Variables** — dodaj `ADS_PROVIDER` i `ZAPIER_MCP_URL`.
4. Deploy.

## Zużycie zadań Zapiera

Przy dostawcy `zapier` **każde pobranie danych kosztuje jedno zadanie** z Twojego
miesięcznego limitu (darmowy plan Zapiera to 100 zadań). Włączone porównanie
z poprzednim okresem podwaja koszt, bo dociąga dodatkowe okno 30-dniowe.

Dlatego dashboard jest celowo oszczędny:

- **porównanie domyślnie wyłączone** — włączasz świadomie checkboxem,
- **zmiana konta lub okresu nie pobiera automatycznie** — oznacza dane jako
  nieaktualne i czeka na kliknięcie „Pobierz dane". Bez tego przeklikanie listy
  kont potrafi spalić kilkanaście zadań w minutę,
- **cache 30 minut** — ponowne pobranie tych samych ustawień jest darmowe.

Cache żyje w pamięci instancji funkcji, więc na Vercelu jest „best effort":
druga instancja ma pusty cache i pobierze od nowa. Gdy limit zacznie boleć,
kolejność kroków to Vercel KV (cache współdzielony), a docelowo przejście na
`ADS_PROVIDER=google-ads` — bezpośrednie API nie ma limitu zapytań.

## Konta

Zweryfikowane 2026-08-26 przez `customers:listAccessibleCustomers`:

| Konto | Customer ID |
|---|---|
| MODOhome *(domyślne)* | `9365259298` |
| WEBDC Patryk Przybyłowicz | `3613576001` |
| Webdc | `7334619178` |
| WEBDC.pl | `1891081791` |

Lista w `src/lib/accounts.ts` działa jako **allowlista** — ID z requestu, którego
tam nie ma, nie trafi do URL-a API.

## Status

Zrobione: warstwa danych z dwoma dostawcami, przeliczenia z testami, endpoint
z cache, dashboard z wyborem konta i okresu, porównanie do okresu poprzedniego,
ostrzeżenie o braku wartości konwersji.

Naturalne następne kroki: wykresy dzień po dniu (recharts jest już w zależnościach),
zejście na poziom grup asetów w Performance Max, autoryzacja dostępu do dashboardu,
eksport raportu.

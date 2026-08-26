import { describe, expect, it } from 'vitest';

import {
  budgetUtilisationPercent,
  deriveMetrics,
  fromMicros,
  hasRealConversionValue,
  percentChange,
  subtractMetrics,
  sumMetrics,
} from '@/lib/metrics';
import type { Campaign, RawMetrics } from '@/lib/ads/types';

/**
 * Prawdziwe dane z konta MODOhome (9365259298), kampania [P-Max] Modohome mapy,
 * pobrane 2026-08-26. Trzymamy je jako fixture, bo to jedyny zestaw, dla którego
 * ręcznie zweryfikowaliśmy każdą pochodną liczbę.
 */
const LAST_7_DAYS: RawMetrics = {
  costMicros: 43_201_081,
  impressions: 5064,
  clicks: 113,
  ctr: 0.02231437598736177,
  conversions: 21,
  conversionsValue: 21,
  averageCpcMicros: 0,
};

const LAST_30_DAYS: RawMetrics = {
  costMicros: 209_007_562,
  impressions: 27_856,
  clicks: 513,
  ctr: 0.01841614014933946,
  conversions: 92,
  conversionsValue: 92,
  averageCpcMicros: 407_422,
};

describe('fromMicros', () => {
  it('przelicza mikrojednostki na złotówki', () => {
    expect(fromMicros(43_201_081)).toBeCloseTo(43.201081, 6);
  });
});

describe('deriveMetrics', () => {
  it('zamienia ułamkowy CTR na procent', () => {
    expect(deriveMetrics(LAST_7_DAYS).ctrPercent).toBeCloseTo(2.2314, 4);
  });

  it('liczy koszt na konwersję', () => {
    expect(deriveMetrics(LAST_7_DAYS).costPerConversion).toBeCloseTo(2.0572, 4);
  });

  it('liczy współczynnik konwersji z kliknięć', () => {
    expect(deriveMetrics(LAST_7_DAYS).conversionRatePercent).toBeCloseTo(
      18.584,
      3,
    );
  });

  it('podstawia CPC z kosztu i kliknięć, gdy API go nie zwróciło', () => {
    expect(deriveMetrics(LAST_7_DAYS).averageCpc).toBeCloseTo(0.3823, 4);
  });

  it('używa CPC z API, gdy jest dostępne', () => {
    expect(deriveMetrics(LAST_30_DAYS).averageCpc).toBeCloseTo(0.407422, 6);
  });

  it('nie zwraca ROAS, gdy wartość konwersji nie jest śledzona', () => {
    // Kluczowy przypadek: 92 konwersje o wartości 92 to brak wartości sprzedaży.
    // ROAS = 1,0 sugerowałby wyjście na zero, co byłoby nieprawdą.
    expect(deriveMetrics(LAST_30_DAYS).roas).toBeNull();
  });

  it('zwraca ROAS, gdy wartość konwersji jest realna', () => {
    const withValue: RawMetrics = { ...LAST_30_DAYS, conversionsValue: 4180 };
    expect(deriveMetrics(withValue).roas).toBeCloseTo(20.0, 1);
  });

  it('zwraca null zamiast dzielenia przez zero przy braku ruchu', () => {
    const empty: RawMetrics = {
      costMicros: 0,
      impressions: 0,
      clicks: 0,
      ctr: 0,
      conversions: 0,
      conversionsValue: 0,
      averageCpcMicros: 0,
    };
    const derived = deriveMetrics(empty);
    expect(derived.costPerConversion).toBeNull();
    expect(derived.conversionRatePercent).toBeNull();
    expect(derived.averageCpc).toBeNull();
  });
});

describe('hasRealConversionValue', () => {
  it('wykrywa brak wartości, gdy równa się liczbie konwersji', () => {
    expect(hasRealConversionValue(LAST_30_DAYS)).toBe(false);
  });

  it('traktuje zero konwersji jako brak wartości', () => {
    expect(
      hasRealConversionValue({ ...LAST_30_DAYS, conversions: 0, conversionsValue: 0 }),
    ).toBe(false);
  });
});

describe('subtractMetrics', () => {
  const previous = subtractMetrics(LAST_30_DAYS, LAST_7_DAYS);

  it('wylicza okres poprzedni jako różnicę okien', () => {
    expect(previous.clicks).toBe(400);
    expect(previous.conversions).toBe(71);
    expect(previous.impressions).toBe(22_792);
  });

  it('przelicza CTR z różnicy, a nie odejmuje CTR-ów', () => {
    // 400 / 22792 = 1,755%. Odjęcie ułamków dałoby bzdurę.
    expect(previous.ctr * 100).toBeCloseTo(1.7550, 3);
  });

  it('nie schodzi poniżej zera przy niespójnych oknach', () => {
    const result = subtractMetrics(LAST_7_DAYS, LAST_30_DAYS);
    expect(result.costMicros).toBe(0);
    expect(result.clicks).toBe(0);
  });
});

describe('sumMetrics', () => {
  const campaign = (metrics: RawMetrics): Campaign => ({
    id: '1',
    name: 'test',
    status: 'ENABLED',
    channelType: 'PERFORMANCE_MAX',
    dailyBudgetMicros: null,
    metrics,
  });

  it('liczy CTR z sum, a nie jako średnią ze średnich', () => {
    const small: RawMetrics = { ...LAST_7_DAYS, impressions: 10, clicks: 5, ctr: 0.5 };
    const total = sumMetrics([campaign(LAST_7_DAYS), campaign(small)]);

    // 118 kliknięć / 5074 wyświetleń = 2,33%. Średnia z 2,23% i 50% dałaby 26%.
    expect(total.ctr * 100).toBeCloseTo(2.3256, 3);
  });

  it('zwraca zera dla pustej listy', () => {
    expect(sumMetrics([]).costMicros).toBe(0);
    expect(sumMetrics([]).ctr).toBe(0);
  });
});

describe('budgetUtilisationPercent', () => {
  it('pokazuje, że kampania wyczerpuje budżet dzienny', () => {
    // 209,01 zł / 30 dni = 6,97 zł przy limicie 7,00 zł.
    const result = budgetUtilisationPercent(209_007_562, 7_000_000, 30);
    expect(result).toBeCloseTo(99.53, 1);
  });

  it('zwraca null, gdy budżet nieznany', () => {
    expect(budgetUtilisationPercent(1000, null, 7)).toBeNull();
  });
});

describe('percentChange', () => {
  it('liczy poprawę kosztu na konwersję', () => {
    expect(percentChange(2.0572, 2.3353)).toBeCloseTo(-11.909, 2);
  });

  it('zwraca null przy zerowej bazie', () => {
    expect(percentChange(5, 0)).toBeNull();
  });
});

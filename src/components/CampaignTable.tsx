import { clsx } from 'clsx';

import {
  budgetUtilisationPercent,
  deriveMetrics,
  fromMicros,
} from '@/lib/metrics';
import {
  formatCurrency,
  formatNumber,
  formatOptional,
  formatPercent,
} from '@/lib/format';
import type { Campaign } from '@/lib/ads/types';

const STATUS_LABELS: Record<string, string> = {
  ENABLED: 'Aktywna',
  PAUSED: 'Wstrzymana',
  REMOVED: 'Usunięta',
  UNKNOWN: 'Nieznany',
};

interface CampaignTableProps {
  campaigns: Campaign[];
  currency: string;
  /** Liczba dni w oknie — do wyliczenia wykorzystania budżetu dziennego. */
  days: number;
}

export function CampaignTable({
  campaigns,
  currency,
  days,
}: CampaignTableProps) {
  if (campaigns.length === 0) {
    return (
      <p className="rounded-lg border border-border bg-surface p-6 text-sm text-text-muted">
        Brak kampanii z danymi w tym oknie czasowym. Kampania bez wydatku w
        wybranym okresie nie pojawi się na liście, nawet jeśli istnieje na koncie.
      </p>
    );
  }

  return (
    // Szeroka tabela przewija się we własnym kontenerze — strona nigdy
    // nie dostaje poziomego paska.
    <div className="overflow-x-auto rounded-lg border border-border bg-surface">
      <table className="w-full min-w-[52rem] text-sm">
        <thead className="border-b border-border text-left text-xs text-text-muted uppercase">
          <tr>
            <th className="px-4 py-3 font-medium">Kampania</th>
            <th className="px-4 py-3 text-right font-medium">Koszt</th>
            <th className="px-4 py-3 text-right font-medium">Wyśw.</th>
            <th className="px-4 py-3 text-right font-medium">Kliknięcia</th>
            <th className="px-4 py-3 text-right font-medium">CTR</th>
            <th className="px-4 py-3 text-right font-medium">Konw.</th>
            <th className="px-4 py-3 text-right font-medium">Koszt/konw.</th>
            <th className="px-4 py-3 text-right font-medium">Budżet</th>
          </tr>
        </thead>
        <tbody>
          {campaigns.map((campaign) => {
            const m = deriveMetrics(campaign.metrics);
            const utilisation = budgetUtilisationPercent(
              campaign.metrics.costMicros,
              campaign.dailyBudgetMicros,
              days,
            );

            return (
              <tr
                key={campaign.id}
                className="border-b border-border last:border-0"
              >
                <td className="px-4 py-3">
                  <span className="font-medium">{campaign.name}</span>
                  <span className="mt-0.5 block text-xs text-text-muted">
                    {STATUS_LABELS[campaign.status] ?? campaign.status} ·{' '}
                    {campaign.channelType}
                  </span>
                </td>
                <td className="tabular px-4 py-3 text-right">
                  {formatCurrency(m.cost, currency)}
                </td>
                <td className="tabular px-4 py-3 text-right">
                  {formatNumber(m.impressions)}
                </td>
                <td className="tabular px-4 py-3 text-right">
                  {formatNumber(m.clicks)}
                </td>
                <td className="tabular px-4 py-3 text-right">
                  {formatPercent(m.ctrPercent)}
                </td>
                <td className="tabular px-4 py-3 text-right">
                  {formatNumber(m.conversions, 0)}
                </td>
                <td className="tabular px-4 py-3 text-right">
                  {formatOptional(m.costPerConversion, (v) =>
                    formatCurrency(v, currency),
                  )}
                </td>
                <td className="tabular px-4 py-3 text-right">
                  {campaign.dailyBudgetMicros === null ? (
                    '—'
                  ) : (
                    <>
                      {formatCurrency(
                        fromMicros(campaign.dailyBudgetMicros),
                        currency,
                      )}
                      {utilisation !== null && (
                        <span
                          className={clsx(
                            'mt-0.5 block text-xs',
                            // Powyżej 90% algorytm jest duszony budżetem,
                            // a nie brakiem popytu — to warto podświetlić.
                            utilisation >= 90
                              ? 'text-warning'
                              : 'text-text-muted',
                          )}
                        >
                          {formatPercent(utilisation, 0)} wykorzystania
                        </span>
                      )}
                    </>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

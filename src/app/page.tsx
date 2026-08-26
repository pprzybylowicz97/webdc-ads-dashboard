import { Dashboard } from '@/components/Dashboard';
import { ACCOUNTS, DEFAULT_ACCOUNT_ID } from '@/lib/accounts';

export default function Page() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:py-12">
      <header className="mb-8">
        <h1 className="text-2xl font-semibold tracking-tight">
          Google Ads — WEBDC
        </h1>
        <p className="mt-1 text-sm text-text-muted">
          Wydajność kampanii z kont podpiętych do Twojego loginu Google Ads.
        </p>
      </header>

      <Dashboard accounts={ACCOUNTS} defaultAccountId={DEFAULT_ACCOUNT_ID} />
    </main>
  );
}

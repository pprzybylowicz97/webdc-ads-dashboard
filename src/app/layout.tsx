import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'WEBDC — Google Ads',
  description: 'Dashboard wydajności kampanii Google Ads dla kont WEBDC',
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pl">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}

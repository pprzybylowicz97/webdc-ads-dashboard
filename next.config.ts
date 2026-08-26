import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Dane reklamowe są prywatne — nigdy nie cache'ujemy ich na krawędzi CDN.
  // Cache'owanie odbywa się świadomie w route handlerze, per konto i okno czasowe.
  poweredByHeader: false,
};

export default nextConfig;

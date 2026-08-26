import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // Next rozumie zapis `plugins: ['@tailwindcss/postcss']`, Vite nie.
  // Testy dotyczą czystej logiki, więc CSS w ogóle nie musi być przetwarzany.
  css: { postcss: { plugins: [] } },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});

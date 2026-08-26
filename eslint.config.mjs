import { dirname } from 'path';
import { fileURLToPath } from 'url';
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

const config = [
  ...compat.extends('next/core-web-vitals', 'next/typescript', 'prettier'),
  {
    // next-env.d.ts jest generowany przez Next przy każdym buildzie i jest
    // w .gitignore — nie ma sensu go lintować ani poprawiać.
    ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'],
  },
];

export default config;

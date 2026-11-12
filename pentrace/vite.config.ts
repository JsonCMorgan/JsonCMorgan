import { defineConfig } from 'vitest/config';

// Port 1420 is the Tauri convention; tauri.conf.json points devUrl here.
export default defineConfig({
  clearScreen: false,
  server: { port: 1420, strictPort: true, host: '127.0.0.1' },
  envPrefix: ['VITE_', 'TAURI_ENV_'],
  build: {
    target: 'es2022',
    sourcemap: false,
  },
  test: {
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      reporter: ['text-summary', 'lcov', 'json-summary'],
      reportsDirectory: 'coverage',
      // Floor, not a goal: ratchet these up as engine tests grow.
      thresholds: { statements: 35, branches: 25, functions: 35, lines: 35 },
    },
  },
});

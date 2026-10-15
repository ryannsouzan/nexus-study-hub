import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  // Os fluxos completos fazem múltiplos cadastros, recargas e backups.
  timeout: 90000,
  use: {
    baseURL: 'http://127.0.0.1:5173',
    trace: 'retain-on-failure',
    launchOptions: { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH },
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: 'npm run dev -- --port 5173 --strictPort',
    url: 'http://127.0.0.1:5173',
    reuseExistingServer: !process.env.CI,
  },
  reporter: 'list',
});

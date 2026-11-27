import { defineConfig, devices } from '@playwright/test'

const isCI = Boolean(process.env.CI)

// Browser tests against the real stack: the Vite dev server, which proxies
// /api to the NestJS API, which uses the database in DATABASE_URL. Tests
// sign up fresh users with unique emails, so they need no database reset.
// Locally, servers that are already running are reused.
export default defineConfig({
  testDir: './e2e',
  forbidOnly: isCI,
  retries: isCI ? 1 : 0,
  workers: isCI ? 1 : undefined,
  reporter: isCI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'npm run start',
      cwd: '../api',
      url: 'http://localhost:3000/api/v1/health',
      reuseExistingServer: !isCI,
      timeout: 120_000,
    },
    {
      command: 'npm run dev -- --port 5173 --strictPort',
      url: 'http://localhost:5173',
      reuseExistingServer: !isCI,
    },
  ],
})

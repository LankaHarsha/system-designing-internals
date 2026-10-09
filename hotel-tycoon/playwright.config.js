import { defineConfig, devices } from '@playwright/test'

// BASE_URL points the smoke tests at a deployed build (post-deploy check).
// Without it, they build-preview the local dist/ on port 4173.
const baseURL = process.env.BASE_URL || 'http://localhost:4173'
// Cloud sandboxes ship a preinstalled Chromium; CI installs its own.
const executablePath = process.env.PW_CHROMIUM_PATH || undefined

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    launchOptions: {
      executablePath,
      args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'],
    },
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: process.env.BASE_URL
    ? undefined
    : { command: 'npx vite preview --port 4173 --strictPort', url: baseURL, reuseExistingServer: !process.env.CI },
})

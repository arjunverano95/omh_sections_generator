import { defineConfig, devices } from '@playwright/test'

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
import 'dotenv/config'

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: './tests/e2e',
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  retries: process.env.CI ? 2 : 0,
  /* Opt out of parallel tests on CI. */
  workers: process.env.CI ? 1 : undefined,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: 'html',
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    // baseURL: 'http://localhost:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    trace: 'on-first-retry',
  },
  projects: [
    // The Sections suite seeds the site, which clears the content collections and
    // signs in as the shared test user, so it runs on its own before the other suites.
    {
      name: 'sections',
      testMatch: /sections\.e2e\.spec\.ts$/,
      use: { ...devices['Desktop Chrome'], channel: 'chromium' },
    },
    {
      name: 'chromium',
      testIgnore: /sections\.e2e\.spec\.ts$/,
      dependencies: ['sections'],
      use: { ...devices['Desktop Chrome'], channel: 'chromium' },
    },
  ],
  webServer: {
    command: 'pnpm build && pnpm start',
    // The runner loads its specs through tsx; the site build does not want that
    // loader, and pnpm refuses to run under it.
    env: { NODE_OPTIONS: '--no-deprecation' },
    reuseExistingServer: true,
    timeout: 5 * 60 * 1000,
    url: 'http://localhost:3000',
  },
})

import { defineConfig } from '@playwright/test'

/** End-to-end tests drive the built Electron app (`npm run test:e2e` builds it first). */
export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // One app at a time: parallel Electron windows steal OS focus from each other, which breaks
  // focus-dependent behavior like Edit > Undo in a text field.
  workers: 1,
  reporter: [['list']],
  outputDir: 'test-results'
})

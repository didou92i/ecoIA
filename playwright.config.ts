import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "line",
  timeout: 30_000,
  expect: { timeout: 8_000 },
  use: {
    headless: true,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});

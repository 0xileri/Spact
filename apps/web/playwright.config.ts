import { defineConfig, devices } from "@playwright/test";

// Starts a NEAR sandbox, the dev signer and the dev server once (e2e/global-setup.ts).
// Tests share that chain, so they run one at a time and use their own request ids.
export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  timeout: 90_000,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:5199",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});

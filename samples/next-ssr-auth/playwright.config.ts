import { defineConfig } from "@playwright/test";

const apiPort = Number(process.env.ISOLATION_API_PORT ?? 3110);
const nextPort = Number(process.env.ISOLATION_NEXT_PORT ?? 3410);
const apiBaseUrl = `http://localhost:${apiPort}`;
const appBaseUrl = `http://localhost:${nextPort}`;

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 60_000,
  expect: {
    timeout: 10_000
  },
  use: {
    baseURL: appBaseUrl,
    trace: "on-first-retry"
  },
  webServer: [
    {
      command: "pnpm --filter @aptx/sample-api-server start",
      url: `${apiBaseUrl}/health`,
      timeout: 60_000,
      reuseExistingServer: false,
      env: {
        ...process.env,
        PORT: String(apiPort)
      }
    },
    {
      command: `pnpm --filter @aptx/sample-next-ssr-auth exec next dev -p ${nextPort}`,
      url: appBaseUrl,
      timeout: 120_000,
      reuseExistingServer: false,
      env: {
        ...process.env,
        API_BASE_URL: apiBaseUrl
      }
    }
  ]
});

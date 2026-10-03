import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Lấy TEST_DATABASE_URL từ api/.env khi chạy local; CI truyền qua env.
if (existsSync("../api/.env")) process.loadEnvFile("../api/.env");

const TEST_DATABASE_URL = process.env.TEST_DATABASE_URL ?? "";

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: "http://localhost:3000", trace: "retain-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  // Cần build trước: `npm --prefix ../api run build && npm run build`.
  // Next rewrites được "đóng gói" lúc `next build`: build web cho e2e với API_URL mặc định
  // (http://localhost:4000), đừng đặt API_URL khác khi build.
  webServer: [
    {
      command: "npm --prefix ../api run start:prod",
      url: "http://localhost:4000/api/health",
      reuseExistingServer: false,
      env: { DATABASE_URL: TEST_DATABASE_URL, PORT: "4000" },
    },
    {
      command: "npx next start -p 3000",
      url: "http://localhost:3000/login",
      reuseExistingServer: false,
      env: { API_URL: "http://localhost:4000" },
    },
  ],
});

import { execSync } from "node:child_process";
import { E2E_ADMIN } from "./fixtures";

export default function globalSetup() {
  const url = process.env.TEST_DATABASE_URL;
  if (!url) throw new Error("Thiếu TEST_DATABASE_URL (đặt trong api/.env hoặc biến môi trường)");
  execSync("npm --prefix ../api run e2e:prepare", {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: url,
      ADMIN_USERNAME: E2E_ADMIN.username,
      ADMIN_PASSWORD: E2E_ADMIN.password,
    },
  });
}

import { execSync } from "node:child_process";
import { E2E_ACCOUNT, E2E_ADMIN, E2E_MEMBER, E2E_RESET, E2E_TARGET, E2E_VIEWER } from "./fixtures";

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
      E2E_MEMBER_USERNAME: E2E_MEMBER.username,
      E2E_MEMBER_PASSWORD: E2E_MEMBER.password,
      E2E_VIEWER_USERNAME: E2E_VIEWER.username,
      E2E_VIEWER_PASSWORD: E2E_VIEWER.password,
      E2E_EXTRA_USERS: JSON.stringify([
        { ...E2E_ACCOUNT, email: null, member: null },
        { ...E2E_TARGET, member: "Vũ Văn Đích" },
        { ...E2E_RESET, member: null },
      ]),
    },
  });
}

import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { E2E_MAIL_OUTBOX, E2E_RESET, E2E_VIEWER } from "./fixtures";
import { login, loginAndWait } from "./helpers";

test.describe.configure({ mode: "serial", retries: 0 });
const NEW_PASSWORD = "MatKhauResetMoi@2026";

function lastLinkTo(email: string): string {
  const mails = readFileSync(E2E_MAIL_OUTBOX, "utf8").trim().split("\n").map((l) => JSON.parse(l) as { to: string; text: string });
  const mail = mails.filter((m) => m.to === email).at(-1)!;
  return /http:\/\/localhost:3000(\/reset-password\?token=[\w-]+)/.exec(mail.text)![1];
}

test("đăng nhập có link Quên mật khẩu; không tìm thấy / chưa có email", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Quên mật khẩu?" }).click();
  await expect(page).toHaveURL(/\/forgot-password$/);
  await expect(page.getByRole("heading", { name: "Quên mật khẩu" })).toBeVisible();
  const input = page.getByLabel("Tên đăng nhập hoặc email");
  await input.fill("khong_co_ai_e2e");
  await page.getByRole("button", { name: "Gửi link đặt lại" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Không tìm thấy tài khoản với tên đăng nhập hoặc email này." })).toBeVisible();
  await input.fill(E2E_VIEWER.username);
  await page.getByRole("button", { name: "Gửi link đặt lại" }).click();
  await expect(page.getByRole("heading", { name: "Tài khoản chưa có email" })).toBeVisible();
  await expect(page.getByText(`Tài khoản ${E2E_VIEWER.username} chưa lưu email`)).toBeVisible();
  await expect(page.getByText("Hãy nhờ quản trị viên dòng họ đặt lại mật khẩu cho bạn.")).toBeVisible();
});

test("gửi link → che email, gửi lại quá sớm bị chặn; mở link → đặt mật khẩu mới → đăng nhập; link dùng lại không được", async ({ page }) => {
  await page.goto("/forgot-password");
  await page.getByLabel("Tên đăng nhập hoặc email").fill(E2E_RESET.email.toUpperCase());
  await page.getByRole("button", { name: "Gửi link đặt lại" }).click();
  await expect(page.getByRole("heading", { name: "Kiểm tra email của bạn" })).toBeVisible();
  await expect(page.getByText("Đã gửi link đặt lại mật khẩu tới r•••@example.com.")).toBeVisible();
  await page.getByRole("button", { name: "Gửi lại" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Vui lòng đợi 1 phút rồi gửi lại." })).toBeVisible();

  const link = lastLinkTo(E2E_RESET.email);
  await page.goto(link);
  await expect(page.getByRole("heading", { name: "Đặt mật khẩu mới" })).toBeVisible();
  await expect(page.getByText(`Cho tài khoản ${E2E_RESET.username}.`)).toBeVisible();
  await page.getByLabel("Mật khẩu mới", { exact: true }).fill(NEW_PASSWORD);
  await page.getByLabel("Nhập lại mật khẩu mới").fill("khac-han-nhe");
  await page.getByRole("button", { name: "Lưu mật khẩu mới" }).click();
  await expect(page.getByText("Mật khẩu nhập lại không khớp.")).toBeVisible();
  await page.getByLabel("Nhập lại mật khẩu mới").fill(NEW_PASSWORD);
  await page.getByRole("button", { name: "Lưu mật khẩu mới" }).click();
  await expect(page).toHaveURL(/\/login\?reset=1$/);
  await expect(page.getByRole("status").filter({ hasText: "Đã đổi mật khẩu. Hãy đăng nhập lại." })).toBeVisible();
  await login(page, E2E_RESET.username, E2E_RESET.password);
  await expect(page.getByRole("alert").filter({ hasText: "Sai tên đăng nhập hoặc mật khẩu." })).toBeVisible();
  await loginAndWait(page, E2E_RESET.username, NEW_PASSWORD);

  await page.context().clearCookies();
  await page.goto(link);
  await expect(page.getByRole("heading", { name: "Link không còn dùng được" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Gửi link mới" })).toHaveAttribute("href", "/forgot-password");
});

test("link sai → trang Link không còn dùng được", async ({ page }) => {
  await page.goto("/reset-password?token=sai-token");
  await expect(page.getByRole("heading", { name: "Link không còn dùng được" })).toBeVisible();
  await page.goto("/reset-password");
  await expect(page.getByRole("heading", { name: "Link không còn dùng được" })).toBeVisible();
});

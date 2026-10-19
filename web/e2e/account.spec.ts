import { expect, test } from "@playwright/test";
import { E2E_ACCOUNT, E2E_RESET } from "./fixtures";
import { login, loginAndWait } from "./helpers";

test.describe.configure({ mode: "serial", retries: 0 });
const NEW_PASSWORD = "MatKhauAccountMoi@2026";

test("tài khoản của tôi: thông tin, lưu/xóa email (cần mật khẩu), email trùng / sai mật khẩu bị báo", async ({ page }) => {
  await loginAndWait(page, E2E_ACCOUNT.username, E2E_ACCOUNT.password);
  await page.goto("/account");
  await expect(page.getByRole("heading", { name: "Tài khoản của tôi", level: 1 })).toBeVisible();
  await expect(page.getByText(E2E_ACCOUNT.username, { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Chưa liên kết thành viên")).toBeVisible();

  const form = page.getByRole("region", { name: "Email", exact: true });
  const email = form.getByLabel("Email", { exact: true });
  const pw = form.getByLabel("Mật khẩu hiện tại");
  const save = form.getByRole("button", { name: "Lưu email" });

  // Thiếu mật khẩu.
  await email.fill("account.e2e@example.com");
  await save.click();
  await expect(form.getByText("Vui lòng nhập mật khẩu hiện tại.")).toBeVisible();
  // Sai mật khẩu → báo lỗi, email không đổi.
  await pw.fill("sai-mat-khau-1");
  await save.click();
  await expect(form.getByText("Mật khẩu hiện tại không đúng.")).toBeVisible();
  await page.reload();
  await expect(email).toHaveValue("");
  // Email trùng.
  await email.fill(E2E_RESET.email);
  await pw.fill(E2E_ACCOUNT.password);
  await save.click();
  await expect(form.getByText("Email này đã được dùng cho tài khoản khác.")).toBeVisible();
  // Lưu (chuẩn hóa) → xóa ô mật khẩu.
  await email.fill("  Account.E2E@Example.com ");
  await pw.fill(E2E_ACCOUNT.password);
  await save.click();
  await expect(form.getByRole("status").filter({ hasText: "Đã lưu email." })).toBeVisible();
  await expect(email).toHaveValue("account.e2e@example.com");
  await expect(pw).toHaveValue("");
  // Xóa email.
  await email.fill("");
  await pw.fill(E2E_ACCOUNT.password);
  await save.click();
  await expect(form.getByRole("status").filter({ hasText: "Đã xóa email." })).toBeVisible();
});

test("đổi mật khẩu: lỗi nhập lại / sai mật khẩu hiện tại; thành công → đăng nhập bằng mật khẩu mới", async ({ page }) => {
  await loginAndWait(page, E2E_ACCOUNT.username, E2E_ACCOUNT.password);
  await page.goto("/account");
  const form = page.getByRole("region", { name: "Đổi mật khẩu", exact: true });
  const current = form.getByLabel("Mật khẩu hiện tại");
  const change = form.getByRole("button", { name: "Đổi mật khẩu" });
  await current.fill(E2E_ACCOUNT.password);
  await form.getByLabel("Mật khẩu mới", { exact: true }).fill(NEW_PASSWORD);
  await form.getByLabel("Nhập lại mật khẩu mới").fill("khac-han");
  await change.click();
  await expect(form.getByText("Mật khẩu nhập lại không khớp.")).toBeVisible();
  await current.fill("sai-mat-khau-1");
  await form.getByLabel("Nhập lại mật khẩu mới").fill(NEW_PASSWORD);
  await change.click();
  await expect(form.getByText("Mật khẩu hiện tại không đúng.")).toBeVisible();
  await current.fill(E2E_ACCOUNT.password);
  await change.click();
  await expect(form.getByRole("status").filter({ hasText: "Đã đổi mật khẩu." })).toBeVisible();
  await page.context().clearCookies();
  await login(page, E2E_ACCOUNT.username, E2E_ACCOUNT.password);
  await expect(page.getByRole("alert").filter({ hasText: "Sai tên đăng nhập hoặc mật khẩu." })).toBeVisible();
  await loginAndWait(page, E2E_ACCOUNT.username, NEW_PASSWORD);
});

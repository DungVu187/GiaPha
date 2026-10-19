import { expect, test } from "@playwright/test";
import { E2E_ADMIN, E2E_MEMBER, E2E_TARGET, E2E_TARGET_MEMBER } from "./fixtures";
import { login, loginAndWait } from "./helpers";

test.describe.configure({ mode: "serial", retries: 0 });
const TARGET_NEW_PASSWORD = "MatKhauTargetMoi@2026";

test("member không vào được trang quản trị", async ({ page }) => {
  await loginAndWait(page, E2E_MEMBER.username, E2E_MEMBER.password);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Không có quyền" })).toBeVisible();
});

test("danh sách, tìm, lọc vừa nhận hồ sơ", async ({ page }) => {
  await loginAndWait(page, E2E_ADMIN.username, E2E_ADMIN.password);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Quản trị tài khoản", level: 1 })).toBeVisible();
  await expect(page.getByText(/^\d+ tài khoản\./)).toBeVisible();
  await page.getByRole("button", { name: /Vừa nhận hồ sơ \(30 ngày\)/ }).click();
  await expect(page.getByText(E2E_TARGET.username, { exact: true }).first()).toBeVisible();
  await expect(page.getByText(/^Vừa nhận hồ sơ · \d{2}\/\d{2}\/\d{4}$/).first()).toBeVisible();
  await expect(page.getByText(E2E_MEMBER.username, { exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: /Vừa nhận hồ sơ \(30 ngày\)/ }).click();
  await page.getByLabel("Tìm tài khoản").fill("vu van dich");
  await expect(page.getByText(E2E_TARGET.username, { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("main").getByText(E2E_ADMIN.username, { exact: true })).toHaveCount(0);
});

test("đặt lại mật khẩu → người đó đăng nhập bằng mật khẩu mới", async ({ page, browser }) => {
  await loginAndWait(page, E2E_ADMIN.username, E2E_ADMIN.password);
  await page.goto("/admin");
  await page.getByLabel("Tìm tài khoản").fill(E2E_TARGET.username);
  await page.getByRole("button", { name: "Đặt lại mật khẩu" }).first().click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("heading", { name: `Đặt lại mật khẩu cho ${E2E_TARGET.username}` })).toBeVisible();
  await dialog.getByLabel("Mật khẩu mới").fill("1234567");
  await dialog.getByRole("button", { name: "Đặt lại mật khẩu" }).click();
  await expect(dialog.getByText("Mật khẩu phải có ít nhất 8 ký tự.")).toBeVisible();
  await dialog.getByLabel("Mật khẩu mới").fill(TARGET_NEW_PASSWORD);
  await dialog.getByRole("button", { name: "Đặt lại mật khẩu" }).click();
  await expect(page.getByRole("status").filter({ hasText: `Đã đặt lại mật khẩu cho ${E2E_TARGET.username}` })).toBeVisible();
  const other = await browser.newPage();
  await login(other, E2E_TARGET.username, E2E_TARGET.password);
  await expect(other.getByRole("alert").filter({ hasText: "Sai tên đăng nhập hoặc mật khẩu." })).toBeVisible();
  await loginAndWait(other, E2E_TARGET.username, TARGET_NEW_PASSWORD);
  await other.close();
});

test("không hạ được Admin cuối cùng; nâng rồi hạ tài khoản khác", async ({ page }) => {
  await loginAndWait(page, E2E_ADMIN.username, E2E_ADMIN.password);
  await page.goto("/admin");
  await page.getByLabel("Tìm tài khoản").fill(E2E_ADMIN.username);
  await page.getByRole("button", { name: `Đổi quyền tài khoản ${E2E_ADMIN.username} (hiện: Admin)` }).first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Quyền mới").selectOption({ label: "Thành viên" });
  await expect(dialog.getByRole("alert")).toContainText("Không thể hạ quyền Admin cuối cùng.");
  await expect(dialog.getByRole("button", { name: "Đổi quyền" })).toBeDisabled();
  await dialog.getByRole("button", { name: "Hủy" }).click();
  await page.getByLabel("Tìm tài khoản").fill(E2E_TARGET.username);
  await page.getByRole("button", { name: `Đổi quyền tài khoản ${E2E_TARGET.username} (hiện: Thành viên)` }).first().click();
  await page.getByRole("dialog").getByLabel("Quyền mới").selectOption({ label: "Admin" });
  await page.getByRole("dialog").getByRole("button", { name: "Đổi quyền" }).click();
  await expect(page.getByRole("button", { name: `Đổi quyền tài khoản ${E2E_TARGET.username} (hiện: Admin)` }).first()).toBeVisible();
  await page.getByRole("button", { name: `Đổi quyền tài khoản ${E2E_TARGET.username} (hiện: Admin)` }).first().click();
  await page.getByRole("dialog").getByLabel("Quyền mới").selectOption({ label: "Thành viên" });
  await page.getByRole("dialog").getByRole("button", { name: "Đổi quyền" }).click();
  await expect(page.getByRole("button", { name: `Đổi quyền tài khoản ${E2E_TARGET.username} (hiện: Thành viên)` }).first()).toBeVisible();
});

test("gỡ liên kết → hồ sơ về 'Chưa liên kết', nút Gỡ liên kết bị khóa", async ({ page }) => {
  await loginAndWait(page, E2E_ADMIN.username, E2E_ADMIN.password);
  await page.goto("/admin");
  await page.getByLabel("Tìm tài khoản").fill(E2E_TARGET.username);
  await expect(page.getByRole("link", { name: E2E_TARGET_MEMBER }).first()).toBeVisible();
  await page.getByRole("button", { name: "Gỡ liên kết" }).first().click();
  const dialog = page.getByRole("alertdialog");
  await expect(dialog).toContainText(`Hồ sơ ${E2E_TARGET_MEMBER} (Đời 3)`);
  await dialog.getByRole("button", { name: "Gỡ liên kết" }).click();
  await expect(page.getByText("Chưa liên kết").first()).toBeVisible();
  await expect(page.getByRole("button", { name: "Gỡ liên kết" }).first()).toBeDisabled();
});

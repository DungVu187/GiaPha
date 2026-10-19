import { expect, test } from "@playwright/test";
import { E2E_ADMIN, E2E_MEMBER } from "./fixtures";
import { loginAndWait } from "./helpers";

test.describe.configure({ mode: "serial", retries: 0 });

test("điện thoại: header 64px, thanh tab đáy, khung cây không đè menu, ngăn kéo có Đăng xuất", async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await loginAndWait(page, E2E_MEMBER.username, E2E_MEMBER.password);
  const header = page.locator("header").first();
  expect((await header.boundingBox())!.height).toBeCloseTo(64, 0);
  await expect(page.getByRole("navigation", { name: "Điều hướng chính" })).toBeHidden();

  const tabbar = page.getByRole("navigation", { name: "Thanh điều hướng dưới" });
  await tabbar.getByRole("link", { name: "Cây" }).click();
  await expect(page).toHaveURL(/\/tree$/);
  await expect(tabbar.getByRole("link", { name: "Cây" })).toHaveAttribute("aria-current", "page");
  const frame = (await page.getByTestId("tree-frame").boundingBox())!;
  expect(frame.y).toBeCloseTo(64, 0);
  expect(frame.y + frame.height).toBeCloseTo(812 - 64, 0);

  await page.getByRole("button", { name: "Mở menu" }).click();
  const menu = page.getByRole("dialog");
  await expect(menu).toContainText("VŨ VĂN TÔI");
  await expect(menu).toContainText(`${E2E_MEMBER.username} · Đời 3`);
  await expect(menu.getByRole("link", { name: "Tài khoản của tôi" })).toBeVisible();
  await expect(menu.getByRole("link", { name: "Quản trị" })).toHaveCount(0);
  await menu.getByRole("link", { name: "Thành viên" }).click();
  await expect(page).toHaveURL(/\/members$/);
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.getByRole("button", { name: "Mở menu" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Đăng xuất" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("tablet: header một hàng 72px, không có thanh tab, nút tài khoản mở Đăng xuất", async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 1024 });
  await loginAndWait(page, E2E_ADMIN.username, E2E_ADMIN.password);
  expect((await page.locator("header").first().boundingBox())!.height).toBeCloseTo(72, 0);
  const nav = page.getByRole("navigation", { name: "Điều hướng chính" });
  await expect(nav.getByRole("link", { name: "Lịch giỗ" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Thanh điều hướng dưới" })).toBeHidden();
  await page.getByRole("button", { name: `Tài khoản ${E2E_ADMIN.username}` }).click();
  const accountLink = page.getByRole("link", { name: "Tài khoản của tôi" });
  await expect(accountLink).toHaveAttribute("href", "/account");
  await accountLink.click();
  await expect(page).toHaveURL(/\/account$/);
  await expect(page.getByRole("button", { name: "Đăng xuất" })).toHaveCount(0);
  await page.getByRole("button", { name: `Tài khoản ${E2E_ADMIN.username}` }).click();
  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("desktop: menu có Lịch giỗ trỏ /anniversaries, nút Đăng xuất và tên đăng nhập hiện", async ({ page }) => {
  await loginAndWait(page, E2E_ADMIN.username, E2E_ADMIN.password);
  const nav = page.getByRole("navigation", { name: "Điều hướng chính" });
  await expect(nav.getByRole("link", { name: "Lịch giỗ" })).toHaveAttribute("href", "/anniversaries");
  await expect(page.getByRole("button", { name: "Đăng xuất" })).toBeVisible();
  await expect(page.getByText(E2E_ADMIN.username, { exact: true })).toBeVisible();
});

test("menu theo vai trò: Admin thấy Quản trị; member không; tên đăng nhập mở Tài khoản của tôi", async ({ page }) => {
  await loginAndWait(page, E2E_ADMIN.username, E2E_ADMIN.password);
  const nav = page.getByRole("navigation", { name: "Điều hướng chính" });
  await expect(nav.getByRole("link", { name: "Quản trị" })).toHaveAttribute("href", "/admin");
  await page.getByRole("link", { name: `Tài khoản của tôi (${E2E_ADMIN.username})` }).click();
  await expect(page).toHaveURL(/\/account$/);
  await page.context().clearCookies();
  await loginAndWait(page, E2E_MEMBER.username, E2E_MEMBER.password);
  await expect(page.getByRole("navigation", { name: "Điều hướng chính" }).getByRole("link", { name: "Quản trị" })).toHaveCount(0);
});

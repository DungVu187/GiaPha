import { expect, test } from "@playwright/test";
import { E2E_ADMIN } from "./fixtures";
import { login } from "./helpers";

test("chưa đăng nhập vào / bị chuyển sang /login", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});

test("sai mật khẩu hiện lỗi, vẫn ở /login", async ({ page }) => {
  await login(page, E2E_ADMIN.username, "sai-mat-khau");
  // Next có route announcer cũng mang role="alert" nên phải lọc theo nội dung.
  await expect(
    page.getByRole("alert").filter({ hasText: "Sai tên đăng nhập hoặc mật khẩu." }),
  ).toBeVisible();
  await expect(page).toHaveURL(/\/login$/);
  expect((await page.context().cookies()).find((c) => c.name === "giapha_session")).toBeUndefined();
});

test("đăng nhập → thấy lời chào → đăng xuất → bị khóa lại", async ({ page }) => {
  await login(page, `  ${E2E_ADMIN.username.toUpperCase()} `, E2E_ADMIN.password);
  await expect(page.getByRole("heading", { name: `Xin chào ${E2E_ADMIN.username}` })).toBeVisible();

  const cookie = (await page.context().cookies()).find((c) => c.name === "giapha_session");
  expect(cookie?.httpOnly).toBe(true);

  await page.reload();
  await expect(page.getByRole("heading", { name: /Xin chào/ })).toBeVisible();

  await page.getByRole("button", { name: "Đăng xuất" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
});

test("đã đăng nhập mà vào /login thì về /", async ({ page }) => {
  await login(page, E2E_ADMIN.username, E2E_ADMIN.password);
  await expect(page.getByRole("heading", { name: /Xin chào/ })).toBeVisible();
  await page.goto("/login");
  await expect(page).toHaveURL(/\/$/);
});

test("GET /api/health qua web (rewrite tới api) trả ok", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  expect((await res.json()).status).toBe("ok");
});

test("để trống form thì không gửi, vẫn ở /login", async ({ page }) => {
  let loginRequests = 0;
  page.on("request", (req) => {
    if (req.method() === "POST" && req.url().includes("/api/auth/login")) loginRequests++;
  });
  await page.goto("/login");
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByLabel("Tên đăng nhập")).toBeFocused();
  expect(loginRequests).toBe(0);
});

test("trang đăng nhập hiển thị đúng trên mobile 390x844", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/login");
  await expect(page.getByLabel("Tên đăng nhập")).toBeVisible();
  await expect(page.getByLabel("Mật khẩu")).toBeVisible();
  await expect(page.getByRole("button", { name: "Đăng nhập" })).toBeVisible();
  const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(scrollWidth).toBeLessThanOrEqual(390);
});

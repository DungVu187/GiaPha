import { expect, test } from "@playwright/test";
import { E2E_ADMIN, E2E_VIEWER } from "./fixtures";
import { loginAndWait } from "./helpers";

test.describe.configure({ mode: "serial", retries: 0 });

test("danh sách nhóm theo đời; tìm khớp tên bố; lọc đời; giữ bộ lọc trên URL", async ({ page }) => {
  await loginAndWait(page, E2E_VIEWER.username, E2E_VIEWER.password);
  await page.goto("/members");
  await expect(page.getByRole("heading", { name: "Thành viên", level: 1 })).toBeVisible();
  await expect(page.getByText(/^\d+ thành viên qua \d+ đời$/)).toBeVisible();
  await expect(page.getByRole("heading", { name: /^Đời 1/, level: 2 })).toBeVisible();
  await expect(page.getByRole("link", { name: "Thêm thành viên" })).toHaveCount(0);

  await page.getByLabel("Tìm theo tên, tên bố hoặc tên mẹ").fill("vu van bo");
  await expect(page.getByRole("status")).toContainText("kết quả cho “vu van bo”");
  await expect(page.getByRole("link", { name: /^VŨ VĂN BỐ,/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /^VŨ VĂN TÔI,/ })).toBeVisible(); // con của VŨ VĂN BỐ
  await expect(page).toHaveURL(/\/members\?q=vu\+van\+bo$/);

  await page.getByRole("button", { name: "Đời 3", exact: true }).click();
  await expect(page.getByRole("button", { name: "Đời 3", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("link", { name: /^VŨ VĂN BỐ,/ })).toHaveCount(0);
  await expect(page.getByRole("link", { name: /^VŨ VĂN TÔI,/ })).toBeVisible();
  await expect(page).toHaveURL(/generation=3/);

  await page.reload();
  await expect(page.getByLabel("Tìm theo tên, tên bố hoặc tên mẹ")).toHaveValue("vu van bo");
  await expect(page.getByRole("button", { name: "Đời 3", exact: true })).toHaveAttribute("aria-pressed", "true");

  await page.getByLabel("Tìm theo tên, tên bố hoặc tên mẹ").fill("khong co ai ten nay");
  await expect(page.getByText("Không tìm thấy thành viên nào.")).toBeVisible();
});

test("admin thấy nút Thêm thành viên; bấm dòng → trang chi tiết", async ({ page }) => {
  await loginAndWait(page, E2E_ADMIN.username, E2E_ADMIN.password);
  await page.goto("/members?q=vu%20van%20toi");
  await expect(page.getByRole("link", { name: "Thêm thành viên" })).toBeVisible();
  await page.getByRole("link", { name: /^VŨ VĂN TÔI,/ }).click();
  await expect(page).toHaveURL(/\/members\/\d+$/);
  await expect(page.getByRole("heading", { name: "VŨ VĂN TÔI", level: 1 })).toBeVisible();
});

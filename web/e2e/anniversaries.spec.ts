import { expect, test } from "@playwright/test";
import { E2E_VIEWER } from "./fixtures";
import { loginAndWait } from "./helpers";

test.describe.configure({ mode: "serial", retries: 0 });

test("lịch giỗ: 12 tháng tới nhóm theo tháng; 30 ngày tới lọc bớt; hôm nay / còn N ngày; bấm → chi tiết", async ({ page }) => {
  await loginAndWait(page, E2E_VIEWER.username, E2E_VIEWER.password);
  await page.getByRole("navigation", { name: "Điều hướng chính" }).getByRole("link", { name: "Lịch giỗ" }).click();
  await expect(page).toHaveURL(/\/anniversaries$/);
  await expect(page.getByRole("heading", { name: "Lịch giỗ", level: 1 })).toBeVisible();
  await expect(page.getByText(/^Hôm nay: .+ năm .+ \(âm lịch\)$/)).toBeVisible();
  await expect(page.getByRole("link", { name: "12 tháng tới" })).toHaveAttribute("aria-current", "page");

  const row = (name: RegExp) => page.getByRole("link", { name });
  await expect(row(/VŨ VĂN GIỖ NAY/)).toContainText("Hôm nay");
  await expect(row(/VŨ VĂN GIỖ GẦN/)).toContainText("Còn 5 ngày");
  await expect(row(/VŨ VĂN GIỖ XA/)).toContainText("Còn 40 ngày");
  await expect(row(/VŨ VĂN GIỖ ÂM/)).toContainText("Âm lịch");
  await expect(page.getByRole("heading", { level: 2, name: /^Tháng \d{1,2}\/\d{4}/ }).first()).toBeVisible();

  await page.getByRole("link", { name: "30 ngày tới" }).click();
  await expect(page).toHaveURL(/range=30/);
  await expect(page.getByRole("link", { name: "30 ngày tới" })).toHaveAttribute("aria-current", "page");
  await expect(row(/VŨ VĂN GIỖ GẦN/)).toBeVisible();
  await expect(row(/VŨ VĂN GIỖ XA/)).toHaveCount(0);

  await row(/VŨ VĂN GIỖ GẦN/).click();
  await expect(page).toHaveURL(/\/members\/\d+$/);
});

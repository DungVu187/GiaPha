import { expect, test } from "@playwright/test";
import { E2E_VIEWER } from "./fixtures";
import { loginAndWait } from "./helpers";

test.describe.configure({ mode: "serial", retries: 0 });

test("dạng danh sách theo nhánh: chuyển chế độ, cùng quy tắc vẽ, thu/mở nhánh, tìm → focus", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("giapha.treeHintDismissed", "1"));
  await loginAndWait(page, E2E_VIEWER.username, E2E_VIEWER.password);
  await page.goto("/tree");
  await page.getByRole("link", { name: "Dạng danh sách" }).click();
  await expect(page).toHaveURL(/\/tree\?view=list$/);

  const list = page.getByRole("list", { name: "Cây gia phả theo nhánh" });
  await expect(list.getByRole("link", { name: "VŨ VĂN ÔNG" })).toBeVisible();
  await expect(list.getByRole("link", { name: "VŨ VĂN TÔI" })).toBeVisible();
  await expect(list.getByRole("link", { name: "LÊ VĂN RỂ" })).toBeVisible(); // chồng của con gái
  await expect(list.getByRole("link", { name: "LÊ VĂN NGOẠI" })).toHaveCount(0); // cháu ngoại không có

  await list.getByRole("button", { name: "Thu gọn nhánh của VŨ VĂN BỐ" }).click();
  await expect(list.getByRole("link", { name: "VŨ VĂN TÔI" })).toHaveCount(0);
  await expect(list.getByRole("button", { name: /^Mở nhánh của VŨ VĂN BỐ \(\d+ người\)$/ })).toBeVisible();

  await page.getByLabel("Tìm người trên cây").fill("vu van toi");
  await page.getByTestId("tree-search-results").getByRole("button", { name: /VŨ VĂN TÔI/ }).click();
  const toi = list.getByRole("link", { name: "VŨ VĂN TÔI" });
  await expect(toi).toBeVisible();
  await expect(toi).toHaveAttribute("data-highlight", "true");
  await expect(toi).toBeFocused();

  await toi.click();
  await expect(page).toHaveURL(/\/members\/\d+$/);
  await page.goto("/tree?view=list");
  await page.getByRole("link", { name: "Xem dạng cây" }).click();
  await expect(page).toHaveURL(/\/tree$/);
});

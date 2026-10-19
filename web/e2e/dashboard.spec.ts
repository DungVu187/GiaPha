import { expect, test } from "@playwright/test";
import { E2E_MEMBER, E2E_VIEWER } from "./fixtures";
import { loginAndWait, memberIdByName } from "./helpers";

test.describe.configure({ mode: "serial", retries: 0 });

test("member đã liên kết: lời chào + đời, bố, giỗ 30 ngày, hồ sơ của tôi, ô tìm sang danh sách", async ({ page }) => {
  await loginAndWait(page, E2E_MEMBER.username, E2E_MEMBER.password);
  await expect(page.getByRole("heading", { name: "GIA PHẢ HỌ VŨ", level: 1 })).toBeVisible();
  await expect(page.getByRole("heading", { name: /^Xin chào, VŨ VĂN TÔI/ })).toContainText("Đời 3");
  await expect(page.getByText(/^Con ông VŨ VĂN BỐ\. Gia phả hiện có \d+ thành viên qua \d+ đời\.$/)).toBeVisible();

  const upcoming = page.getByRole("region", { name: "Giỗ trong 30 ngày tới" });
  await expect(upcoming.getByRole("link", { name: /VŨ VĂN GIỖ GẦN/ })).toContainText("Còn 5 ngày");
  await expect(upcoming.getByRole("link", { name: /VŨ VĂN GIỖ XA/ })).toHaveCount(0);
  await expect(page.getByRole("main").getByRole("link", { name: /Tài khoản của tôi/ })).toHaveCount(0);

  const toi = await memberIdByName(page, "Vũ Văn Tôi");
  await expect(page.getByRole("link", { name: /Hồ sơ của tôi/ })).toHaveAttribute("href", `/members/${toi}`);

  await page.getByLabel("Tìm thành viên").fill("vu van bo");
  await page.getByLabel("Tìm thành viên").press("Enter");
  await expect(page).toHaveURL(/\/members\?q=vu\+van\+bo$/);
  await expect(page.getByLabel("Tìm theo tên, tên bố hoặc tên mẹ")).toHaveValue("vu van bo");
});

test("tài khoản chưa liên kết: chào bằng tên đăng nhập, không có Hồ sơ của tôi", async ({ page }) => {
  await loginAndWait(page, E2E_VIEWER.username, E2E_VIEWER.password);
  await expect(page.getByRole("heading", { name: `Xin chào, ${E2E_VIEWER.username}` })).toBeVisible();
  await expect(page.getByRole("link", { name: /Hồ sơ của tôi/ })).toHaveCount(0);
});

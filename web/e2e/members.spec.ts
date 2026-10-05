import { expect, test, type Page } from "@playwright/test";
import { E2E_ADMIN } from "./fixtures";
import { loginAndWait, memberIdByName } from "./helpers";

// Các test dựa vào dữ liệu do test trước tạo (cụ → con → cháu) nên chạy tuần tự.
// Không retry: chạy lại cả nhóm trên DB không reset sẽ tạo trùng tên → chắc chắn đỏ.
test.describe.configure({ mode: "serial", retries: 0 });

test.beforeEach(async ({ page }) => {
  await loginAndWait(page, E2E_ADMIN.username, E2E_ADMIN.password);
});

async function openMember(page: Page, name: string) {
  await page.goto(`/members/${await memberIdByName(page, name)}`);
  await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
}

// Hộp thoại "Thêm …" của admin: chuyển sang tab tạo người mới, điền tên, (chọn giới tính), bấm Thêm.
async function addNewRelative(page: Page, button: string, name: string, gender?: "Nam" | "Nữ") {
  await page.getByRole("button", { name: button }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("tab", { name: "Tạo người mới" }).click();
  await dialog.getByLabel("Họ và tên *").fill(name);
  if (gender) await dialog.getByRole("button", { name: gender, exact: true }).click();
  await dialog.getByRole("button", { name: "Thêm", exact: true }).click();
  await expect(dialog).toBeHidden();
}

test("nhánh 3 đời: cụ → con (+ vợ) → cháu, đời tự tính", async ({ page }) => {
  await page.goto("/members");
  await page.getByRole("link", { name: "Thêm thành viên" }).click();
  await page.getByLabel("Họ và tên *").fill("vũ văn cụ");
  await page.getByRole("button", { name: "Nam", exact: true }).click();
  await page.getByLabel("Đời *").fill("1");
  await page.getByRole("button", { name: "Lưu thành viên" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "VŨ VĂN CỤ" })).toBeVisible();
  await expect(page.getByText("Đời 1", { exact: true }).first()).toBeVisible();

  await addNewRelative(page, "Thêm con", "vũ văn con", "Nam");
  await expect(page.getByRole("heading", { name: "Con (1)" })).toBeVisible();

  await page.getByRole("link", { name: /VŨ VĂN CON/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "VŨ VĂN CON" })).toBeVisible();
  await expect(page.getByText("Đời 2", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Con của ông VŨ VĂN CỤ")).toBeVisible();

  await addNewRelative(page, "Thêm vợ", "lê thị dâu");
  await expect(page.getByRole("heading", { name: "Vợ", exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /LÊ THỊ DÂU/ })).toBeVisible();

  await addNewRelative(page, "Thêm con", "vũ văn cháu", "Nam");
  await page.getByRole("link", { name: /VŨ VĂN CHÁU/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "VŨ VĂN CHÁU" })).toBeVisible();
  await expect(page.getByText("Đời 3", { exact: true }).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /VŨ VĂN CON/ })).toBeVisible(); // Bố
  await expect(page.getByRole("link", { name: /LÊ THỊ DÂU/ })).toBeVisible(); // Mẹ
});

test("đã khuất + giỗ gợi ý theo âm lịch", async ({ page }) => {
  await openMember(page, "VŨ VĂN CỤ");
  await page.getByRole("link", { name: "Sửa thông tin" }).click();
  await page.getByRole("button", { name: "Đã khuất" }).click();
  await page.locator("#death-day").fill("15");
  await page.locator("#death-month").fill("09");
  await page.locator("#death-year").fill("1998");
  await page.locator("#deathCalendar-SOLAR").click();
  await expect(page.getByText(/Gợi ý từ ngày mất/)).toBeVisible();
  await page.getByRole("button", { name: "Dùng gợi ý" }).click();
  await page.getByRole("button", { name: "Lưu thành viên" }).click();

  await expect(page.getByRole("heading", { level: 1, name: "VŨ VĂN CỤ" })).toBeVisible();
  await expect(page.getByText("ĐÃ KHUẤT").first()).toBeVisible();
  await expect(page.getByText("Ngày giỗ", { exact: true })).toBeVisible();
  await expect(page.getByText(/\d\d\/\d\d Âm lịch/)).toBeVisible();
  await expect(page.getByText(/Giỗ tới:/)).toBeVisible();
});

test("người còn sống không hiện chữ 'Còn sống'", async ({ page }) => {
  await openMember(page, "VŨ VĂN CON");
  await expect(page.getByText("Còn sống")).toHaveCount(0);
});

test("ngày sinh không đầy đủ: chỉ năm được; có ngày thiếu tháng bị báo lỗi", async ({ page }) => {
  await openMember(page, "VŨ VĂN CON");
  await page.getByRole("link", { name: "Sửa thông tin" }).click();
  await page.locator("#birth-year").fill("1950");
  await page.getByRole("button", { name: "Lưu thành viên" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "VŨ VĂN CON" })).toBeVisible();
  await expect(page.getByText("1950", { exact: true })).toBeVisible();

  await page.getByRole("link", { name: "Sửa thông tin" }).click();
  await page.locator("#birth-day").fill("5");
  await page.getByRole("button", { name: "Lưu thành viên" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Có ngày thì phải có tháng." })).toBeVisible();
});

test("tìm không dấu", async ({ page }) => {
  await page.goto("/members");
  await page.getByLabel("Tìm thành viên").fill("vu van chau");
  await expect(page.getByRole("link", { name: /VŨ VĂN CHÁU/ })).toBeVisible();
});

test("tải ảnh đại diện", async ({ page }) => {
  await openMember(page, "VŨ VĂN CỤ");
  await page.locator('input[type="file"]').setInputFiles("e2e/files/avatar.png");
  const img = page.locator('img[alt="VŨ VĂN CỤ"]');
  await expect(img).toBeVisible();
  const src = await img.getAttribute("src");
  expect(src).toMatch(/^\/uploads\/avatars\//);
  expect((await page.request.get(src!)).status()).toBe(200);
});

test("xóa: bị chặn khi còn con; xóa được người không có con", async ({ page }) => {
  await openMember(page, "VŨ VĂN CON");
  await page.getByRole("button", { name: "Xóa", exact: true }).click();
  await page.getByRole("button", { name: "Xóa thành viên" }).click();
  await expect(
    page.getByRole("alert").filter({ hasText: "Không thể xóa: người này còn con trong gia phả. Hãy gỡ quan hệ con trước." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Hủy" }).click();

  await page.goto("/members/new");
  await page.getByLabel("Họ và tên *").fill("vũ văn tạm");
  await page.getByLabel("Đời *").fill("1");
  await page.getByRole("button", { name: "Lưu thành viên" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "VŨ VĂN TẠM" })).toBeVisible();
  await page.getByRole("button", { name: "Xóa", exact: true }).click();
  await page.getByRole("button", { name: "Xóa thành viên" }).click();
  await expect(page).toHaveURL(/\/members$/);
  await page.getByLabel("Tìm thành viên").fill("vu van tam");
  await expect(page.getByText("Không tìm thấy thành viên nào.")).toBeVisible();
});

test("Enter trong ô chọn bố không submit form (không mất quan hệ bố)", async ({ page }) => {
  await openMember(page, "VŨ VĂN CHÁU");
  await page.getByRole("link", { name: "Sửa thông tin" }).click();
  await expect(page).toHaveURL(/\/edit$/);
  const editUrl = page.url();
  await page.getByRole("button", { name: "Bỏ chọn bố" }).click();
  await page.getByRole("combobox", { name: "Bố" }).fill("vu van");
  await page.getByRole("combobox", { name: "Bố" }).press("Enter");
  await page.waitForTimeout(1000);
  expect(page.url()).toBe(editUrl);
  await expect(page.getByRole("button", { name: "Lưu thành viên" })).toBeVisible();

  await openMember(page, "VŨ VĂN CHÁU");
  await expect(page.getByRole("link", { name: /VŨ VĂN CON/ })).toBeVisible(); // Bố vẫn còn
});

test("form chặn chọn con cháu của mình làm bố", async ({ page }) => {
  await openMember(page, "VŨ VĂN CỤ");
  await page.getByRole("link", { name: "Sửa thông tin" }).click();
  await page.getByRole("combobox", { name: "Bố" }).fill("vu van chau");
  await page.getByRole("option", { name: /VŨ VĂN CHÁU/ }).click();
  await page.getByRole("button", { name: "Lưu thành viên" }).click();
  await expect(page.getByRole("alert").filter({ hasText: "Không thể chọn con cháu của mình làm bố." })).toBeVisible();
});

import { expect, test, type Page } from "@playwright/test";
import { E2E_MEMBER } from "./fixtures";
import { loginAndWait } from "./helpers";

test.describe.configure({ mode: "serial", retries: 0 });

const PASSWORD = "MatKhauDangKy@2026";

async function fillRegister(page: Page, data: { username: string; fullName: string; generation: string; email?: string }) {
  await page.goto("/register");
  await page.getByLabel("Tên đăng nhập").fill(data.username);
  await page.getByLabel("Mật khẩu").fill(PASSWORD);
  await page.getByLabel("Họ và tên").fill(data.fullName);
  await page.getByLabel("Đời").selectOption(data.generation);
  if (data.email) await page.getByLabel("Email (không bắt buộc)").fill(data.email);
  await page.getByRole("button", { name: "Đăng ký" }).click();
}

async function myMemberId(page: Page): Promise<number> {
  const me = await page.request.get("/api/auth/me");
  return ((await me.json()) as { memberId: number }).memberId;
}

test("trang đăng nhập có link Đăng ký và ngược lại", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("link", { name: "Đăng ký" }).click();
  await expect(page).toHaveURL(/\/register$/);
  await expect(page.getByRole("heading", { name: "Đăng ký tài khoản" })).toBeVisible();
  await page.getByRole("link", { name: "Đăng nhập" }).click();
  await expect(page).toHaveURL(/\/login$/);
});

test("xem trước họ tên IN HOA và báo lỗi theo từng ô", async ({ page }) => {
  await page.goto("/register");
  await page.getByLabel("Họ và tên").fill("  vũ   đức dũng ");
  await expect(page.getByText("Sẽ lưu thành: VŨ ĐỨC DŨNG")).toBeVisible();
  await page.getByLabel("Tên đăng nhập").fill("ab");
  await page.getByLabel("Mật khẩu").fill("123");
  await page.getByRole("button", { name: "Đăng ký" }).click();
  await expect(page.getByText("Tên đăng nhập 3–32 ký tự, chỉ gồm chữ thường không dấu, số, dấu chấm (.) hoặc gạch dưới (_).")).toBeVisible();
  await expect(page.getByText("Mật khẩu phải có ít nhất 8 ký tự.")).toBeVisible();
  await expect(page.getByText("Vui lòng chọn đời.")).toBeVisible();
  await expect(page.getByLabel("Tên đăng nhập")).toBeFocused();
  await expect(page).toHaveURL(/\/register$/);
});

test("tên đăng nhập đã có người dùng", async ({ page }) => {
  await fillRegister(page, { username: E2E_MEMBER.username, fullName: "vũ văn khác", generation: "7" });
  await expect(page.getByText("Tên đăng nhập đã có người dùng.")).toBeVisible();
});

test("không ai trùng → tạo hồ sơ mới, vào trang chủ, sửa được hồ sơ của mình", async ({ page }) => {
  await fillRegister(page, { username: "reg_moi_e2e", fullName: "vũ thị mới", generation: "6", email: "Moi@Email.vn" });
  await expect(page.getByRole("heading", { name: "Xin chào reg_moi_e2e" })).toBeVisible();
  const id = await myMemberId(page);
  await page.goto(`/members/${id}`);
  await expect(page.getByRole("heading", { level: 1, name: "VŨ THỊ MỚI" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sửa thông tin" })).toBeVisible();
});

test("trùng tên + đời → thấy 2 hồ sơ → Đây là tôi → nhận đúng hồ sơ có bố mẹ", async ({ page }) => {
  await fillRegister(page, { username: "reg_dung1_e2e", fullName: "vũ đức dũng", generation: "5" });
  await expect(page.getByRole("heading", { name: "Phát hiện thành viên đã tồn tại" })).toBeVisible();
  const cards = page.getByRole("list").getByRole("listitem");
  await expect(cards).toHaveCount(2);
  const withParents = cards.filter({ hasText: "VŨ ĐỨC THỊNH" });
  await expect(withParents).toContainText("TRẦN THỊ LAN");
  await expect(withParents).toContainText("18/07/2003");
  const other = cards.filter({ hasText: "VŨ VĂN BÌNH" });
  await expect(other).toContainText("Mẹ: Chưa có thông tin");
  await expect(other).toContainText("1998");

  // Sửa thông tin đăng ký → quay lại form, giữ nguyên dữ liệu đã nhập.
  await page.getByRole("button", { name: "Sửa thông tin đăng ký" }).click();
  await expect(page.getByLabel("Tên đăng nhập")).toHaveValue("reg_dung1_e2e");
  await expect(page.getByLabel("Họ và tên")).toHaveValue("vũ đức dũng");
  await page.getByRole("button", { name: "Đăng ký" }).click();

  await page.getByRole("listitem").filter({ hasText: "VŨ ĐỨC THỊNH" }).getByRole("button", { name: "Đây là tôi" }).click();
  await expect(page.getByRole("heading", { name: "Xin chào reg_dung1_e2e" })).toBeVisible();
  await page.goto(`/members/${await myMemberId(page)}`);
  await expect(page.getByText("VŨ ĐỨC THỊNH").first()).toBeVisible();
  await expect(page.getByRole("link", { name: "Sửa thông tin" })).toBeVisible();
});

test("người thứ hai cùng tên + đời chỉ còn 1 hồ sơ → Tạo thành viên mới", async ({ page }) => {
  await fillRegister(page, { username: "reg_dung2_e2e", fullName: "Vũ Đức Dũng", generation: "5" });
  const cards = page.getByRole("list").getByRole("listitem");
  await expect(cards).toHaveCount(1);
  await expect(cards).toContainText("VŨ VĂN BÌNH");
  await page.getByRole("button", { name: "Tạo thành viên mới" }).click();
  await expect(page.getByRole("heading", { name: "Xin chào reg_dung2_e2e" })).toBeVisible();
  const id = await myMemberId(page);
  const detail = await (await page.request.get(`/api/members/${id}`)).json();
  expect(detail).toMatchObject({ fullName: "VŨ ĐỨC DŨNG", generation: 5, fatherId: null });
});

test("đã đăng nhập mà vào /register → về trang chủ", async ({ page }) => {
  await loginAndWait(page, "reg_moi_e2e", PASSWORD);
  await page.goto("/register");
  await expect(page).toHaveURL(/\/$/);
});

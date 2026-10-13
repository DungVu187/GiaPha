import { expect, test, type Page } from "@playwright/test";
import { E2E_ADMIN, E2E_MEMBER, E2E_VIEWER } from "./fixtures";
import { loginAndWait, memberIdByName } from "./helpers";

// Chỉ đọc dữ liệu; không phụ thuộc số lượng tuyệt đối vì spec khác có thể thêm người.
test.describe.configure({ mode: "serial", retries: 0 });

const lineage = (page: Page, id: number) => page.locator(`[data-member-id="${id}"][data-kind="lineage"]`);
const zoomPct = async (page: Page) =>
  Number.parseInt((await page.getByTestId("zoom-level").textContent()) ?? "0", 10);

test("menu Cây gia phả → dải đời, khối gia đình, con gái có chồng nhưng không có cháu ngoại", async ({ page }) => {
  await loginAndWait(page, E2E_ADMIN.username, E2E_ADMIN.password);
  await page.getByRole("link", { name: "Cây gia phả" }).click();
  await expect(page).toHaveURL(/\/tree$/);
  await expect(page.getByRole("link", { name: "Cây gia phả" })).toHaveAttribute("aria-current", "page");
  const ong = await memberIdByName(page, "Vũ Văn Ông");
  await expect(lineage(page, ong)).toBeVisible();
  await expect(page.locator('[data-band="1"]')).toBeVisible();
  await expect(page.locator('[data-band="1"]')).toContainText("Đời");
  const gai = await memberIdByName(page, "Vũ Thị Gái");
  const re = await memberIdByName(page, "Lê Văn Rể");
  await expect(lineage(page, gai)).toHaveCount(1);
  await expect(page.locator(`[data-member-id="${re}"][data-kind="spouse"]`)).toHaveCount(1);
  const ngoai = await memberIdByName(page, "Lê Văn Ngoại");
  await expect(page.locator(`[data-member-id="${ngoai}"]`)).toHaveCount(0);
});

test("vợ ngoài họ nằm trong khối gia đình nhà chồng", async ({ page }) => {
  await loginAndWait(page, E2E_ADMIN.username, E2E_ADMIN.password);
  await page.goto("/tree");
  const lan = await memberIdByName(page, "Trần Thị Lan");
  await expect(page.locator(`[data-member-id="${lan}"][data-kind="spouse"]`)).toHaveCount(1);
});

test("tìm không dấu → bấm kết quả → tô sáng; không tìm thấy cháu ngoại", async ({ page }) => {
  await loginAndWait(page, E2E_ADMIN.username, E2E_ADMIN.password);
  await page.goto("/tree");
  const search = page.getByLabel("Tìm người trên cây");
  await search.fill("vu van toi");
  await expect(page.getByText(/\d+ kết quả \(tìm không dấu\)/)).toBeVisible();
  const hit = page.getByTestId("tree-search-results").getByRole("button", { name: /VŨ VĂN TÔI/ });
  await expect(hit).toContainText("Đời 3 — con VŨ VĂN BỐ");
  await hit.click();
  const toi = await memberIdByName(page, "Vũ Văn Tôi");
  await expect(lineage(page, toi)).toHaveAttribute("data-highlight", "true");
  await expect(lineage(page, toi)).toBeInViewport();
  await search.fill("le van ngoai");
  await expect(page.getByText("Không tìm thấy trên cây.")).toBeVisible();
});

test("thu gọn nhánh → ẩn con cháu, hiện số người; mở lại → hiện lại", async ({ page }) => {
  await loginAndWait(page, E2E_ADMIN.username, E2E_ADMIN.password);
  const ong = await memberIdByName(page, "Vũ Văn Ông");
  const toi = await memberIdByName(page, "Vũ Văn Tôi");
  await page.goto(`/tree?focus=${ong}`);
  await expect(lineage(page, toi)).toHaveCount(1);
  await page.getByRole("button", { name: "Thu gọn nhánh của VŨ VĂN ÔNG" }).click();
  await expect(page.locator(`[data-member-id="${toi}"]`)).toHaveCount(0);
  const expand = page.getByRole("button", { name: /^Mở nhánh của VŨ VĂN ÔNG \(\d+ người\)$/ });
  await expect(expand).toHaveAttribute("aria-expanded", "false");
  await expect(expand).toContainText(/\+ \d+ người/);
  await expand.click();
  await expect(lineage(page, toi)).toHaveCount(1);
});

test("bấm thẻ → trang chi tiết; Xem trên cây → quay lại cây, tô sáng đúng người", async ({ page }) => {
  await loginAndWait(page, E2E_ADMIN.username, E2E_ADMIN.password);
  const bo = await memberIdByName(page, "Vũ Văn Bố");
  await page.goto(`/tree?focus=${bo}`);
  await lineage(page, bo).click();
  await expect(page).toHaveURL(new RegExp(`/members/${bo}$`));
  await page.getByRole("link", { name: "Xem trên cây" }).click();
  await expect(page).toHaveURL(new RegExp(`/tree\\?focus=${bo}$`));
  await expect(lineage(page, bo)).toHaveAttribute("data-highlight", "true");
  await expect(lineage(page, bo)).toBeInViewport();
});

test("thành viên liên kết: Về hồ sơ của tôi → tô sáng chính mình", async ({ page }) => {
  await loginAndWait(page, E2E_MEMBER.username, E2E_MEMBER.password);
  await page.goto("/tree");
  await page.getByRole("button", { name: "Về hồ sơ của tôi" }).click();
  const toi = await memberIdByName(page, "Vũ Văn Tôi");
  await expect(lineage(page, toi)).toHaveAttribute("data-highlight", "true");
});

test("nút zoom: phóng to tăng %, thu nhỏ giảm %", async ({ page }) => {
  await loginAndWait(page, E2E_ADMIN.username, E2E_ADMIN.password);
  await page.goto("/tree");
  await page.getByRole("button", { name: "Vừa màn hình" }).click();
  await expect(page.getByTestId("zoom-level")).toHaveText(/^\d+%$/);
  const fit = await zoomPct(page);
  await page.getByRole("button", { name: "Phóng to" }).click();
  await expect.poll(() => zoomPct(page)).toBeGreaterThan(fit);
  const zoomed = await zoomPct(page);
  await page.getByRole("button", { name: "Thu nhỏ" }).click();
  await expect.poll(() => zoomPct(page)).toBeLessThan(zoomed);
});

test("tài khoản chưa liên kết: trang chi tiết có Xem trên cây, không có Sửa thông tin", async ({ page }) => {
  await loginAndWait(page, E2E_VIEWER.username, E2E_VIEWER.password);
  const bo = await memberIdByName(page, "Vũ Văn Bố");
  await page.goto(`/members/${bo}`);
  await expect(page.getByRole("link", { name: "Xem trên cây" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sửa thông tin" })).toHaveCount(0);
});

test("focus người nhánh ngoại → báo không có trên cây", async ({ page }) => {
  await loginAndWait(page, E2E_ADMIN.username, E2E_ADMIN.password);
  const ngoai = await memberIdByName(page, "Lê Văn Ngoại");
  await page.goto(`/tree?focus=${ngoai}`);
  await expect(
    page.getByRole("status").filter({ hasText: "Người này không có trên cây gia phả (nhánh ngoại)." }),
  ).toBeVisible();
  await expect(page.locator(`[data-member-id="${ngoai}"]`)).toHaveCount(0);
});

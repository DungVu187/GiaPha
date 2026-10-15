import { expect, test, type Page } from "@playwright/test";
import { E2E_ADMIN, E2E_MEMBER, E2E_VIEWER } from "./fixtures";
import { loginAndWait, memberIdByName } from "./helpers";

// Chỉ đọc dữ liệu; không phụ thuộc số lượng tuyệt đối vì spec khác có thể thêm người.
test.describe.configure({ mode: "serial", retries: 0 });

const lineage = (page: Page, id: number) => page.locator(`[data-member-id="${id}"][data-kind="lineage"]`);
const zoomPct = async (page: Page) =>
  Number.parseInt((await page.getByTestId("zoom-level").textContent()) ?? "0", 10);

// Gợi ý thao tác lần đầu có thể che phần tử cần bấm → coi như đã đóng, trừ test kiểm chính gợi ý đó.
test.beforeEach(async ({ page }, info) => {
  if (!info.title.startsWith("thu nhỏ dưới 50%"))
    await page.addInitScript(() => localStorage.setItem("giapha.treeHintDismissed", "1"));
});

test("menu Cây gia phả → dải đời, khối gia đình, con gái có chồng nhưng không có cháu ngoại", async ({ page }) => {
  await loginAndWait(page, E2E_ADMIN.username, E2E_ADMIN.password);
  const nav = page.getByRole("navigation", { name: "Điều hướng chính" });
  await nav.getByRole("link", { name: "Cây gia phả" }).click();
  await expect(page).toHaveURL(/\/tree$/);
  await expect(nav.getByRole("link", { name: "Cây gia phả" })).toHaveAttribute("aria-current", "page");
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
  // Chọn xong → thu danh sách (không che thẻ), giữ chữ trong ô; focus lại ô → mở lại.
  await expect(page.getByTestId("tree-search-results")).toBeHidden();
  await expect(search).toHaveValue("vu van toi");
  await search.focus();
  await expect(page.getByTestId("tree-search-results")).toBeVisible();
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
  // Khối thu gọn hẹp lại nên nút mở có thể lệch khỏi khung nhìn — căn lại khối Ông bằng ô tìm rồi mới bấm.
  await page.getByLabel("Tìm người trên cây").fill("vu van ong");
  await page.getByTestId("tree-search-results").getByRole("button", { name: /VŨ VĂN ÔNG/ }).click();
  await expect(expand).toBeInViewport();
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

test("kéo chuột bắt đầu trên thẻ → cây di chuyển, không mở trang chi tiết", async ({ page }) => {
  await loginAndWait(page, E2E_ADMIN.username, E2E_ADMIN.password);
  const bo = await memberIdByName(page, "Vũ Văn Bố");
  await page.goto(`/tree?focus=${bo}`);
  const card = lineage(page, bo);
  await expect(card).toBeInViewport();
  const before = (await card.boundingBox())!;
  const x = before.x + before.width / 2;
  const y = before.y + before.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 200, y + 50, { steps: 10 });
  await page.mouse.up();
  await expect.poll(async () => (await card.boundingBox())!.x - before.x).toBeGreaterThan(150);
  await expect(page).toHaveURL(new RegExp(`/tree\\?focus=${bo}$`));
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
  // fitView chạy có hiệu ứng → chờ % đứng yên rồi mới lấy mốc.
  let fit = -1;
  await expect.poll(async () => {
    const prev = fit;
    fit = await zoomPct(page);
    return fit === prev;
  }).toBe(true);
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
  const notice = page.getByRole("status").filter({ hasText: /không có trên cây gia phả/ });
  await expect(notice).toBeVisible();
  await expect(page.locator(`[data-member-id="${ngoai}"]`)).toHaveCount(0);
  await page.getByRole("button", { name: "Đóng thông báo" }).click();
  await expect(notice).toHaveCount(0);
});

test("mở trang ở zoom đọc được (≥ 60%), nhãn đời ghim mép trái khi kéo", async ({ page }) => {
  await loginAndWait(page, E2E_MEMBER.username, E2E_MEMBER.password);
  await page.goto("/tree");
  await expect.poll(() => zoomPct(page)).toBeGreaterThanOrEqual(60);
  const toi = await memberIdByName(page, "Vũ Văn Tôi");
  await expect(lineage(page, toi)).toBeInViewport();
  const label = page.locator('[data-band="3"]');
  await expect(label).toContainText("Đời");
  const before = (await label.boundingBox())!.x;
  const pane = page.locator(".react-flow__pane");
  const box = (await pane.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 - 300, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  expect((await label.boundingBox())!.x).toBeCloseTo(before, 0);
});

test("thu nhỏ dưới 50% → thẻ chỉ còn tên; thẻ vợ/chồng ghi 'vợ của …'", async ({ page }) => {
  await loginAndWait(page, E2E_ADMIN.username, E2E_ADMIN.password);
  const lan = await memberIdByName(page, "Trần Thị Lan");
  await page.goto(`/tree?focus=${lan}`);
  const spouse = page.locator(`[data-member-id="${lan}"][data-kind="spouse"]`);
  await expect(spouse).toContainText("vợ của VŨ");
  await expect(page.getByText(/^Kéo để di chuyển|^Chụm hai ngón/).first()).toBeVisible();
  await page.getByRole("button", { name: "Đã hiểu" }).click();
  await page.reload();
  await expect(page.getByRole("button", { name: "Đã hiểu" })).toHaveCount(0);
  for (let i = 0; i < 6; i++) await page.getByRole("button", { name: "Thu nhỏ" }).click();
  await expect.poll(() => zoomPct(page)).toBeLessThan(50);
  await expect(spouse).not.toContainText("vợ của");
  await expect(spouse).toContainText("TRẦN THỊ LAN");
});

test("chọn kết quả tìm → focus bàn phím vào thẻ", async ({ page }) => {
  await loginAndWait(page, E2E_ADMIN.username, E2E_ADMIN.password);
  await page.goto("/tree");
  await page.getByLabel("Tìm người trên cây").fill("vu van toi");
  await page.getByTestId("tree-search-results").getByRole("button", { name: /VŨ VĂN TÔI/ }).click();
  const toi = await memberIdByName(page, "Vũ Văn Tôi");
  await expect(lineage(page, toi)).toBeFocused();
});

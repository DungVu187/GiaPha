import { expect, test } from "@playwright/test";
import { E2E_MEMBER, E2E_VIEWER } from "./fixtures";
import { loginAndWait, memberIdByName } from "./helpers";

// Test "thêm con" ghi dữ liệu và CI có retries → chạy tuần tự, đúng thứ tự.
test.describe.configure({ mode: "serial" });

test("member_e2e: nút hiển thị theo người thân trực tiếp", async ({ page }) => {
  await loginAndWait(page, E2E_MEMBER.username, E2E_MEMBER.password);

  await page.goto(`/members/${await memberIdByName(page, "VŨ VĂN TÔI")}`);
  await expect(page.getByRole("link", { name: "Sửa thông tin" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Thêm con" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Xóa", exact: true })).toHaveCount(0);

  await page.goto(`/members/${await memberIdByName(page, "VŨ VĂN BỐ")}`);
  await expect(page.getByRole("link", { name: "Sửa thông tin" })).toBeVisible();

  for (const name of ["VŨ VĂN BÁC", "VŨ VĂN ÔNG"]) {
    await page.goto(`/members/${await memberIdByName(page, name)}`);
    await expect(page.getByRole("heading", { level: 1, name })).toBeVisible();
    await expect(page.getByRole("link", { name: "Sửa thông tin" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Thêm con" })).toHaveCount(0);
  }
});

test("member_e2e: gọi thẳng API ghi vào người không được phép → 403", async ({ page }) => {
  await loginAndWait(page, E2E_MEMBER.username, E2E_MEMBER.password);
  const bac = await memberIdByName(page, "VŨ VĂN BÁC");
  const toi = await memberIdByName(page, "VŨ VĂN TÔI");

  expect((await page.request.put(`/api/members/${bac}`, { data: { fullName: "x", generation: 2 } })).status()).toBe(403);
  expect((await page.request.delete(`/api/members/${toi}`)).status()).toBe(403);
  expect((await page.request.post("/api/members", { data: { fullName: "x", generation: 1 } })).status()).toBe(403);
  // R12: không được gắn người có sẵn làm quan hệ.
  const res = await page.request.post(`/api/members/${toi}/relatives`, {
    data: { relation: "SPOUSE", existingId: bac },
  });
  expect(res.status()).toBe(403);
});

test("member_e2e: bố/mẹ chỉ đọc, hộp thoại Thêm con không có tab chọn người có sẵn", async ({ page }) => {
  await loginAndWait(page, E2E_MEMBER.username, E2E_MEMBER.password);

  await page.goto(`/members/${await memberIdByName(page, "VŨ VĂN BỐ")}/edit`);
  await expect(page.getByText("Chỉ quản trị viên được đổi bố/mẹ.")).toBeVisible();
  await expect(page.getByRole("combobox")).toHaveCount(0);

  await page.goto(`/members/${await memberIdByName(page, "VŨ VĂN TÔI")}`);
  await page.getByRole("button", { name: "Thêm con" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByLabel("Họ và tên *")).toBeVisible();
  await expect(dialog.getByRole("tab")).toHaveCount(0);
  await expect(dialog.getByText("Chọn người có sẵn")).toHaveCount(0);
});

test("member_e2e: thêm con cho chính mình → đời 4", async ({ page }) => {
  await loginAndWait(page, E2E_MEMBER.username, E2E_MEMBER.password);
  await page.goto(`/members/${await memberIdByName(page, "VŨ VĂN TÔI")}`);
  await page.getByRole("button", { name: "Thêm con" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Họ và tên *").fill("vũ văn bé");
  await dialog.getByRole("button", { name: "Nam", exact: true }).click();
  await dialog.getByRole("button", { name: "Thêm", exact: true }).click();
  await expect(dialog).toBeHidden();
  await page.getByRole("link", { name: /VŨ VĂN BÉ/ }).click();
  await expect(page.getByRole("heading", { level: 1, name: "VŨ VĂN BÉ" })).toBeVisible();
  await expect(page.getByText("Đời 4", { exact: true }).first()).toBeVisible();
});

test("member_e2e: /members/new và sửa người lạ bị từ chối", async ({ page }) => {
  await loginAndWait(page, E2E_MEMBER.username, E2E_MEMBER.password);
  await page.goto("/members/new");
  await expect(page.getByText("Chỉ quản trị viên được thêm thành viên độc lập.")).toBeVisible();
  await page.goto(`/members/${await memberIdByName(page, "VŨ VĂN BÁC")}/edit`);
  await expect(page.getByText("Bạn không có quyền sửa thành viên này.")).toBeVisible();
});

test("viewer_e2e (chưa liên kết): chỉ xem, API ghi → 403", async ({ page }) => {
  await loginAndWait(page, E2E_VIEWER.username, E2E_VIEWER.password);
  const toi = await memberIdByName(page, "VŨ VĂN TÔI");
  await page.goto(`/members/${toi}`);
  await expect(page.getByRole("heading", { level: 1, name: "VŨ VĂN TÔI" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sửa thông tin" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /^(Thêm|Xóa|Đổi ảnh)/ })).toHaveCount(0);
  expect((await page.request.put(`/api/members/${toi}`, { data: { fullName: "x", generation: 3 } })).status()).toBe(403);
});

import type { Page } from "@playwright/test";

export async function login(page: Page, username: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Tên đăng nhập").fill(username);
  await page.getByLabel("Mật khẩu").fill(password);
  await page.getByRole("button", { name: "Đăng nhập" }).click();
}

// Đăng nhập xong thì vào được trang chủ (lời chào) — dùng để chờ phiên sẵn sàng.
export async function loginAndWait(page: Page, username: string, password: string) {
  await login(page, username, password);
  await page.waitForURL((url) => !url.pathname.startsWith("/login"));
}

export async function memberIdByName(page: Page, name: string): Promise<number> {
  const res = await page.request.get(`/api/members?q=${encodeURIComponent(name)}&limit=20`);
  const list = (await res.json()) as { id: number; fullName: string }[];
  const found = list.find((m) => m.fullName === name.toLocaleUpperCase("vi"));
  if (!found) throw new Error(`Không thấy thành viên ${name}`);
  return found.id;
}

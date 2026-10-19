/**
 * Hỏi API quên mật khẩu đã bật chưa. Mọi lỗi (5xx, lỗi mạng, body hỏng) → false: trang đăng nhập / quên mật khẩu
 * vẫn hiện được, chỉ ẩn link "Quên mật khẩu?".
 */
export async function fetchPasswordResetEnabled(apiUrl: string, fetchFn: typeof fetch = fetch): Promise<boolean> {
  try {
    const res = await fetchFn(`${apiUrl}/api/auth/password-reset/enabled`, { cache: "no-store" });
    if (!res.ok) return false;
    const body = (await res.json()) as { enabled?: unknown } | null;
    return body?.enabled === true;
  } catch {
    return false;
  }
}

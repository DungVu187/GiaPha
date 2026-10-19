import { MAX_PASSWORD_LENGTH, MIN_PASSWORD_LENGTH } from './password.js';

export const EMAIL_INVALID = 'Email không hợp lệ.';
const MAX_EMAIL_LENGTH = 254;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Lỗi của mật khẩu mới, hoặc null. Tối thiểu đo theo NFC (cùng dạng lúc băm); tối đa đo trên chuỗi thô (khớp login). */
export function newPasswordError(password: unknown): string | null {
  if (typeof password !== 'string' || !password)
    return 'Vui lòng nhập mật khẩu.';
  if (password.normalize('NFC').length < MIN_PASSWORD_LENGTH)
    return `Mật khẩu phải có ít nhất ${MIN_PASSWORD_LENGTH} ký tự.`;
  if (password.length > MAX_PASSWORD_LENGTH)
    return `Mật khẩu tối đa ${MAX_PASSWORD_LENGTH} ký tự.`;
  return null;
}

/** Thiếu / null / rỗng → không có email; hợp lệ → trim + chữ thường; sai → lỗi. */
export function parseOptionalEmail(
  raw: unknown,
): { ok: true; email: string | null } | { ok: false; error: string } {
  if (raw === undefined || raw === null) return { ok: true, email: null };
  if (typeof raw !== 'string') return { ok: false, error: EMAIL_INVALID };
  const e = raw.trim().toLowerCase();
  if (!e) return { ok: true, email: null };
  if (e.length > MAX_EMAIL_LENGTH || !EMAIL_PATTERN.test(e))
    return { ok: false, error: EMAIL_INVALID };
  return { ok: true, email: e };
}

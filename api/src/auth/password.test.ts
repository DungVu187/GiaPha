import { describe, expect, it, vi } from 'vitest';
import { hashPassword, verifyPassword } from './password.js';

describe('password', () => {
  it('hash không chứa mật khẩu gốc và verify đúng', async () => {
    const hash = await hashPassword('MatKhau@123');
    expect(hash).not.toContain('MatKhau@123');
    expect(hash.startsWith('$argon2id$')).toBe(true);
    expect(await verifyPassword(hash, 'MatKhau@123')).toBe(true);
  });
  it('sai mật khẩu → false', async () => {
    const hash = await hashPassword('MatKhau@123');
    expect(await verifyPassword(hash, 'matkhau@123')).toBe(false);
  });
  it('hai lần hash cùng mật khẩu cho kết quả khác nhau (có salt)', async () => {
    expect(await hashPassword('abcdefgh')).not.toBe(
      await hashPassword('abcdefgh'),
    );
  });
  it('hash hỏng → false, không throw', async () => {
    expect(await verifyPassword('khong-phai-hash', 'abcdefgh')).toBe(false);
  });
  it('hash dạng argon2 nhưng hỏng → false và log password_verify_error', async () => {
    const out = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(
      await verifyPassword('$argon2id$v=19$m=1,t=1,p=1$hong', 'abcdefgh'),
    ).toBe(false);
    expect(out).toHaveBeenCalledTimes(1);
    expect(out.mock.calls[0]![0]).toContain('password_verify_error');
    out.mockRestore();
  });
  it('hash không phải argon2 → false, không log', async () => {
    const out = vi.spyOn(console, 'log').mockImplementation(() => {});
    expect(await verifyPassword('khong-phai-hash', 'abcdefgh')).toBe(false);
    expect(out).not.toHaveBeenCalled();
    out.mockRestore();
  });
  it('mật khẩu tiếng Việt có dấu', async () => {
    const hash = await hashPassword('mậtkhẩuđẹp');
    expect(await verifyPassword(hash, 'mậtkhẩuđẹp')).toBe(true);
  });
  it('chuẩn hóa NFC: đặt bằng dạng tổ hợp (NFD), đăng nhập bằng dạng dựng sẵn (NFC) → khớp', async () => {
    const nfc = 'Họ Vũ Thế 2026';
    const nfd = nfc.normalize('NFD');
    expect(nfd).not.toBe(nfc);
    expect(await verifyPassword(await hashPassword(nfd), nfc)).toBe(true);
    expect(await verifyPassword(await hashPassword(nfc), nfd)).toBe(true);
  });
  it('chuẩn hóa NFC không làm khớp chữ khác dấu', async () => {
    const hash = await hashPassword('Thế');
    expect(await verifyPassword(hash, 'Thề')).toBe(false);
    expect(await verifyPassword(hash, 'The')).toBe(false);
  });
});

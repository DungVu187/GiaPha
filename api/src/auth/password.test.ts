import { describe, expect, it } from 'vitest';
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
  it('mật khẩu tiếng Việt có dấu', async () => {
    const hash = await hashPassword('mậtkhẩuđẹp');
    expect(await verifyPassword(hash, 'mậtkhẩuđẹp')).toBe(true);
  });
});

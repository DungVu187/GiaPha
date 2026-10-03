import { describe, expect, it } from 'vitest';
import { testDb as db } from '../../test/helpers/test-db.js';
import { verifyPassword } from './password.js';
import { seedAdmin } from './seed-admin.js';

describe('seedAdmin', () => {
  it('tạo admin mới với username chuẩn hóa và mật khẩu đã hash', async () => {
    const result = await seedAdmin(db, '  Admin ', 'MatKhau@123');
    expect(result.created).toBe(true);
    const user = await db.user.findUniqueOrThrow({
      where: { username: 'admin' },
    });
    expect(user.role).toBe('ADMIN');
    expect(await verifyPassword(user.passwordHash, 'MatKhau@123')).toBe(true);
  });

  it('chạy lại không tạo trùng và không đổi mật khẩu cũ', async () => {
    await seedAdmin(db, 'admin', 'MatKhau@123');
    const again = await seedAdmin(db, 'admin', 'MatKhauKhac@456');
    expect(again.created).toBe(false);
    expect(await db.user.count()).toBe(1);
    const user = await db.user.findUniqueOrThrow({
      where: { username: 'admin' },
    });
    expect(await verifyPassword(user.passwordHash, 'MatKhau@123')).toBe(true);
  });

  it('username không hợp lệ → throw, không tạo gì', async () => {
    await expect(seedAdmin(db, 'ad', 'MatKhau@123')).rejects.toThrow(
      /USERNAME/,
    );
    expect(await db.user.count()).toBe(0);
  });

  it('mật khẩu ngắn hơn 8 ký tự → throw', async () => {
    await expect(seedAdmin(db, 'admin', '1234567')).rejects.toThrow(/PASSWORD/);
    expect(await db.user.count()).toBe(0);
  });
});

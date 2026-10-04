import { beforeEach, describe, expect, it } from 'vitest';
import { testDb as db } from '../../test/helpers/test-db.js';
import { createMember } from '../../test/helpers/factories.js';
import { authenticate } from './authenticate.js';
import { hashPassword } from './password.js';
import { seedAdmin } from './seed-admin.js';

describe('authenticate', () => {
  beforeEach(async () => {
    await seedAdmin(db, 'admin', 'MatKhau@123');
  });

  it('đúng username + mật khẩu → trả user, không kèm passwordHash', async () => {
    const user = await authenticate(db, 'admin', 'MatKhau@123');
    expect(user).toEqual({
      id: expect.any(Number),
      username: 'admin',
      role: 'ADMIN',
      memberId: null,
    });
  });

  it('username có hoa/khoảng trắng vẫn đăng nhập được', async () => {
    expect(await authenticate(db, '  ADMIN ', 'MatKhau@123')).not.toBeNull();
  });

  it('tài khoản MEMBER đã liên kết đăng nhập được, trả role + memberId', async () => {
    const member = await createMember(db);
    await db.user.create({
      data: {
        username: 'dungvu123',
        passwordHash: await hashPassword('MatKhau@123'),
        memberId: member.id,
      },
    });
    expect(await authenticate(db, 'dungvu123', 'MatKhau@123')).toMatchObject({
      role: 'MEMBER',
      memberId: member.id,
    });
  });

  it('sai mật khẩu (khác hoa/thường) → null', async () => {
    expect(await authenticate(db, 'admin', 'matkhau@123')).toBeNull();
  });

  it('user không tồn tại → null', async () => {
    expect(await authenticate(db, 'khongco', 'MatKhau@123')).toBeNull();
  });

  it('mật khẩu rỗng / username rỗng → null', async () => {
    expect(await authenticate(db, 'admin', '')).toBeNull();
    expect(await authenticate(db, '', 'MatKhau@123')).toBeNull();
  });
});

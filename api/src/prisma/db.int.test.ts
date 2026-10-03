import { describe, expect, it } from 'vitest';
import { testDb as db } from '../../test/helpers/test-db.js';
import { assertTestDatabaseUrl } from '../../test/helpers/db.js';

describe('db (Postgres test)', () => {
  it('đang kết nối DB test, không phải DB dev', async () => {
    const [row] = await db.$queryRaw<
      { name: string }[]
    >`SELECT current_database() AS name`;
    expect(row.name).toBe('giapha_test');
  });

  it('username là UNIQUE', async () => {
    await db.user.create({
      data: { username: 'dungvu123', passwordHash: 'x' },
    });
    await expect(
      db.user.create({ data: { username: 'dungvu123', passwordHash: 'y' } }),
    ).rejects.toThrow();
  });

  it('xóa user thì xóa luôn session (cascade)', async () => {
    const user = await db.user.create({
      data: { username: 'a_user', passwordHash: 'x' },
    });
    await db.session.create({
      data: { id: 'h1', userId: user.id, expiresAt: new Date() },
    });
    await db.user.delete({ where: { id: user.id } });
    expect(await db.session.count()).toBe(0);
  });

  it('resetDb làm sạch dữ liệu giữa các test', async () => {
    expect(await db.user.count()).toBe(0);
  });

  it('guard từ chối DB không phải test', () => {
    expect(() =>
      assertTestDatabaseUrl('postgresql://u:p@localhost:5432/giapha'),
    ).toThrow();
    expect(() => assertTestDatabaseUrl(undefined)).toThrow();
    expect(
      assertTestDatabaseUrl('postgresql://u:p@localhost:5432/giapha_test'),
    ).toContain('giapha_test');
  });
});

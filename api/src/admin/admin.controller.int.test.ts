import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authenticate } from '../auth/authenticate.js';
import { hashPassword } from '../auth/password.js';
import {
  createSession,
  hashToken,
  validateSessionToken,
} from '../auth/session.js';
import { changeRole } from './admin.js';
import { createTestApp } from '../../test/helpers/app.js';
import { createMember as make, loginAs } from '../../test/helpers/factories.js';
import { testDb as db } from '../../test/helpers/test-db.js';

const NEW_PASS = 'MatKhauMoi@2026';

describe('/api/admin/users', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app.close());

  const target = async (
    data: {
      memberId?: number;
      claimedAt?: Date;
      role?: 'ADMIN' | 'MEMBER';
      email?: string;
    } = {},
  ) =>
    db.user.create({
      data: {
        username: `t_${Math.random().toString(36).slice(2, 10)}`,
        passwordHash: await hashPassword('MatKhauCu@2026'),
        ...data,
      },
    });

  it('chưa đăng nhập → 401 mọi route', async () => {
    expect((await http().get('/api/admin/users')).status).toBe(401);
    expect(
      (
        await http()
          .post('/api/admin/users/1/password')
          .send({ newPassword: NEW_PASS })
      ).status,
    ).toBe(401);
    expect((await http().delete('/api/admin/users/1/member')).status).toBe(401);
    expect(
      (await http().put('/api/admin/users/1/role').send({ role: 'ADMIN' }))
        .status,
    ).toBe(401);
  });

  it.each([
    ['member đã liên kết', true],
    ['chưa liên kết', false],
  ] as const)('%s → 403 mọi route, không đổi gì', async (_label, linked) => {
    const m = linked ? await make(db) : null;
    const { cookie } = await loginAs(db, {
      role: 'MEMBER',
      memberId: m?.id ?? null,
    });
    const t = await target({ memberId: (await make(db)).id });
    expect(
      (await http().get('/api/admin/users').set('Cookie', cookie)).status,
    ).toBe(403);
    expect(
      (
        await http()
          .post(`/api/admin/users/${t.id}/password`)
          .set('Cookie', cookie)
          .send({ newPassword: NEW_PASS })
      ).status,
    ).toBe(403);
    // Không phải Admin thì id sai cũng 403, không dò được id hợp lệ.
    expect(
      (
        await http()
          .post('/api/admin/users/abc/password')
          .set('Cookie', cookie)
          .send({ newPassword: NEW_PASS })
      ).status,
    ).toBe(403);
    expect(
      (
        await http()
          .delete(`/api/admin/users/${t.id}/member`)
          .set('Cookie', cookie)
      ).status,
    ).toBe(403);
    expect(
      (
        await http()
          .put(`/api/admin/users/${t.id}/role`)
          .set('Cookie', cookie)
          .send({ role: 'ADMIN' })
      ).status,
    ).toBe(403);
    const after = await db.user.findUniqueOrThrow({ where: { id: t.id } });
    expect(after.memberId).not.toBeNull();
    expect(after.role).toBe('MEMBER');
    expect(await authenticate(db, t.username, NEW_PASS)).toBeNull();
  });

  it('GET: danh sách mới nhất trước, có member + claimedAt + email', async () => {
    const { cookie, userId } = await loginAs(db, { role: 'ADMIN' });
    const m = await make(db, { fullName: 'VŨ ĐỨC DŨNG', generation: 5 });
    const claimedAt = new Date('2026-10-18T03:00:00Z');
    const t = await target({ memberId: m.id, claimedAt, email: 'd@x.vn' });
    const res = await http().get('/api/admin/users').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toEqual({
      id: t.id,
      username: t.username,
      email: 'd@x.vn',
      role: 'MEMBER',
      createdAt: t.createdAt.toISOString(),
      claimedAt: claimedAt.toISOString(),
      member: {
        id: m.id,
        fullName: 'VŨ ĐỨC DŨNG',
        generation: 5,
        avatarPath: null,
      },
    });
    expect(res.body[1]).toMatchObject({
      id: userId,
      member: null,
      claimedAt: null,
    });
    expect(res.body[0]).not.toHaveProperty('passwordHash');
  });

  it('đặt lại mật khẩu: đăng nhập bằng mật khẩu mới; mọi phiên + link đặt lại cũ của người đó bị xóa', async () => {
    const { cookie } = await loginAs(db, { role: 'ADMIN' });
    const t = await target();
    const s = await createSession(db, t.id);
    await db.passwordResetToken.create({
      data: {
        id: hashToken('cu'),
        userId: t.id,
        expiresAt: new Date(Date.now() + 60_000),
      },
    });
    const res = await http()
      .post(`/api/admin/users/${t.id}/password`)
      .set('Cookie', cookie)
      .send({ newPassword: NEW_PASS });
    expect(res.status).toBe(204);
    expect(await authenticate(db, t.username, NEW_PASS)).not.toBeNull();
    expect(await validateSessionToken(db, s.token)).toBeNull();
    expect(await db.passwordResetToken.count({ where: { userId: t.id } })).toBe(
      0,
    );
    // Phiên của Admin vẫn còn.
    expect(
      (await http().get('/api/admin/users').set('Cookie', cookie)).status,
    ).toBe(200);
  });

  it('đặt lại mật khẩu: mật khẩu ngắn → 400; chính mình → 400; id không tồn tại → 404', async () => {
    const { cookie, userId } = await loginAs(db, { role: 'ADMIN' });
    const t = await target();
    const short = await http()
      .post(`/api/admin/users/${t.id}/password`)
      .set('Cookie', cookie)
      .send({ newPassword: '1234567' });
    expect(short.status).toBe(400);
    expect(short.body.errors).toEqual({
      newPassword: 'Mật khẩu phải có ít nhất 8 ký tự.',
    });
    expect(await authenticate(db, t.username, 'MatKhauCu@2026')).not.toBeNull();
    const self = await http()
      .post(`/api/admin/users/${userId}/password`)
      .set('Cookie', cookie)
      .send({ newPassword: NEW_PASS });
    expect(self.status).toBe(400);
    expect(self.body.message).toBe(
      'Đổi mật khẩu của chính bạn ở trang Tài khoản của tôi.',
    );
    const missing = await http()
      .post('/api/admin/users/999999/password')
      .set('Cookie', cookie)
      .send({ newPassword: NEW_PASS });
    expect(missing.status).toBe(404);
    expect(missing.body.message).toBe('Không tìm thấy tài khoản.');
    expect(
      (
        await http()
          .post('/api/admin/users/abc/password')
          .set('Cookie', cookie)
          .send({ newPassword: NEW_PASS })
      ).status,
    ).toBe(404);
  });

  it('gỡ liên kết: memberId + claimedAt về null, hồ sơ còn nguyên; gọi lại vẫn 204; id lạ → 404', async () => {
    const { cookie } = await loginAs(db, { role: 'ADMIN' });
    const m = await make(db);
    const t = await target({ memberId: m.id, claimedAt: new Date() });
    expect(
      (
        await http()
          .delete(`/api/admin/users/${t.id}/member`)
          .set('Cookie', cookie)
      ).status,
    ).toBe(204);
    const after = await db.user.findUniqueOrThrow({ where: { id: t.id } });
    expect(after).toMatchObject({ memberId: null, claimedAt: null });
    expect(await db.member.findUnique({ where: { id: m.id } })).not.toBeNull();
    expect(
      (
        await http()
          .delete(`/api/admin/users/${t.id}/member`)
          .set('Cookie', cookie)
      ).status,
    ).toBe(204);
    expect(
      (
        await http()
          .delete('/api/admin/users/999999/member')
          .set('Cookie', cookie)
      ).status,
    ).toBe(404);
  });

  it('đổi quyền: nâng / hạ; role sai → 400; id lạ → 404', async () => {
    const { cookie } = await loginAs(db, { role: 'ADMIN' });
    const t = await target();
    expect(
      (
        await http()
          .put(`/api/admin/users/${t.id}/role`)
          .set('Cookie', cookie)
          .send({ role: 'ADMIN' })
      ).status,
    ).toBe(204);
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: t.id } })).role,
    ).toBe('ADMIN');
    expect(
      (
        await http()
          .put(`/api/admin/users/${t.id}/role`)
          .set('Cookie', cookie)
          .send({ role: 'MEMBER' })
      ).status,
    ).toBe(204);
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: t.id } })).role,
    ).toBe('MEMBER');
    for (const role of ['admin', 'ROOT', 1, null]) {
      const r = await http()
        .put(`/api/admin/users/${t.id}/role`)
        .set('Cookie', cookie)
        .send({ role });
      expect(r.status).toBe(400);
      expect(r.body.errors).toEqual({ role: 'Quyền không hợp lệ.' });
    }
    expect(
      (
        await http()
          .put('/api/admin/users/999999/role')
          .set('Cookie', cookie)
          .send({ role: 'ADMIN' })
      ).status,
    ).toBe(404);
  });

  it('không hạ được Admin cuối cùng (kể cả tự hạ mình) → 409', async () => {
    const { cookie, userId } = await loginAs(db, { role: 'ADMIN' });
    const r = await http()
      .put(`/api/admin/users/${userId}/role`)
      .set('Cookie', cookie)
      .send({ role: 'MEMBER' });
    expect(r.status).toBe(409);
    expect(r.body.message).toBe(
      'Không thể hạ quyền Admin cuối cùng. Hãy cấp quyền Admin cho một tài khoản khác trước.',
    );
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: userId } })).role,
    ).toBe('ADMIN');
  });

  it('hai Admin hạ nhau cùng lúc → đúng một thành công, còn lại bị chặn; luôn còn ≥ 1 Admin', async () => {
    const a = await loginAs(db, { role: 'ADMIN' });
    const b = await loginAs(db, { role: 'ADMIN' });
    const [ra, rb] = await Promise.all([
      http()
        .put(`/api/admin/users/${b.userId}/role`)
        .set('Cookie', a.cookie)
        .send({ role: 'MEMBER' }),
      http()
        .put(`/api/admin/users/${a.userId}/role`)
        .set('Cookie', b.cookie)
        .send({ role: 'MEMBER' }),
    ]);
    // Yêu cầu thua: 409 nếu guard đọc role trước khi bên kia commit, 403 nếu sau.
    const statuses = [ra.status, rb.status].sort((x, y) => x - y);
    expect(statuses[0]).toBe(204);
    expect([403, 409]).toContain(statuses[1]);
    expect(await db.user.count({ where: { role: 'ADMIN' } })).toBe(1);
  });

  it('service: Admin vừa bị hạ (phiên cũ còn role ADMIN) không đổi quyền được → 403', async () => {
    const a = await target({ role: 'ADMIN' });
    const b = await target({ role: 'ADMIN' });
    const c = await target();
    await db.user.update({ where: { id: b.id }, data: { role: 'MEMBER' } });
    const staleB = {
      id: b.id,
      username: b.username,
      role: 'ADMIN' as const,
      memberId: null,
    };
    await expect(changeRole(db, staleB, c.id, 'ADMIN')).rejects.toMatchObject({
      status: 403,
    });
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: c.id } })).role,
    ).toBe('MEMBER');
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: a.id } })).role,
    ).toBe('ADMIN');
  });
});

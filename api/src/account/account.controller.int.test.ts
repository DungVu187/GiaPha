import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { authenticate } from '../auth/authenticate.js';
import { hashPassword } from '../auth/password.js';
import { createSession, validateSessionToken } from '../auth/session.js';
import { createTestApp } from '../../test/helpers/app.js';
import { createMember as make } from '../../test/helpers/factories.js';
import { testDb as db } from '../../test/helpers/test-db.js';

const PASS = 'MatKhauCu@2026';

async function userWithSession(
  opts: {
    role?: 'ADMIN' | 'MEMBER';
    memberId?: number | null;
    email?: string | null;
    username?: string;
    password?: string;
  } = {},
) {
  const user = await db.user.create({
    data: {
      username: opts.username ?? `u_${Math.random().toString(36).slice(2, 10)}`,
      passwordHash: await hashPassword(opts.password ?? PASS),
      role: opts.role ?? 'MEMBER',
      memberId: opts.memberId ?? null,
      email: opts.email ?? null,
    },
  });
  const { token } = await createSession(db, user.id);
  return { user, token, cookie: `giapha_session=${token}` };
}

describe('/api/account', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app.close());

  it('chưa đăng nhập → 401 cả ba route', async () => {
    expect((await http().get('/api/account')).status).toBe(401);
    expect(
      (
        await http()
          .put('/api/account/email')
          .send({ email: 'a@b.cd', currentPassword: PASS })
      ).status,
    ).toBe(401);
    expect(
      (
        await http()
          .put('/api/account/password')
          .send({ currentPassword: PASS, newPassword: 'MatKhauMoi@1' })
      ).status,
    ).toBe(401);
  });

  it('GET: đã liên kết → member; chưa liên kết → null; trả email + role', async () => {
    const m = await make(db, { fullName: 'VŨ ĐỨC DŨNG', generation: 5 });
    const linked = await userWithSession({
      memberId: m.id,
      email: 'dung@x.vn',
    });
    const res = await http().get('/api/account').set('Cookie', linked.cookie);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      username: linked.user.username,
      email: 'dung@x.vn',
      role: 'MEMBER',
      member: {
        id: m.id,
        fullName: 'VŨ ĐỨC DŨNG',
        generation: 5,
        avatarPath: null,
      },
    });
    const admin = await userWithSession({ role: 'ADMIN' });
    const a = await http().get('/api/account').set('Cookie', admin.cookie);
    expect(a.body).toMatchObject({ role: 'ADMIN', member: null, email: null });
    const unlinked = await userWithSession();
    const u = await http().get('/api/account').set('Cookie', unlinked.cookie);
    expect(u.status).toBe(200);
    expect(u.body).toMatchObject({ role: 'MEMBER', member: null });
  });

  it.each([
    ['ADMIN', true],
    ['MEMBER', true],
    ['MEMBER', false],
  ] as const)(
    'PUT email: %s (liên kết: %s) — lưu chữ thường, xóa bằng rỗng/null',
    async (role, linked) => {
      const m = linked ? await make(db) : null;
      const u = await userWithSession({ role, memberId: m?.id ?? null });
      const set = await http()
        .put('/api/account/email')
        .set('Cookie', u.cookie)
        .send({ email: ' Dung.Vu@Gmail.com ', currentPassword: PASS });
      expect(set.status).toBe(200);
      expect(set.body).toEqual({ email: 'dung.vu@gmail.com' });
      expect(
        (await db.user.findUniqueOrThrow({ where: { id: u.user.id } })).email,
      ).toBe('dung.vu@gmail.com');
      expect(
        (
          await http()
            .put('/api/account/email')
            .set('Cookie', u.cookie)
            .send({ email: '', currentPassword: PASS })
        ).body,
      ).toEqual({ email: null });
      expect(
        (
          await http()
            .put('/api/account/email')
            .set('Cookie', u.cookie)
            .send({ email: null, currentPassword: PASS })
        ).body,
      ).toEqual({ email: null });
    },
  );

  it('PUT email: sai dạng → 400; trùng người khác → 400 EMAIL_TAKEN; trùng chính mình → 200', async () => {
    await userWithSession({ email: 'da.co@x.vn' });
    const u = await userWithSession({ email: 'cua.toi@x.vn' });
    for (const email of ['abc', 123, ['a@b.cd']]) {
      const r = await http()
        .put('/api/account/email')
        .set('Cookie', u.cookie)
        .send({ email, currentPassword: PASS });
      expect(r.status).toBe(400);
      expect(r.body.errors).toEqual({ email: 'Email không hợp lệ.' });
    }
    const taken = await http()
      .put('/api/account/email')
      .set('Cookie', u.cookie)
      .send({ email: 'DA.CO@x.vn', currentPassword: PASS });
    expect(taken.status).toBe(400);
    expect(taken.body.errors).toEqual({
      email: 'Email này đã được dùng cho tài khoản khác.',
    });
    expect(
      (
        await http()
          .put('/api/account/email')
          .set('Cookie', u.cookie)
          .send({ email: 'cua.toi@x.vn', currentPassword: PASS })
      ).status,
    ).toBe(200);
  });

  it.each([
    ['ADMIN', true],
    ['MEMBER', true],
    ['MEMBER', false],
  ] as const)(
    'PUT password: %s (liên kết: %s) — đổi xong đăng nhập bằng mật khẩu mới; phiên khác bị xóa, phiên hiện tại giữ',
    async (role, linked) => {
      const m = linked ? await make(db) : null;
      const u = await userWithSession({ role, memberId: m?.id ?? null });
      const other = await createSession(db, u.user.id);
      const res = await http()
        .put('/api/account/password')
        .set('Cookie', u.cookie)
        .send({ currentPassword: PASS, newPassword: 'MatKhauMoi@2026' });
      expect(res.status).toBe(204);
      expect(
        await authenticate(db, u.user.username, 'MatKhauMoi@2026'),
      ).not.toBeNull();
      expect(await authenticate(db, u.user.username, PASS)).toBeNull();
      expect(await validateSessionToken(db, u.token)).not.toBeNull();
      expect(await validateSessionToken(db, other.token)).toBeNull();
    },
  );

  it('PUT password: sai mật khẩu hiện tại / mới quá ngắn / mới trùng cũ / thiếu trường → 400, không đổi gì', async () => {
    const u = await userWithSession();
    const put = (body: unknown) =>
      http()
        .put('/api/account/password')
        .set('Cookie', u.cookie)
        .send(body as object);
    const wrong = await put({
      currentPassword: 'sai-mat-khau',
      newPassword: 'MatKhauMoi@2026',
    });
    expect(wrong.status).toBe(400);
    expect(wrong.body.errors).toEqual({
      currentPassword: 'Mật khẩu hiện tại không đúng.',
    });
    const short = await put({ currentPassword: PASS, newPassword: '1234567' });
    expect(short.body.errors).toEqual({
      newPassword: 'Mật khẩu phải có ít nhất 8 ký tự.',
    });
    const same = await put({ currentPassword: PASS, newPassword: PASS });
    expect(same.body.errors).toEqual({
      newPassword: 'Mật khẩu mới phải khác mật khẩu hiện tại.',
    });
    const missing = await put({});
    expect(missing.status).toBe(400);
    expect(missing.body.errors).toEqual({
      currentPassword: 'Vui lòng nhập mật khẩu hiện tại.',
      newPassword: 'Vui lòng nhập mật khẩu.',
    });
    const longCurrent = await put({
      currentPassword: 'a'.repeat(257),
      newPassword: 'MatKhauMoi@2026',
    });
    expect(longCurrent.status).toBe(400);
    expect(longCurrent.body.errors).toEqual({
      currentPassword: 'Mật khẩu hiện tại không đúng.',
    });
    const longNew = await put({
      currentPassword: PASS,
      newPassword: 'a'.repeat(257),
    });
    expect(longNew.body.errors).toEqual({
      newPassword: 'Mật khẩu tối đa 256 ký tự.',
    });
    expect(await authenticate(db, u.user.username, PASS)).not.toBeNull();
  });
  it('PUT password: mật khẩu mới là mật khẩu cũ dạng NFD → 400 phải khác', async () => {
    const old = 'Mật khẩu cũ 2026';
    const u = await userWithSession({ password: old });
    const r = await http()
      .put('/api/account/password')
      .set('Cookie', u.cookie)
      .send({ currentPassword: old, newPassword: old.normalize('NFD') });
    expect(r.status).toBe(400);
    expect(r.body.errors).toEqual({
      newPassword: 'Mật khẩu mới phải khác mật khẩu hiện tại.',
    });
  });

  it('PUT email: thiếu / sai / quá dài mật khẩu hiện tại → 400, email không đổi', async () => {
    const u = await userWithSession({ email: 'cu@x.vn' });
    const put = (body: object) =>
      http().put('/api/account/email').set('Cookie', u.cookie).send(body);
    for (const currentPassword of [undefined, '', 123]) {
      const r = await put({ email: 'moi@x.vn', currentPassword });
      expect(r.status).toBe(400);
      expect(r.body.errors).toEqual({
        currentPassword: 'Vui lòng nhập mật khẩu hiện tại.',
      });
    }
    for (const currentPassword of ['sai-mat-khau', 'a'.repeat(257)]) {
      const r = await put({ email: 'moi@x.vn', currentPassword });
      expect(r.status).toBe(400);
      expect(r.body.errors).toEqual({
        currentPassword: 'Mật khẩu hiện tại không đúng.',
      });
    }
    const both = await put({ email: 'abc' });
    expect(both.body.errors).toEqual({
      email: 'Email không hợp lệ.',
      currentPassword: 'Vui lòng nhập mật khẩu hiện tại.',
    });
    const badEmailWrongPass = await put({
      email: 'abc',
      currentPassword: 'sai-mat-khau',
    });
    expect(badEmailWrongPass.body.errors).toEqual({
      email: 'Email không hợp lệ.',
    });
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: u.user.id } })).email,
    ).toBe('cu@x.vn');
  });

  it('đổi mật khẩu / đổi email → xóa mọi link đặt lại mật khẩu của user', async () => {
    const u = await userWithSession();
    const other = await userWithSession();
    const addToken = (userId: number) =>
      db.passwordResetToken.create({
        data: {
          id: Math.random().toString(36).slice(2),
          userId,
          expiresAt: new Date(Date.now() + 3600_000),
        },
      });
    await addToken(u.user.id);
    await addToken(other.user.id);
    const pw = await http()
      .put('/api/account/password')
      .set('Cookie', u.cookie)
      .send({ currentPassword: PASS, newPassword: 'MatKhauMoi@2026' });
    expect(pw.status).toBe(204);
    expect(
      await db.passwordResetToken.count({ where: { userId: u.user.id } }),
    ).toBe(0);
    await addToken(u.user.id);
    const em = await http()
      .put('/api/account/email')
      .set('Cookie', u.cookie)
      .send({ email: 'moi@x.vn', currentPassword: 'MatKhauMoi@2026' });
    expect(em.status).toBe(200);
    expect(
      await db.passwordResetToken.count({ where: { userId: u.user.id } }),
    ).toBe(0);
    expect(
      await db.passwordResetToken.count({ where: { userId: other.user.id } }),
    ).toBe(1);
  });
});

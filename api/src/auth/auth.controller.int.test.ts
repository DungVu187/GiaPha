import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp } from '../../test/helpers/app.js';
import { testDb as db } from '../../test/helpers/test-db.js';
import { hashPassword } from './password.js';
import { seedAdmin } from './seed-admin.js';
import { createSession, SESSION_TTL_MS } from './session.js';

const ADMIN = { username: 'admin', password: 'MatKhau@123' };

function setCookies(res: request.Response): string[] {
  return (res.headers['set-cookie'] as unknown as string[] | undefined) ?? [];
}

describe('auth API', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app.close());
  beforeEach(async () => {
    await seedAdmin(db, ADMIN.username, ADMIN.password);
  });

  it('đăng nhập đúng → 200, trả user, đặt cookie httpOnly/lax/path=/', async () => {
    const res = await http().post('/api/auth/login').send(ADMIN);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: expect.any(Number),
      username: 'admin',
      role: 'ADMIN',
    });
    const [cookie] = setCookies(res);
    expect(cookie).toMatch(/^giapha_session=[A-Za-z0-9_-]{43};/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\//);
    expect(cookie).toMatch(/Expires=/);
    expect(cookie).not.toMatch(/Secure/i); // NODE_ENV khác production
  });

  it('username hoa/khoảng trắng vẫn đăng nhập được', async () => {
    const res = await http()
      .post('/api/auth/login')
      .send({ username: '  ADMIN ', password: ADMIN.password });
    expect(res.status).toBe(200);
  });

  it('tài khoản MEMBER đăng nhập được', async () => {
    await db.user.create({
      data: {
        username: 'dungvu123',
        passwordHash: await hashPassword('MatKhau@123'),
      },
    });
    const res = await http()
      .post('/api/auth/login')
      .send({ username: 'dungvu123', password: 'MatKhau@123' });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('MEMBER');
  });

  it('sai mật khẩu → 401 kèm thông báo, không đặt cookie, không tạo session', async () => {
    const res = await http()
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'sai-mat-khau' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Sai tên đăng nhập hoặc mật khẩu.');
    expect(setCookies(res)).toEqual([]);
    expect(await db.session.count()).toBe(0);
  });

  it('user không tồn tại → 401 cùng thông báo', async () => {
    const res = await http()
      .post('/api/auth/login')
      .send({ username: 'khongco', password: 'MatKhau@123' });
    expect(res.status).toBe(401);
    expect(res.body.message).toBe('Sai tên đăng nhập hoặc mật khẩu.');
  });

  it.each([
    {},
    { username: 'admin' },
    { password: 'MatKhau@123' },
    { username: 1, password: 'MatKhau@123' },
    { username: '   ', password: 'MatKhau@123' },
    { username: 'admin', password: '' },
    { username: 'a'.repeat(65), password: 'MatKhau@123' },
    { username: 'admin', password: 'a'.repeat(257) },
  ])('body thiếu/sai kiểu %j → 400', async (body) => {
    const res = await http().post('/api/auth/login').send(body);
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Vui lòng nhập tên đăng nhập và mật khẩu.');
  });

  it('body dạng form (CSRF từ form HTML khác site) → 400, không đăng nhập', async () => {
    const res = await http()
      .post('/api/auth/login')
      .type('form')
      .send('username=admin&password=MatKhau@123');
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Vui lòng nhập tên đăng nhập và mật khẩu.');
    expect(setCookies(res)).toEqual([]);
    expect(await db.session.count()).toBe(0);
  });

  it('JSON hỏng → 400 thông báo tiếng Việt', async () => {
    const res = await http()
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"username":');
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Dữ liệu gửi lên không hợp lệ.');
  });

  it('body quá lớn → 413 thông báo tiếng Việt', async () => {
    const res = await http()
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'a'.repeat(200_000) });
    expect(res.status).toBe(413);
    expect(res.body.message).toBe('Dữ liệu gửi lên quá lớn.');
  });

  it('username đúng 64 ký tự và mật khẩu đúng 256 ký tự không bị 400', async () => {
    const username = 'a'.repeat(64);
    const password = 'p'.repeat(256);
    await db.user.create({
      data: { username, passwordHash: await hashPassword(password) },
    });
    const ok = await http()
      .post('/api/auth/login')
      .send({ username, password });
    expect(ok.status).toBe(200);
  });

  it('username 64 ký tự kèm khoảng trắng hai đầu không bị 400 vì độ dài', async () => {
    const res = await http()
      .post('/api/auth/login')
      .send({ username: `  ${'a'.repeat(64)}  `, password: 'MatKhau@123' });
    expect(res.status).toBe(401);
  });

  it('GET /me không có cookie → 401', async () => {
    expect((await http().get('/api/auth/me')).status).toBe(401);
  });

  it('GET /me sau khi đăng nhập → 200 user', async () => {
    const agent = request.agent(app.getHttpServer());
    await agent.post('/api/auth/login').send(ADMIN).expect(200);
    const res = await agent.get('/api/auth/me');
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ username: 'admin', role: 'ADMIN' });
  });

  it('GET /me với token giả → 401', async () => {
    const res = await http()
      .get('/api/auth/me')
      .set('Cookie', 'giapha_session=token-gia');
    expect(res.status).toBe(401);
  });

  it('GET /me với session hết hạn → 401', async () => {
    const admin = await db.user.findUniqueOrThrow({
      where: { username: 'admin' },
    });
    const { token } = await createSession(
      db,
      admin.id,
      new Date(Date.now() - SESSION_TTL_MS - 1000),
    );
    const res = await http()
      .get('/api/auth/me')
      .set('Cookie', `giapha_session=${token}`);
    expect(res.status).toBe(401);
  });

  it('logout → 204, xóa cookie, token cũ không dùng được nữa', async () => {
    const loginRes = await http().post('/api/auth/login').send(ADMIN);
    const sessionCookie = setCookies(loginRes)[0].split(';')[0];
    const res = await http()
      .post('/api/auth/logout')
      .set('Cookie', sessionCookie);
    expect(res.status).toBe(204);
    expect(setCookies(res)[0]).toMatch(
      /^giapha_session=;.*Expires=Thu, 01 Jan 1970/,
    );
    expect(await db.session.count()).toBe(0);
    expect(
      (await http().get('/api/auth/me').set('Cookie', sessionCookie)).status,
    ).toBe(401);
  });

  it('logout khi chưa đăng nhập → 204', async () => {
    expect((await http().post('/api/auth/logout')).status).toBe(204);
  });
});

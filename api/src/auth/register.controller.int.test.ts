import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createTestApp } from '../../test/helpers/app.js';
import { createMember as make } from '../../test/helpers/factories.js';
import { testDb as db } from '../../test/helpers/test-db.js';
import { seedAdmin } from './seed-admin.js';

const BODY = {
  username: 'dungvu123',
  password: 'MatKhau@123',
  fullName: 'vũ đức dũng',
  generation: 5,
};

function setCookies(res: request.Response): string[] {
  return (res.headers['set-cookie'] as unknown as string[] | undefined) ?? [];
}

describe('POST /api/auth/register', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app.close());

  async function adminCookie(): Promise<string> {
    await seedAdmin(db, 'admin', 'MatKhau@123');
    const res = await http()
      .post('/api/auth/login')
      .send({ username: 'admin', password: 'MatKhau@123' })
      .expect(200);
    return setCookies(res)[0]!.split(';')[0]!;
  }

  it('không cần đăng nhập; không ai trùng → 201, trả user, đặt cookie phiên dùng được ngay', async () => {
    const res = await http().post('/api/auth/register').send(BODY);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({
      id: expect.any(Number),
      username: 'dungvu123',
      role: 'MEMBER',
      memberId: expect.any(Number),
    });
    const [cookie] = setCookies(res);
    expect(cookie).toMatch(/^giapha_session=[A-Za-z0-9_-]{43};/);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\//);
    const me = await http()
      .get('/api/auth/me')
      .set('Cookie', cookie!.split(';')[0]!);
    expect(me.status).toBe(200);
    expect(me.body).toMatchObject(res.body);
    // Người vừa đăng ký là member đã liên kết → sửa được hồ sơ của chính mình.
    const detail = await http()
      .get(`/api/members/${res.body.memberId}`)
      .set('Cookie', cookie!.split(';')[0]!);
    expect(detail.body.permissions).toEqual({
      canEdit: true,
      canDelete: false,
    });
    expect(detail.body.fullName).toBe('VŨ ĐỨC DŨNG');
  });

  it('đăng ký xong đăng nhập lại bằng username + mật khẩu được', async () => {
    await http().post('/api/auth/register').send(BODY).expect(201);
    const res = await http()
      .post('/api/auth/login')
      .send({ username: 'DungVu123', password: 'MatKhau@123' });
    expect(res.status).toBe(200);
  });

  it('có người trùng → 200 { matches }, không đặt cookie, không tạo tài khoản', async () => {
    const father = await make(db, {
      fullName: 'VŨ ĐỨC THỊNH',
      generation: 4,
      gender: 'MALE',
    });
    const dung = await make(db, {
      fullName: 'VŨ ĐỨC DŨNG',
      generation: 5,
      fatherId: father.id,
      birthYear: 2003,
    });
    const res = await http().post('/api/auth/register').send(BODY);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      matches: [
        {
          id: dung.id,
          fullName: 'VŨ ĐỨC DŨNG',
          generation: 5,
          fatherName: 'VŨ ĐỨC THỊNH',
          motherName: null,
          birthYear: 2003,
          birthMonth: null,
          birthDay: null,
        },
      ],
    });
    expect(setCookies(res)).toEqual([]);
    expect(await db.user.count()).toBe(0);
  });

  it('"Đây là tôi" → 201, memberId là hồ sơ có sẵn', async () => {
    const dung = await make(db, { fullName: 'VŨ ĐỨC DŨNG', generation: 5 });
    const res = await http()
      .post('/api/auth/register')
      .send({ ...BODY, claim: dung.id });
    expect(res.status).toBe(201);
    expect(res.body.memberId).toBe(dung.id);
  });

  it('"Tạo thành viên mới" khi có người trùng → 201, hồ sơ mới', async () => {
    const dung = await make(db, { fullName: 'VŨ ĐỨC DŨNG', generation: 5 });
    const res = await http()
      .post('/api/auth/register')
      .send({ ...BODY, claim: 'NEW' });
    expect(res.status).toBe(201);
    expect(res.body.memberId).not.toBe(dung.id);
  });

  it('hồ sơ vừa bị người khác nhận → 409 { message, matches còn lại }', async () => {
    const a = await make(db, { fullName: 'VŨ ĐỨC DŨNG', generation: 5 });
    const b = await make(db, { fullName: 'VŨ ĐỨC DŨNG', generation: 5 });
    await db.user.create({
      data: { username: 'nguoitruoc', passwordHash: 'x', memberId: a.id },
    });
    const res = await http()
      .post('/api/auth/register')
      .send({ ...BODY, claim: a.id });
    expect(res.status).toBe(409);
    expect(res.body).toEqual({
      message:
        'Hồ sơ này vừa được người khác nhận hoặc không còn phù hợp. Vui lòng chọn lại.',
      matches: [expect.objectContaining({ id: b.id })],
    });
    expect(setCookies(res)).toEqual([]);
  });

  it('dữ liệu sai → 400 chuẩn { message, errors }', async () => {
    const res = await http()
      .post('/api/auth/register')
      .send({ username: 'ab', password: '1', fullName: ' ', generation: '5' });
    expect(res.status).toBe(400);
    expect(res.body.message).toBe('Dữ liệu không hợp lệ.');
    expect(Object.keys(res.body.errors).sort()).toEqual([
      'fullName',
      'generation',
      'password',
      'username',
    ]);
  });

  it('body mảng → 400, không 500', async () => {
    const res = await http().post('/api/auth/register').send([BODY]);
    expect(res.status).toBe(400);
  });

  it('username đã có (khác hoa thường) → 400 errors.username', async () => {
    await db.user.create({
      data: { username: 'dungvu123', passwordHash: 'x' },
    });
    const res = await http()
      .post('/api/auth/register')
      .send({ ...BODY, username: 'DungVu123' });
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      message: 'Dữ liệu không hợp lệ.',
      errors: { username: 'Tên đăng nhập đã có người dùng.' },
    });
  });

  it('body dạng form (CSRF từ site khác) → 400, không tạo tài khoản', async () => {
    const res = await http()
      .post('/api/auth/register')
      .type('form')
      .send(
        'username=dungvu123&password=MatKhau%40123&fullName=x&generation=5',
      );
    expect(res.status).toBe(400);
    expect(await db.user.count()).toBe(0);
  });

  it('đang có phiên cũ → đăng ký thành công thì hủy phiên cũ, phiên mới dùng được', async () => {
    const old = await adminCookie();
    const res = await http()
      .post('/api/auth/register')
      .set('Cookie', old)
      .send(BODY);
    expect(res.status).toBe(201);
    await http().get('/api/auth/me').set('Cookie', old).expect(401);
    const fresh = setCookies(res)[0]!.split(';')[0]!;
    await http().get('/api/auth/me').set('Cookie', fresh).expect(200);
  });

  it('đang có phiên cũ → đăng ký không tạo tài khoản (400/200/409) thì phiên cũ còn nguyên', async () => {
    const old = await adminCookie();
    await http()
      .post('/api/auth/register')
      .set('Cookie', old)
      .send({ ...BODY, password: '1' })
      .expect(400);
    const a = await make(db, { fullName: 'VŨ ĐỨC DŨNG', generation: 5 });
    await http()
      .post('/api/auth/register')
      .set('Cookie', old)
      .send(BODY)
      .expect(200);
    await db.user.create({
      data: { username: 'nguoitruoc', passwordHash: 'x', memberId: a.id },
    });
    await http()
      .post('/api/auth/register')
      .set('Cookie', old)
      .send({ ...BODY, claim: a.id })
      .expect(409);
    await http().get('/api/auth/me').set('Cookie', old).expect(200);
  });

  it('không ghi mật khẩu ra log', async () => {
    const out = vi.spyOn(console, 'log').mockImplementation(() => {});
    await http()
      .post('/api/auth/register')
      .send({ ...BODY, password: 'BiMatTuyetDoi@1' })
      .expect(201);
    const logged = out.mock.calls.flat().join('\n');
    expect(logged).toContain('register_succeeded');
    expect(logged).not.toContain('BiMatTuyetDoi@1');
    out.mockRestore();
  });
});

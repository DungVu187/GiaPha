import type { INestApplication } from '@nestjs/common';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import request from 'supertest';
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest';
import { createTestApp } from '../../test/helpers/app.js';
import { testDb as db } from '../../test/helpers/test-db.js';
import { authenticate } from './authenticate.js';
import { hashPassword } from './password.js';
import {
  checkResetToken,
  confirmPasswordReset,
  RESET_TTL_MS,
} from './password-reset.js';
import { createSession, hashToken, validateSessionToken } from './session.js';

const OLD = 'MatKhauCu@2026';
const NEW = 'MatKhauMoi@2026';
// Biến môi trường test này đổi — khôi phục từng khóa sau mỗi test (không thay cả process.env).
const ENV_KEYS = [
  'APP_URL',
  'MAIL_OUTBOX_FILE',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'SMTP_FROM',
] as const;

describe('/api/auth/password-reset', () => {
  let app: INestApplication;
  let dir: string;
  let outbox: string;
  const saved = Object.fromEntries(ENV_KEYS.map((k) => [k, process.env[k]]));
  const http = () => request(app.getHttpServer());
  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app.close());
  beforeEach(async () => {
    dir = await mkdtemp(path.join(os.tmpdir(), 'reset-'));
    outbox = path.join(dir, 'outbox.jsonl');
    for (const k of ENV_KEYS) delete process.env[k];
    process.env.APP_URL = 'http://localhost:3000/';
    process.env.MAIL_OUTBOX_FILE = outbox;
  });
  afterEach(async () => {
    for (const k of ENV_KEYS) {
      const v = saved[k];
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    await rm(dir, { recursive: true, force: true });
  });

  const user = async (data: { username: string; email?: string | null }) =>
    db.user.create({
      data: { ...data, passwordHash: await hashPassword(OLD) },
    });
  const mails = async () =>
    (await readFile(outbox, 'utf8').catch(() => ''))
      .trim()
      .split('\n')
      .filter(Boolean)
      .map(
        (l) => JSON.parse(l) as { to: string; subject: string; text: string },
      );
  const tokenFrom = (text: string) =>
    /reset-password\?token=([\w-]+)/.exec(text)![1];

  it('enabled theo biến môi trường', async () => {
    expect((await http().get('/api/auth/password-reset/enabled')).body).toEqual(
      { enabled: true },
    );
    delete process.env.MAIL_OUTBOX_FILE;
    expect((await http().get('/api/auth/password-reset/enabled')).body).toEqual(
      { enabled: false },
    );
  });

  it('tắt → POST 404 "chưa được bật"', async () => {
    delete process.env.APP_URL;
    const r = await http()
      .post('/api/auth/password-reset')
      .send({ identifier: 'ai' });
    expect(r.status).toBe(404);
    expect(r.body.message).toBe('Chức năng quên mật khẩu chưa được bật.');
  });

  it('theo tên đăng nhập hoặc email (không phân biệt hoa thường): gửi thư có link, che email; token lưu dạng băm', async () => {
    const u = await user({ username: 'dungvu123', email: 'dung.vu@gmail.com' });
    const r = await http()
      .post('/api/auth/password-reset')
      .send({ identifier: ' DungVu123 ' });
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ status: 'sent', maskedEmail: 'd•••@gmail.com' });
    const [mail] = await mails();
    expect(mail.to).toBe('dung.vu@gmail.com');
    expect(mail.subject).toBe('Đặt lại mật khẩu — Gia phả họ Vũ');
    const token = tokenFrom(mail.text);
    expect(mail.text).toBe(
      [
        'Chào dungvu123,',
        '',
        'Có yêu cầu đặt lại mật khẩu cho tài khoản dungvu123 trên Gia phả họ Vũ.',
        'Mở link sau để đặt mật khẩu mới (dùng được một lần, hết hạn sau 30 phút):',
        `http://localhost:3000/reset-password?token=${token}`,
        '',
        'Nếu bạn không yêu cầu, hãy bỏ qua thư này — mật khẩu của bạn không đổi.',
      ].join('\n'),
    );
    const row = await db.passwordResetToken.findFirstOrThrow({
      where: { userId: u.id },
    });
    expect(row.id).toBe(hashToken(token));
    expect(row.id).not.toBe(token);
    expect(row.expiresAt.getTime() - row.createdAt.getTime()).toBe(
      RESET_TTL_MS,
    );
    const byEmail = await user({ username: 'hangvu', email: 'hang@x.vn' });
    expect(
      (
        await http()
          .post('/api/auth/password-reset')
          .send({ identifier: 'HANG@x.vn' })
      ).body.status,
    ).toBe('sent');
    expect((await mails()).at(-1)!.to).toBe('hang@x.vn');
    expect(byEmail.id).toBeGreaterThan(0);
  });

  it('không thấy → 404; chưa có email → no-email + username; thiếu identifier → 400', async () => {
    await user({ username: 'khongmail', email: null });
    const nf = await http()
      .post('/api/auth/password-reset')
      .send({ identifier: 'ai.do' });
    expect(nf.status).toBe(404);
    expect(nf.body.message).toBe(
      'Không tìm thấy tài khoản với tên đăng nhập hoặc email này.',
    );
    const ne = await http()
      .post('/api/auth/password-reset')
      .send({ identifier: 'khongmail' });
    expect(ne.status).toBe(200);
    expect(ne.body).toEqual({ status: 'no-email', username: 'khongmail' });
    for (const body of [
      {},
      { identifier: 1 },
      { identifier: ['a'] },
      { identifier: '   ' },
    ]) {
      const bad = await http().post('/api/auth/password-reset').send(body);
      expect(bad.status).toBe(400);
      expect(bad.body).toEqual({
        message: 'Dữ liệu không hợp lệ.',
        errors: { identifier: 'Vui lòng nhập tên đăng nhập hoặc email.' },
      });
    }
    expect(await mails()).toEqual([]);
  });

  it('gửi lại trong 60 giây → 429, không gửi thư thứ hai', async () => {
    await user({ username: 'voi_vang', email: 'voi@x.vn' });
    expect(
      (
        await http()
          .post('/api/auth/password-reset')
          .send({ identifier: 'voi@x.vn' })
      ).status,
    ).toBe(200);
    const again = await http()
      .post('/api/auth/password-reset')
      .send({ identifier: 'voi@x.vn' });
    expect(again.status).toBe(429);
    expect(again.body.message).toBe(
      'Vừa gửi link xong. Vui lòng đợi 1 phút rồi gửi lại.',
    );
    expect(await mails()).toHaveLength(1);
  });

  it('gửi mail lỗi → 503, không để lại token', async () => {
    const u = await user({ username: 'loimail', email: 'loi@x.vn' });
    process.env.MAIL_OUTBOX_FILE = path.join(
      dir,
      'khong-co-thu-muc',
      'x.jsonl',
    );
    const r = await http()
      .post('/api/auth/password-reset')
      .send({ identifier: 'loimail' });
    expect(r.status).toBe(503);
    expect(r.body.message).toBe('Không gửi được email, vui lòng thử lại sau.');
    expect(await db.passwordResetToken.count({ where: { userId: u.id } })).toBe(
      0,
    );
  });

  it('check + confirm: đổi mật khẩu, mọi phiên và mọi link cũ bị xóa; link dùng lần 2 → 404', async () => {
    const u = await user({ username: 'datlai', email: 'dl@x.vn' });
    const s = await createSession(db, u.id);
    await http()
      .post('/api/auth/password-reset')
      .send({ identifier: 'datlai' });
    const token = tokenFrom((await mails())[0].text);
    // Một link cũ khác của cùng user (còn hạn) cũng phải bị xóa khi xác nhận.
    await db.passwordResetToken.create({
      data: {
        id: hashToken('link-cu'),
        userId: u.id,
        expiresAt: new Date(Date.now() + RESET_TTL_MS),
        createdAt: new Date(Date.now() - 120_000),
      },
    });
    expect(
      (await http().post('/api/auth/password-reset/check').send({ token }))
        .body,
    ).toEqual({ username: 'datlai' });
    const short = await http()
      .post('/api/auth/password-reset/confirm')
      .send({ token, newPassword: '1234567' });
    expect(short.status).toBe(400);
    expect(short.body.errors).toEqual({
      newPassword: 'Mật khẩu phải có ít nhất 8 ký tự.',
    });
    expect(
      (
        await http()
          .post('/api/auth/password-reset/confirm')
          .send({ token, newPassword: NEW })
      ).status,
    ).toBe(204);
    expect(await authenticate(db, 'datlai', NEW)).not.toBeNull();
    expect(await authenticate(db, 'datlai', OLD)).toBeNull();
    expect(await validateSessionToken(db, s.token)).toBeNull();
    expect(await db.passwordResetToken.count({ where: { userId: u.id } })).toBe(
      0,
    );
    const again = await http()
      .post('/api/auth/password-reset/confirm')
      .send({ token, newPassword: 'KhacNua@2026' });
    expect(again.status).toBe(404);
    expect(again.body.message).toBe(
      'Link đặt lại mật khẩu không hợp lệ hoặc đã hết hạn.',
    );
    expect(
      (await http().post('/api/auth/password-reset/check').send({ token }))
        .status,
    ).toBe(404);
  });

  it('token sai / thiếu / quá dài → 404', async () => {
    for (const token of ['sai', '', undefined, 1, 'x'.repeat(101)]) {
      expect(
        (await http().post('/api/auth/password-reset/check').send({ token }))
          .status,
      ).toBe(404);
      expect(
        (
          await http()
            .post('/api/auth/password-reset/confirm')
            .send({ token, newPassword: NEW })
        ).status,
      ).toBe(404);
    }
  });

  it('hết hạn sau 30 phút (service với now)', async () => {
    const u = await user({ username: 'hethan', email: 'hh@x.vn' });
    const t0 = new Date('2026-10-19T03:00:00Z');
    await db.passwordResetToken.create({
      data: {
        id: hashToken('tok'),
        userId: u.id,
        expiresAt: new Date(t0.getTime() + RESET_TTL_MS),
        createdAt: t0,
      },
    });
    expect(
      await checkResetToken(
        db,
        'tok',
        new Date(t0.getTime() + RESET_TTL_MS - 1),
      ),
    ).toEqual({ username: 'hethan' });
    expect(
      await checkResetToken(db, 'tok', new Date(t0.getTime() + RESET_TTL_MS)),
    ).toBeNull();
    expect(
      await confirmPasswordReset(
        db,
        'tok',
        NEW,
        new Date(t0.getTime() + RESET_TTL_MS + 1),
      ),
    ).toEqual({
      ok: false,
      error: 'invalid',
    });
    expect(await authenticate(db, 'hethan', OLD)).not.toBeNull();
  });

  it('hai lần xác nhận cùng lúc → đúng một 204', async () => {
    await user({ username: 'songsong', email: 'ss@x.vn' });
    await http()
      .post('/api/auth/password-reset')
      .send({ identifier: 'songsong' });
    const token = tokenFrom((await mails())[0].text);
    const rs = await Promise.all(
      [1, 2].map((i) =>
        http()
          .post('/api/auth/password-reset/confirm')
          .send({ token, newPassword: `MatKhau${i}@2026` }),
      ),
    );
    expect(rs.map((r) => r.status).sort((a, b) => a - b)).toEqual([204, 404]);
  });

  it('route công khai: gọi không cần cookie phiên', async () => {
    expect((await http().get('/api/auth/password-reset/enabled')).status).toBe(
      200,
    );
    expect(
      (
        await http()
          .post('/api/auth/password-reset/check')
          .send({ token: 'sai' })
      ).status,
    ).toBe(404);
    expect(
      (
        await http()
          .post('/api/auth/password-reset/confirm')
          .send({ token: 'sai', newPassword: NEW })
      ).status,
    ).toBe(404);
  });
});

import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import nodemailer from 'nodemailer';
import { describe, expect, it, vi } from 'vitest';
import { mailerFromEnv } from './mailer.js';

// Không mở kết nối SMTP thật: thay createTransport bằng bản giả ghi lại tham số.
const sendMail = vi.fn((_mail: unknown) => Promise.resolve({}));
vi.mock('nodemailer', () => ({
  default: { createTransport: vi.fn(() => ({ sendMail })) },
}));

describe('mailerFromEnv', () => {
  it('SMTP: timeout 15 giây, 465 → secure, người nhận truyền dạng { name, address }', async () => {
    const send = mailerFromEnv({
      APP_URL: 'http://x',
      SMTP_HOST: 'smtp.x',
      SMTP_FROM: 'Gia pha <a@x.vn>',
      SMTP_PORT: '465',
      SMTP_USER: 'u',
      SMTP_PASS: 'p',
    })!;
    expect(nodemailer.createTransport).toHaveBeenLastCalledWith({
      host: 'smtp.x',
      port: 465,
      secure: true,
      requireTLS: false,
      auth: { user: 'u', pass: 'p' },
      connectionTimeout: 15_000,
      greetingTimeout: 15_000,
      socketTimeout: 15_000,
    });
    await send({ to: 'x"<y>,z@b.cd', subject: 'S', text: 'T' });
    expect(sendMail).toHaveBeenLastCalledWith({
      from: 'Gia pha <a@x.vn>',
      to: { name: '', address: 'x"<y>,z@b.cd' },
      subject: 'S',
      text: 'T',
    });
    mailerFromEnv({ APP_URL: 'http://x', SMTP_HOST: 'h', SMTP_FROM: 'f' });
    expect(nodemailer.createTransport).toHaveBeenLastCalledWith(
      expect.objectContaining({
        port: 587,
        secure: false,
        requireTLS: true,
        auth: undefined,
      }),
    );
  });
  it('production: bỏ qua MAIL_OUTBOX_FILE — chỉ outbox → null; outbox + SMTP → gửi SMTP', async () => {
    expect(
      mailerFromEnv({
        NODE_ENV: 'production',
        APP_URL: 'http://x',
        MAIL_OUTBOX_FILE: 'x.jsonl',
      }),
    ).toBeNull();
    const send = mailerFromEnv({
      NODE_ENV: 'production',
      APP_URL: 'http://x',
      MAIL_OUTBOX_FILE: 'should-not-be-written.jsonl',
      SMTP_HOST: 'smtp.prod',
      SMTP_FROM: 'a@x.vn',
    })!;
    expect(nodemailer.createTransport).toHaveBeenLastCalledWith(
      expect.objectContaining({ host: 'smtp.prod' }),
    );
    sendMail.mockClear();
    await send({ to: 'a@b.cd', subject: 'S', text: 'T' });
    expect(sendMail).toHaveBeenCalledTimes(1);
  });
  it('thiếu APP_URL → null (tắt), kể cả có SMTP/outbox', () => {
    expect(
      mailerFromEnv({ SMTP_HOST: 'smtp.x', SMTP_FROM: 'a@x.vn' }),
    ).toBeNull();
    expect(mailerFromEnv({ MAIL_OUTBOX_FILE: 'x.jsonl' })).toBeNull();
  });
  it('APP_URL nhưng không có SMTP_HOST+SMTP_FROM hay outbox → null', () => {
    expect(mailerFromEnv({ APP_URL: 'http://x' })).toBeNull();
    expect(
      mailerFromEnv({ APP_URL: 'http://x', SMTP_HOST: 'smtp.x' }),
    ).toBeNull();
  });
  it('SMTP đủ → có mailer (không gửi thật trong test)', () => {
    expect(
      typeof mailerFromEnv({
        APP_URL: 'http://x',
        SMTP_HOST: 'smtp.x',
        SMTP_FROM: 'a@x.vn',
      }),
    ).toBe('function');
  });
  it('SMTP_PORT=465 (TLS ngay) → vẫn có mailer', () => {
    expect(
      typeof mailerFromEnv({
        APP_URL: 'http://x',
        SMTP_HOST: 'smtp.x',
        SMTP_FROM: 'a@x.vn',
        SMTP_PORT: '465',
      }),
    ).toBe('function');
  });
  it('SMTP_PORT không phải số nguyên dương hợp lệ → null (tắt)', () => {
    for (const SMTP_PORT of ['abc', '0', '-1', '25.5', '70000', '1e3']) {
      expect(
        mailerFromEnv({
          APP_URL: 'http://x',
          SMTP_HOST: 'smtp.x',
          SMTP_FROM: 'a@x.vn',
          SMTP_PORT,
        }),
      ).toBeNull();
    }
  });
  it('MAIL_OUTBOX_FILE → ghi mỗi thư một dòng JSON (ưu tiên hơn SMTP)', async () => {
    const file = path.join(
      await mkdtemp(path.join(os.tmpdir(), 'outbox-')),
      'mail.jsonl',
    );
    const send = mailerFromEnv({
      APP_URL: 'http://x',
      MAIL_OUTBOX_FILE: file,
      SMTP_HOST: 'smtp.x',
      SMTP_FROM: 'a@x.vn',
    })!;
    await send({ to: 'a@b.cd', subject: 'S1', text: 'T1' });
    await send({ to: 'c@d.ef', subject: 'S2', text: 'T2' });
    const lines = (await readFile(file, 'utf8'))
      .trim()
      .split('\n')
      .map((l) => JSON.parse(l));
    expect(lines).toEqual([
      { to: 'a@b.cd', subject: 'S1', text: 'T1' },
      { to: 'c@d.ef', subject: 'S2', text: 'T2' },
    ]);
  });
});

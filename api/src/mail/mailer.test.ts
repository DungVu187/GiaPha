import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { mailerFromEnv } from './mailer.js';

describe('mailerFromEnv', () => {
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

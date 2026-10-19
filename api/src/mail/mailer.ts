import { appendFile } from 'node:fs/promises';
import nodemailer from 'nodemailer';

export type Mail = { to: string; subject: string; text: string };
export type Mailer = (mail: Mail) => Promise<void>;

/**
 * Chọn cách gửi theo biến môi trường (spec D10): cần APP_URL (để tạo link). MAIL_OUTBOX_FILE (dev/e2e: ghi thư
 * ra file, mỗi dòng một JSON) ưu tiên hơn SMTP_HOST + SMTP_FROM (gửi thật). Không đủ → null = tắt quên mật khẩu.
 */
export function mailerFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): Mailer | null {
  if (!env.APP_URL) return null;
  const outbox = env.MAIL_OUTBOX_FILE;
  if (outbox)
    return async (mail) => {
      await appendFile(outbox, `${JSON.stringify(mail)}\n`, 'utf8');
    };
  if (env.SMTP_HOST && env.SMTP_FROM) {
    const port = Number(env.SMTP_PORT || 587);
    // ponytail: tạo transport mỗi lần gọi (không pool) — vài thư/ngày; chuyển sang transport dùng chung nếu gửi nhiều.
    const transport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port,
      secure: port === 465,
      auth: env.SMTP_USER
        ? { user: env.SMTP_USER, pass: env.SMTP_PASS ?? '' }
        : undefined,
    });
    const from = env.SMTP_FROM;
    return async (mail) => {
      await transport.sendMail({ from, ...mail });
    };
  }
  return null;
}

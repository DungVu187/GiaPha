import { appendFile } from 'node:fs/promises';
import nodemailer from 'nodemailer';

export type Mail = { to: string; subject: string; text: string };
export type Mailer = (mail: Mail) => Promise<void>;

const SMTP_TIMEOUT_MS = 15_000;

/** "587" → 587; rỗng/thiếu → 587; không phải số nguyên 1–65535 → null. */
function smtpPort(raw: string | undefined): number | null {
  if (!raw) return 587;
  if (!/^[1-9]\d{0,4}$/.test(raw)) return null;
  const port = Number(raw);
  return port <= 65535 ? port : null;
}

/**
 * Chọn cách gửi theo biến môi trường (spec D10): cần APP_URL (để tạo link). MAIL_OUTBOX_FILE (dev/e2e: ghi thư
 * ra file, mỗi dòng một JSON) ưu tiên hơn SMTP_HOST + SMTP_FROM (gửi thật); NODE_ENV=production bỏ qua outbox (chỉ
 * SMTP). Không đủ / SMTP_PORT sai → null = tắt quên mật khẩu.
 */
export function mailerFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): Mailer | null {
  if (!env.APP_URL) return null;
  const outbox =
    env.NODE_ENV === 'production' ? undefined : env.MAIL_OUTBOX_FILE;
  if (outbox)
    return async (mail) => {
      await appendFile(outbox, `${JSON.stringify(mail)}\n`, 'utf8');
    };
  if (env.SMTP_HOST && env.SMTP_FROM) {
    const port = smtpPort(env.SMTP_PORT);
    if (port === null) return null;
    // ponytail: tạo transport mỗi lần gọi (không pool) — vài thư/ngày; chuyển sang transport dùng chung nếu gửi nhiều.
    const transport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port,
      secure: port === 465,
      // 587/25…: bắt buộc nâng cấp STARTTLS, không gửi mật khẩu SMTP + link đặt lại mật khẩu qua kênh trơn.
      requireTLS: port !== 465,
      auth: env.SMTP_USER
        ? { user: env.SMTP_USER, pass: env.SMTP_PASS ?? '' }
        : undefined,
      connectionTimeout: SMTP_TIMEOUT_MS,
      greetingTimeout: SMTP_TIMEOUT_MS,
      socketTimeout: SMTP_TIMEOUT_MS,
    });
    const from = env.SMTP_FROM;
    return async ({ to, subject, text }) => {
      // Địa chỉ dạng object: nodemailer không phân tích lại chuỗi (email có < > , " không bị tách thành nhiều người nhận).
      await transport.sendMail({
        from,
        to: { name: '', address: to },
        subject,
        text,
      });
    };
  }
  return null;
}

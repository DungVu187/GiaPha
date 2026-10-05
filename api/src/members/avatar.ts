import { randomBytes } from 'node:crypto';
import { mkdir, unlink, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { log } from '../lib/logger.js';

export const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const PUBLIC_PREFIX = '/uploads/avatars/';
// Đúng dạng tên do saveAvatarFile sinh ra — mọi tên khác (kể cả "../") bị bỏ qua khi xóa.
const FILE_NAME = /^\d+-[0-9a-f]{16}\.(jpg|png|webp)$/;
const PNG_SIGNATURE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
]);

export function uploadsDir(): string {
  return process.env.UPLOADS_DIR || path.resolve('uploads');
}

// Theo magic bytes; không tin mimetype hay tên file người dùng gửi.
export function detectImageType(buf: Buffer): 'jpg' | 'png' | 'webp' | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff)
    return 'jpg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(PNG_SIGNATURE)) return 'png';
  if (
    buf.length >= 12 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WEBP'
  )
    return 'webp';
  return null;
}

export async function saveAvatarFile(
  buf: Buffer,
  memberId: number,
): Promise<string> {
  const ext = detectImageType(buf);
  if (!ext) throw new Error('Không phải ảnh hợp lệ');
  const name = `${memberId}-${randomBytes(8).toString('hex')}.${ext}`;
  const dir = path.join(uploadsDir(), 'avatars');
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, name), buf);
  return PUBLIC_PREFIX + name;
}

// Chỉ xóa file nằm trực tiếp trong thư mục avatars; không tồn tại → bỏ qua.
// Không bao giờ ném: gọi sau khi DB đã ghi (hoặc khi dọn dẹp trong catch), lỗi xóa file
// chỉ để lại file rác — log rồi bỏ qua, không biến thao tác đã thành công thành 500.
export async function removeAvatarFile(
  publicPath: string | null,
): Promise<void> {
  if (!publicPath?.startsWith(PUBLIC_PREFIX)) return;
  const name = publicPath.slice(PUBLIC_PREFIX.length);
  if (!FILE_NAME.test(name)) return;
  try {
    await unlink(path.join(uploadsDir(), 'avatars', name));
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'ENOENT')
      log('error', 'avatar_remove_failed', { path: publicPath, code });
  }
}

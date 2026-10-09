import { hash, verify } from '@node-rs/argon2';
import { log } from '../lib/logger.js';

export const MIN_PASSWORD_LENGTH = 8;

// Chữ có dấu có thể đến dạng dựng sẵn (NFC) hoặc tổ hợp (NFD) tùy bộ gõ/thiết bị → luôn băm dạng NFC.
const normalize = (plain: string) => plain.normalize('NFC');

export function hashPassword(plain: string): Promise<string> {
  return hash(normalize(plain));
}

export async function verifyPassword(
  passwordHash: string,
  plain: string,
): Promise<boolean> {
  // Hash hỏng/không phải argon2 → false im lặng; lỗi khác (vd. binding native) thì log.
  if (!passwordHash.startsWith('$argon2')) return false;
  try {
    return await verify(passwordHash, normalize(plain));
  } catch (error) {
    log('warn', 'password_verify_error', {
      error: error instanceof Error ? error.name : 'unknown',
    });
    return false;
  }
}

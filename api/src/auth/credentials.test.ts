import { describe, expect, it } from 'vitest';
import {
  EMAIL_INVALID,
  newPasswordError,
  parseOptionalEmail,
} from './credentials.js';

describe('newPasswordError', () => {
  it('hợp lệ → null (đúng 8 ký tự; 256 ký tự)', () => {
    expect(newPasswordError('12345678')).toBeNull();
    expect(newPasswordError('a'.repeat(256))).toBeNull();
  });
  it('thiếu / không phải chuỗi', () => {
    for (const v of [undefined, null, '', 123, ['12345678'], {}])
      expect(newPasswordError(v)).toBe('Vui lòng nhập mật khẩu.');
  });
  it('ngắn hơn 8 (đo theo NFC: 7 chữ có dấu dạng NFD vẫn là 7)', () => {
    expect(newPasswordError('1234567')).toBe(
      'Mật khẩu phải có ít nhất 8 ký tự.',
    );
    expect(newPasswordError('ếếếếếếế'.normalize('NFD'))).toBe(
      'Mật khẩu phải có ít nhất 8 ký tự.',
    );
  });
  it('dài hơn 256 (đo chuỗi thô)', () => {
    expect(newPasswordError('a'.repeat(257))).toBe(
      'Mật khẩu tối đa 256 ký tự.',
    );
  });
});

describe('parseOptionalEmail', () => {
  it('thiếu / null / rỗng / khoảng trắng → không có email', () => {
    for (const v of [undefined, null, '', '   '])
      expect(parseOptionalEmail(v)).toEqual({ ok: true, email: null });
  });
  it('trim + chữ thường', () => {
    expect(parseOptionalEmail('  Dung.Vu@Gmail.COM ')).toEqual({
      ok: true,
      email: 'dung.vu@gmail.com',
    });
  });
  it('sai dạng / không phải chuỗi / quá 254', () => {
    for (const v of [
      'abc',
      'a@b',
      'a b@c.d',
      1,
      [],
      {},
      `${'a'.repeat(250)}@b.cd`,
    ])
      expect(parseOptionalEmail(v)).toEqual({
        ok: false,
        error: EMAIL_INVALID,
      });
  });
});

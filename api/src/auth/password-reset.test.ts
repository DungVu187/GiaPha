import { describe, expect, it } from 'vitest';
import { maskEmail } from './password-reset.js';

describe('maskEmail', () => {
  it('giữ ký tự đầu + tên miền', () => {
    expect(maskEmail('dung.vu@gmail.com')).toBe('d•••@gmail.com');
    expect(maskEmail('a@x.vn')).toBe('a•••@x.vn');
  });
  it('không có @ (dữ liệu hỏng) → chỉ ký tự đầu', () => {
    expect(maskEmail('abc')).toBe('a•••');
  });
});

import { describe, expect, it } from 'vitest';
import { isValidUsername, normalizeUsername } from './username.js';

describe('normalizeUsername', () => {
  it('trim và chuyển chữ thường', () => {
    expect(normalizeUsername('  DungVu123 ')).toBe('dungvu123');
  });
  it('chuỗi chỉ có khoảng trắng → rỗng', () => {
    expect(normalizeUsername('   ')).toBe('');
  });
});

describe('isValidUsername', () => {
  it.each(['dungvu123', 'vu.dung_1', 'abc', 'a'.repeat(32)])(
    'hợp lệ: %s',
    (u) => {
      expect(isValidUsername(u)).toBe(true);
    },
  );
  it.each([
    '',
    'ab',
    'a'.repeat(33),
    'dũng',
    'vu dung',
    'DungVu',
    'vu-dung',
    'dung@vu',
  ])('không hợp lệ: %s', (u) => {
    expect(isValidUsername(u)).toBe(false);
  });
});

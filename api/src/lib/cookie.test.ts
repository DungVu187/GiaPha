import { describe, expect, it } from 'vitest';
import { readCookie } from './cookie.js';

describe('readCookie', () => {
  it('lấy đúng cookie theo tên', () => {
    expect(
      readCookie('a=1; giapha_session=abc_-1; b=2', 'giapha_session'),
    ).toBe('abc_-1');
  });
  it('cookie đứng đầu, không có khoảng trắng', () => {
    expect(readCookie('giapha_session=x;b=2', 'giapha_session')).toBe('x');
  });
  it('không có header → undefined', () => {
    expect(readCookie(undefined, 'giapha_session')).toBeUndefined();
  });
  it('không có cookie đó → undefined', () => {
    expect(readCookie('a=1; b=2', 'giapha_session')).toBeUndefined();
  });
  it('không nhầm cookie có tên chứa tên cần tìm', () => {
    expect(
      readCookie('old_giapha_session=x', 'giapha_session'),
    ).toBeUndefined();
  });
  it('giá trị rỗng → undefined', () => {
    expect(readCookie('giapha_session=', 'giapha_session')).toBeUndefined();
  });
  it('giải mã percent-encoding; mã hỏng → undefined, không throw', () => {
    expect(readCookie('n=a%20b', 'n')).toBe('a b');
    expect(readCookie('n=%E0%A4%A', 'n')).toBeUndefined();
  });
});

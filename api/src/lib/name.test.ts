import { describe, expect, it } from 'vitest';
import { normalizeFullName, toSearchName } from './name.js';

describe('normalizeFullName', () => {
  it.each([
    ['vũ đức dũng', 'VŨ ĐỨC DŨNG'],
    ['Vũ Đức Dũng', 'VŨ ĐỨC DŨNG'],
    ['   vũ   đức    dũng  ', 'VŨ ĐỨC DŨNG'],
    ['vũ\tđức\n dũng', 'VŨ ĐỨC DŨNG'],
    ['đặng thị ánh', 'ĐẶNG THỊ ÁNH'],
    ['', ''],
    ['   ', ''],
  ])('%j → %j', (input, expected) => {
    expect(normalizeFullName(input)).toBe(expected);
  });

  it('chuỗi tổ hợp NFD được đưa về NFC trước khi in hoa', () => {
    expect(normalizeFullName('vũ'.normalize('NFD'))).toBe('VŨ');
    expect(normalizeFullName('vũ'.normalize('NFD')).normalize('NFC')).toBe(
      normalizeFullName('vũ'.normalize('NFD')),
    );
  });
});

describe('toSearchName', () => {
  it.each([
    ['VŨ ĐỨC DŨNG', 'vu duc dung'],
    ['Đặng Thị Ánh', 'dang thi anh'],
    ['  NGUYỄN   THỊ HOA ', 'nguyen thi hoa'],
    ['vu duc dung', 'vu duc dung'],
    ['Phạm Thị Lụa', 'pham thi lua'],
    ['', ''],
  ])('%j → %j', (input, expected) => {
    expect(toSearchName(input)).toBe(expected);
  });
});

import { describe, expect, it } from 'vitest';
import {
  canCreateIndependentMember,
  canDeleteMember,
  canEditMember,
  directRelativeIds,
} from './permissions.js';

const ADMIN = { role: 'ADMIN' as const, memberId: null };
const LINKED = { role: 'MEMBER' as const, memberId: 10 };
const UNLINKED = { role: 'MEMBER' as const, memberId: null };
const REL = {
  selfId: 10,
  fatherId: 1,
  motherId: 2,
  spouseIds: [20, 21],
  childIds: [30, 31],
};

describe('directRelativeIds', () => {
  it('gồm bản thân, bố, mẹ, vợ/chồng, con', () => {
    expect([...directRelativeIds(REL)].sort((a, b) => a - b)).toEqual([
      1, 2, 10, 20, 21, 30, 31,
    ]);
  });
  it('bỏ bố/mẹ null', () => {
    expect([
      ...directRelativeIds({ ...REL, fatherId: null, motherId: null }),
    ]).not.toContain(null);
  });
});

describe('canEditMember', () => {
  it('admin sửa được bất kỳ ai, kể cả khi không có relatives', () => {
    expect(canEditMember(ADMIN, 999, null)).toBe(true);
  });
  it.each([10, 1, 2, 20, 21, 30, 31])(
    'member đã liên kết sửa được người thân trực tiếp %i',
    (id) => {
      expect(canEditMember(LINKED, id, REL)).toBe(true);
    },
  );
  it.each([3, 999])('member đã liên kết không sửa được người khác %i', (id) => {
    expect(canEditMember(LINKED, id, REL)).toBe(false);
  });
  it('relatives của người khác (không khớp memberId) → không tin, false', () => {
    expect(canEditMember(LINKED, 1, { ...REL, selfId: 11 })).toBe(false);
  });
  it('tài khoản chưa liên kết không sửa được ai', () => {
    expect(canEditMember(UNLINKED, 10, REL)).toBe(false);
  });
  it('member đã liên kết nhưng thiếu dữ liệu relatives → false', () => {
    expect(canEditMember(LINKED, 10, null)).toBe(false);
  });
});

describe('thêm độc lập / xóa', () => {
  it('chỉ admin', () => {
    expect(canCreateIndependentMember(ADMIN)).toBe(true);
    expect(canCreateIndependentMember(LINKED)).toBe(false);
    expect(canCreateIndependentMember(UNLINKED)).toBe(false);
    expect(canDeleteMember(ADMIN)).toBe(true);
    expect(canDeleteMember(LINKED)).toBe(false);
    expect(canDeleteMember(UNLINKED)).toBe(false);
  });
});

import { describe, expect, it } from 'vitest';
import { createMember, marry } from '../../test/helpers/factories.js';
import { testDb as db } from '../../test/helpers/test-db.js';
import {
  validateGenderChange,
  validateParents,
  validateSpouse,
} from './relationship-rules.js';

describe('validateParents', () => {
  it('bố nam, mẹ nữ → hợp lệ; null cũng hợp lệ', async () => {
    const f = await createMember(db, { gender: 'MALE' });
    const m = await createMember(db, { gender: 'FEMALE' });
    expect(await validateParents(db, null, f.id, m.id)).toEqual({});
    expect(await validateParents(db, null, null, null)).toEqual({});
  });
  it('bố không phải nam / mẹ không phải nữ (kể cả chưa rõ giới tính)', async () => {
    const female = await createMember(db, { gender: 'FEMALE' });
    const unknown = await createMember(db, { gender: null });
    expect(await validateParents(db, null, female.id, unknown.id)).toEqual({
      fatherId: 'Bố phải là nam.',
      motherId: 'Mẹ phải là nữ.',
    });
  });
  it('không tồn tại', async () => {
    expect(await validateParents(db, null, 999999, 999998)).toEqual({
      fatherId: 'Không tìm thấy người được chọn làm bố.',
      motherId: 'Không tìm thấy người được chọn làm mẹ.',
    });
  });
  it('chọn chính mình hoặc con cháu làm bố/mẹ → lỗi', async () => {
    const me = await createMember(db, { gender: 'MALE', generation: 1 });
    const son = await createMember(db, {
      gender: 'MALE',
      generation: 2,
      fatherId: me.id,
    });
    const granddaughter = await createMember(db, {
      gender: 'FEMALE',
      generation: 3,
      fatherId: son.id,
    });
    expect(await validateParents(db, me.id, me.id, null)).toEqual({
      fatherId: 'Không thể chọn chính mình làm bố.',
    });
    expect(await validateParents(db, me.id, son.id, granddaughter.id)).toEqual({
      fatherId: 'Không thể chọn con cháu của mình làm bố.',
      motherId: 'Không thể chọn con cháu của mình làm mẹ.',
    });
  });
});

describe('validateSpouse', () => {
  it('hợp lệ', async () => {
    const a = await createMember(db, { gender: 'MALE' });
    const b = await createMember(db, { gender: 'FEMALE' });
    expect(await validateSpouse(db, a.id, b.id)).toBeNull();
  });
  it('chính mình / không tồn tại / đã là vợ chồng', async () => {
    const a = await createMember(db);
    const b = await createMember(db);
    await marry(db, a.id, b.id);
    expect(await validateSpouse(db, a.id, a.id)).toBe(
      'Không thể kết hôn với chính mình.',
    );
    expect(await validateSpouse(db, a.id, 999999)).toBe(
      'Không tìm thấy người được chọn.',
    );
    expect(await validateSpouse(db, b.id, a.id)).toBe(
      'Hai người đã là vợ chồng.',
    );
  });
  it('con cháu (cả hai chiều) → lỗi', async () => {
    const g = await createMember(db, { gender: 'MALE', generation: 1 });
    const c = await createMember(db, { generation: 2, fatherId: g.id });
    expect(await validateSpouse(db, g.id, c.id)).toBe(
      'Không thể chọn con cháu của mình làm vợ/chồng.',
    );
    expect(await validateSpouse(db, c.id, g.id)).toBe(
      'Không thể chọn con cháu của mình làm vợ/chồng.',
    );
  });
});

describe('validateGenderChange', () => {
  it('đang là bố của ai đó thì không đổi sang nữ / bỏ trống', async () => {
    const f = await createMember(db, { gender: 'MALE' });
    await createMember(db, { generation: 2, fatherId: f.id });
    expect(await validateGenderChange(db, f.id, 'FEMALE')).toBe(
      'Không thể đổi giới tính: người này đang là bố trong gia phả.',
    );
    expect(await validateGenderChange(db, f.id, null)).toBe(
      'Không thể đổi giới tính: người này đang là bố trong gia phả.',
    );
    expect(await validateGenderChange(db, f.id, 'MALE')).toBeNull();
  });
  it('đang là mẹ', async () => {
    const m = await createMember(db, { gender: 'FEMALE' });
    await createMember(db, { generation: 2, motherId: m.id });
    expect(await validateGenderChange(db, m.id, 'MALE')).toBe(
      'Không thể đổi giới tính: người này đang là mẹ trong gia phả.',
    );
  });
  it('chưa là bố/mẹ ai → đổi thoải mái', async () => {
    const x = await createMember(db, { gender: 'MALE' });
    expect(await validateGenderChange(db, x.id, 'FEMALE')).toBeNull();
  });
});

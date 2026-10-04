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

  const LOOP =
    'Không thể chọn vợ/chồng của mình hoặc của con cháu làm bố/mẹ (tạo vòng lặp).';

  it('chọn vợ/chồng của mình làm bố/mẹ → lỗi vòng lặp', async () => {
    const husband = await createMember(db, { gender: 'MALE' });
    const wife = await createMember(db, { gender: 'FEMALE' });
    await marry(db, husband.id, wife.id);
    expect(await validateParents(db, wife.id, husband.id, null)).toEqual({
      fatherId: LOOP,
    });
    expect(await validateParents(db, husband.id, null, wife.id)).toEqual({
      motherId: LOOP,
    });
  });

  it('dạng dài: con của chồng làm bố của vợ / vợ của con trai làm mẹ của mình → lỗi vòng lặp', async () => {
    const x = await createMember(db, { gender: 'MALE', generation: 1 });
    const y = await createMember(db, { gender: 'FEMALE', generation: 1 });
    await marry(db, x.id, y.id);
    const s = await createMember(db, {
      gender: 'MALE',
      generation: 2,
      fatherId: x.id,
    });
    expect(await validateParents(db, y.id, s.id, null)).toEqual({
      fatherId: LOOP,
    });

    const m = await createMember(db, { gender: 'MALE', generation: 1 });
    const son = await createMember(db, {
      gender: 'MALE',
      generation: 2,
      fatherId: m.id,
    });
    const daughterInLaw = await createMember(db, { gender: 'FEMALE' });
    await marry(db, son.id, daughterInLaw.id);
    expect(await validateParents(db, m.id, null, daughterInLaw.id)).toEqual({
      motherId: LOOP,
    });
  });

  it('thông gia / bố mẹ người ngoài cho vợ → hợp lệ, không chặn nhầm', async () => {
    const x = await createMember(db, { gender: 'MALE', generation: 1 });
    const y = await createMember(db, { gender: 'FEMALE', generation: 1 });
    await marry(db, x.id, y.id);
    const outsiderFather = await createMember(db, { gender: 'MALE' });
    expect(await validateParents(db, y.id, outsiderFather.id, null)).toEqual(
      {},
    );

    // Con trai của m cưới con gái của inLaw; gắn inLaw làm bố của m không tạo vòng.
    const m = await createMember(db, { gender: 'MALE', generation: 2 });
    const son = await createMember(db, {
      gender: 'MALE',
      generation: 3,
      fatherId: m.id,
    });
    const inLaw = await createMember(db, { gender: 'MALE', generation: 1 });
    const inLawDaughter = await createMember(db, {
      gender: 'FEMALE',
      generation: 2,
      fatherId: inLaw.id,
    });
    await marry(db, son.id, inLawDaughter.id);
    expect(await validateParents(db, m.id, inLaw.id, null)).toEqual({});
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

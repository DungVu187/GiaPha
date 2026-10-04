import { describe, expect, it } from 'vitest';
import { createMember, marry } from '../../test/helpers/factories.js';
import { testDb as db } from '../../test/helpers/test-db.js';
import { derivedGeneration, propagateGenerations } from './generation.js';

const gen = async (id: number) =>
  (await db.member.findUniqueOrThrow({ where: { id } })).generation;

describe('derivedGeneration', () => {
  it('có bố → đời bố + 1, ưu tiên bố hơn mẹ', async () => {
    const f = await createMember(db, { gender: 'MALE', generation: 2 });
    const m = await createMember(db, { gender: 'FEMALE', generation: 5 });
    const c = await createMember(db, {
      generation: 1,
      fatherId: f.id,
      motherId: m.id,
    });
    expect(await derivedGeneration(db, c.id)).toBe(3);
  });
  it('chỉ có mẹ → đời mẹ + 1', async () => {
    const m = await createMember(db, { gender: 'FEMALE', generation: 4 });
    const c = await createMember(db, { generation: 1, motherId: m.id });
    expect(await derivedGeneration(db, c.id)).toBe(5);
  });
  it('vợ ngoài họ (không bố mẹ) → đời của chồng có bố trong DB', async () => {
    const gf = await createMember(db, { gender: 'MALE', generation: 1 });
    const husband = await createMember(db, {
      gender: 'MALE',
      generation: 2,
      fatherId: gf.id,
    });
    const wife = await createMember(db, { gender: 'FEMALE', generation: 7 });
    await marry(db, husband.id, wife.id);
    expect(await derivedGeneration(db, wife.id)).toBe(2);
  });
  it('cặp vợ chồng đều không có bố mẹ → nhập tay (null)', async () => {
    const a = await createMember(db, { gender: 'MALE', generation: 1 });
    const b = await createMember(db, { gender: 'FEMALE', generation: 1 });
    await marry(db, a.id, b.id);
    expect(await derivedGeneration(db, a.id)).toBeNull();
    expect(await derivedGeneration(db, b.id)).toBeNull();
  });
  it('không quan hệ → null', async () => {
    expect(await derivedGeneration(db, (await createMember(db)).id)).toBeNull();
  });
});

describe('propagateGenerations', () => {
  it('đổi đời cụ tổ → cả nhánh và vợ/chồng ngoài họ cập nhật; vợ cụ tổ (nhập tay) giữ nguyên', async () => {
    const to = await createMember(db, { gender: 'MALE', generation: 1 });
    const ba = await createMember(db, { gender: 'FEMALE', generation: 1 });
    await marry(db, to.id, ba.id);
    const con = await createMember(db, {
      gender: 'MALE',
      generation: 2,
      fatherId: to.id,
      motherId: ba.id,
    });
    const dau = await createMember(db, { gender: 'FEMALE', generation: 2 });
    await marry(db, con.id, dau.id);
    const chau = await createMember(db, {
      gender: 'MALE',
      generation: 3,
      fatherId: con.id,
      motherId: dau.id,
    });

    await db.member.update({ where: { id: to.id }, data: { generation: 3 } });
    await propagateGenerations(db, to.id);

    expect([
      await gen(to.id),
      await gen(ba.id),
      await gen(con.id),
      await gen(dau.id),
      await gen(chau.id),
    ]).toEqual([3, 1, 4, 4, 5]);
  });

  it('con gái trong họ lấy chồng ngoài họ: con của họ theo đời bố (rể) — tính đúng thứ tự', async () => {
    const ong = await createMember(db, { gender: 'MALE', generation: 1 });
    const gai = await createMember(db, {
      gender: 'FEMALE',
      generation: 2,
      fatherId: ong.id,
    });
    const re = await createMember(db, { gender: 'MALE', generation: 2 });
    await marry(db, gai.id, re.id);
    const chau = await createMember(db, {
      generation: 3,
      fatherId: re.id,
      motherId: gai.id,
    });

    await db.member.update({ where: { id: ong.id }, data: { generation: 5 } });
    await propagateGenerations(db, ong.id);

    expect([await gen(gai.id), await gen(re.id), await gen(chau.id)]).toEqual([
      6, 6, 7,
    ]);
  });

  it('gắn bố mới cho người đời 1 → người đó và con cháu dịch xuống', async () => {
    const x = await createMember(db, { gender: 'MALE', generation: 1 });
    const child = await createMember(db, { generation: 2, fatherId: x.id });
    const newFather = await createMember(db, { gender: 'MALE', generation: 4 });
    await db.member.update({
      where: { id: x.id },
      data: { fatherId: newFather.id },
    });
    await propagateGenerations(db, newFather.id);
    expect([await gen(x.id), await gen(child.id)]).toEqual([5, 6]);
  });

  it('không có gì đổi → không cập nhật (updatedAt giữ nguyên)', async () => {
    const f = await createMember(db, { gender: 'MALE', generation: 1 });
    const c = await createMember(db, { generation: 2, fatherId: f.id });
    const before = (await db.member.findUniqueOrThrow({ where: { id: c.id } }))
      .updatedAt;
    await propagateGenerations(db, f.id);
    expect(
      (await db.member.findUniqueOrThrow({ where: { id: c.id } })).updatedAt,
    ).toEqual(before);
  });

  it('dữ liệu lỗi có vòng (A là bố B, B là bố A) → dừng và báo lỗi, không lặp vô hạn', async () => {
    const a = await createMember(db, { gender: 'MALE', generation: 1 });
    const b = await createMember(db, {
      gender: 'MALE',
      generation: 5,
      fatherId: a.id,
    });
    await db.member.update({ where: { id: a.id }, data: { fatherId: b.id } });
    await expect(propagateGenerations(db, a.id)).rejects.toThrow(
      'Không tính được đời: dữ liệu quan hệ có vòng lặp.',
    );
  }, 120_000);
});

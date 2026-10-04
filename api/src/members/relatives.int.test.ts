import { describe, expect, it } from 'vitest';
import { createMember, marry } from '../../test/helpers/factories.js';
import { testDb as db } from '../../test/helpers/test-db.js';
import {
  ancestorIds,
  descendantIds,
  loadDirectRelatives,
  spouseIdsOf,
} from './relatives.js';

async function family() {
  const grandpa = await createMember(db, {
    fullName: 'VŨ VĂN TỔ',
    gender: 'MALE',
    generation: 1,
  });
  const grandma = await createMember(db, {
    fullName: 'LÊ THỊ BÀ',
    gender: 'FEMALE',
    generation: 1,
  });
  await marry(db, grandpa.id, grandma.id);
  const dad = await createMember(db, {
    fullName: 'VŨ VĂN BỐ',
    gender: 'MALE',
    generation: 2,
    fatherId: grandpa.id,
    motherId: grandma.id,
  });
  const mom = await createMember(db, {
    fullName: 'TRẦN THỊ MẸ',
    gender: 'FEMALE',
    generation: 2,
  });
  await marry(db, dad.id, mom.id);
  const me = await createMember(db, {
    fullName: 'VŨ VĂN CON',
    gender: 'MALE',
    generation: 3,
    fatherId: dad.id,
    motherId: mom.id,
  });
  const sister = await createMember(db, {
    fullName: 'VŨ THỊ EM',
    gender: 'FEMALE',
    generation: 3,
    fatherId: dad.id,
    motherId: mom.id,
  });
  const grandkid = await createMember(db, {
    fullName: 'VŨ VĂN CHÁU',
    gender: 'MALE',
    generation: 4,
    fatherId: me.id,
  });
  return { grandpa, grandma, dad, mom, me, sister, grandkid };
}

const asc = (ids: number[]) => [...ids].sort((a, b) => a - b);

describe('loadDirectRelatives', () => {
  it('bố, mẹ, vợ/chồng, con của một người', async () => {
    const f = await family();
    expect(await loadDirectRelatives(db, f.dad.id)).toEqual({
      selfId: f.dad.id,
      fatherId: f.grandpa.id,
      motherId: f.grandma.id,
      spouseIds: [f.mom.id],
      childIds: [f.me.id, f.sister.id],
    });
  });
  it('vợ/chồng tìm được ở cả hai phía của Marriage', async () => {
    const f = await family();
    expect((await loadDirectRelatives(db, f.mom.id))?.spouseIds).toEqual([
      f.dad.id,
    ]);
    expect(await spouseIdsOf(db, f.grandma.id)).toEqual([f.grandpa.id]);
  });
  it('nhiều cuộc hôn nhân → đủ vợ/chồng', async () => {
    const husband = await createMember(db, { gender: 'MALE' });
    const wife1 = await createMember(db, { gender: 'FEMALE' });
    const wife2 = await createMember(db, { gender: 'FEMALE' });
    await marry(db, husband.id, wife1.id);
    await marry(db, husband.id, wife2.id);
    expect(asc(await spouseIdsOf(db, husband.id))).toEqual(
      asc([wife1.id, wife2.id]),
    );
  });
  it('người không có quan hệ', async () => {
    const lone = await createMember(db);
    expect(await loadDirectRelatives(db, lone.id)).toEqual({
      selfId: lone.id,
      fatherId: null,
      motherId: null,
      spouseIds: [],
      childIds: [],
    });
  });
  it('không tồn tại → null', async () => {
    expect(await loadDirectRelatives(db, 999999)).toBeNull();
  });
  it('chạy được trong transaction', async () => {
    const f = await family();
    const rel = await db.$transaction((tx) => loadDirectRelatives(tx, f.me.id));
    expect(rel?.childIds).toEqual([f.grandkid.id]);
    expect(
      asc(await db.$transaction((tx) => descendantIds(tx, f.dad.id))),
    ).toEqual(asc([f.me.id, f.sister.id, f.grandkid.id]));
  });
});

describe('descendantIds', () => {
  it('mọi con cháu, không gồm chính mình, không gồm vợ/chồng', async () => {
    const f = await family();
    expect(asc(await descendantIds(db, f.grandpa.id))).toEqual(
      asc([f.dad.id, f.me.id, f.sister.id, f.grandkid.id]),
    );
    expect(asc(await descendantIds(db, f.mom.id))).toEqual(
      asc([f.me.id, f.sister.id, f.grandkid.id]),
    );
  });
  it('người không có con → []', async () => {
    const f = await family();
    expect(await descendantIds(db, f.grandkid.id)).toEqual([]);
  });
  it('dữ liệu lỗi có vòng → không lặp vô hạn, không gồm chính mình', async () => {
    const a = await createMember(db, { gender: 'MALE' });
    const b = await createMember(db, { gender: 'MALE', fatherId: a.id });
    await db.member.update({ where: { id: a.id }, data: { fatherId: b.id } });
    expect(await descendantIds(db, a.id)).toEqual([b.id]);
  });
});

describe('ancestorIds', () => {
  it('mọi tổ tiên theo cả bố và mẹ, không gồm chính mình, không gồm vợ/chồng', async () => {
    const f = await family();
    expect(asc(await ancestorIds(db, f.grandkid.id))).toEqual(
      asc([f.me.id, f.dad.id, f.mom.id, f.grandpa.id, f.grandma.id]),
    );
    expect(asc(await ancestorIds(db, f.sister.id))).toEqual(
      asc([f.dad.id, f.mom.id, f.grandpa.id, f.grandma.id]),
    );
  });
  it('người không có bố mẹ → []', async () => {
    const f = await family();
    expect(await ancestorIds(db, f.grandpa.id)).toEqual([]);
  });
  it('dữ liệu lỗi có vòng → không lặp vô hạn, không gồm chính mình', async () => {
    const a = await createMember(db, { gender: 'MALE' });
    const b = await createMember(db, { gender: 'MALE', fatherId: a.id });
    await db.member.update({ where: { id: a.id }, data: { fatherId: b.id } });
    expect(await ancestorIds(db, a.id)).toEqual([b.id]);
  });
});

import { describe, expect, it } from 'vitest';
import type { Member } from '../generated/prisma/client.js';
import { createMember as make, marry } from '../../test/helpers/factories.js';
import { testDb as db } from '../../test/helpers/test-db.js';
import type { MemberInput } from './member-input.js';
import {
  addRelative,
  createMember,
  deleteMember,
  getMemberDetail,
  removeSpouse,
  searchMembers,
  ServiceError,
  updateMember,
} from './member-service.js';

const TODAY = { year: 2026, month: 10, day: 3 };
const ADMIN = { role: 'ADMIN' as const, memberId: null };
const UNLINKED = { role: 'MEMBER' as const, memberId: null };
const linked = (memberId: number) => ({ role: 'MEMBER' as const, memberId });

const input = (over: Partial<MemberInput> = {}): MemberInput => ({
  fullName: 'VŨ VĂN MỚI',
  gender: 'MALE',
  generation: null,
  birthOrder: null,
  birth: { year: null, month: null, day: null },
  isDeceased: false,
  death: { year: null, month: null, day: null },
  deathCalendar: null,
  deathLunarLeap: false,
  anniversary: null,
  burialPlace: null,
  note: null,
  fatherId: null,
  motherId: null,
  ...over,
});

// Input giữ nguyên bố/mẹ/đời/giới tính đang lưu — như form sửa gửi lên khi chỉ đổi tên.
const keep = (m: Member, over: Partial<MemberInput> = {}) =>
  input({
    gender: m.gender,
    generation: m.generation,
    fatherId: m.fatherId,
    motherId: m.motherId,
    ...over,
  });

const get = (id: number) => db.member.findUniqueOrThrow({ where: { id } });
const gen = async (id: number) => (await get(id)).generation;

async function expectError(
  p: Promise<unknown>,
  status: number,
  errors?: Record<string, string>,
) {
  const err = await p.then(
    () => null,
    (e: unknown) => e,
  );
  expect(err).toBeInstanceOf(ServiceError);
  expect((err as ServiceError).status).toBe(status);
  if (errors) expect((err as ServiceError).errors).toEqual(errors);
}

// ông → bố (+ mẹ) → anh, tôi (+ vợ) → con; thêm một người lạ.
async function family() {
  const grandpa = await make(db, {
    fullName: 'VŨ VĂN ÔNG',
    gender: 'MALE',
    generation: 1,
  });
  const father = await make(db, {
    fullName: 'VŨ VĂN BỐ',
    gender: 'MALE',
    generation: 2,
    fatherId: grandpa.id,
  });
  const mother = await make(db, {
    fullName: 'NGUYỄN THỊ MẸ',
    gender: 'FEMALE',
    generation: 2,
  });
  await marry(db, father.id, mother.id);
  const brother = await make(db, {
    fullName: 'VŨ VĂN ANH',
    gender: 'MALE',
    generation: 3,
    fatherId: father.id,
    motherId: mother.id,
  });
  const me = await make(db, {
    fullName: 'VŨ VĂN TÔI',
    gender: 'MALE',
    generation: 3,
    fatherId: father.id,
    motherId: mother.id,
  });
  const wife = await make(db, {
    fullName: 'LÊ THỊ VỢ',
    gender: 'FEMALE',
    generation: 3,
  });
  await marry(db, me.id, wife.id);
  const child = await make(db, {
    fullName: 'VŨ VĂN CON',
    gender: 'MALE',
    generation: 4,
    fatherId: me.id,
    motherId: wife.id,
  });
  const stranger = await make(db, {
    fullName: 'TRẦN VĂN LẠ',
    gender: 'MALE',
    generation: 1,
  });
  return { grandpa, father, mother, brother, me, wife, child, stranger };
}

describe('createMember', () => {
  it('admin tạo người gốc với đời nhập tay', async () => {
    const { id } = await createMember(db, ADMIN, input({ generation: 1 }));
    expect(await get(id)).toMatchObject({
      fullName: 'VŨ VĂN MỚI',
      searchName: 'vu van moi',
      generation: 1,
    });
  });
  it('có bố → đời tự tính, bỏ qua đời nhập tay', async () => {
    const f = await make(db, { gender: 'MALE', generation: 3 });
    const { id } = await createMember(
      db,
      ADMIN,
      input({ fatherId: f.id, generation: 9 }),
    );
    expect(await gen(id)).toBe(4);
  });
  it('không bố mẹ và không nhập đời → 400', async () => {
    await expectError(createMember(db, ADMIN, input()), 400, {
      generation: 'Vui lòng nhập đời.',
    });
  });
  it('bố là nữ → 400', async () => {
    const f = await make(db, { gender: 'FEMALE' });
    await expectError(createMember(db, ADMIN, input({ fatherId: f.id })), 400, {
      fatherId: 'Bố phải là nam.',
    });
  });
  it('member đã liên kết / chưa liên kết → 403, không tạo gì', async () => {
    const me = await make(db);
    await expectError(
      createMember(db, linked(me.id), input({ generation: 1 })),
      403,
    );
    await expectError(
      createMember(db, UNLINKED, input({ generation: 1 })),
      403,
    );
    expect(await db.member.count()).toBe(1);
  });
});

describe('updateMember', () => {
  it('admin sửa người bất kỳ: tên chuẩn hóa, searchName cập nhật', async () => {
    const { stranger } = await family();
    await updateMember(
      db,
      ADMIN,
      stranger.id,
      keep(stranger, { fullName: '  đặng   thị ánh ', gender: 'FEMALE' }),
    );
    expect(await get(stranger.id)).toMatchObject({
      fullName: 'ĐẶNG THỊ ÁNH',
      searchName: 'dang thi anh',
      gender: 'FEMALE',
    });
  });
  it.each(['me', 'father', 'mother', 'wife', 'child'] as const)(
    'member liên kết sửa người thân trực tiếp (%s) → OK',
    async (who) => {
      const f = await family();
      const target = f[who];
      await updateMember(
        db,
        linked(f.me.id),
        target.id,
        keep(target, { fullName: 'TÊN MỚI', note: 'đã sửa' }),
      );
      expect(await get(target.id)).toMatchObject({
        fullName: 'TÊN MỚI',
        note: 'đã sửa',
      });
    },
  );
  it.each(['brother', 'grandpa', 'stranger'] as const)(
    'member liên kết sửa người không phải người thân trực tiếp (%s) → 403',
    async (who) => {
      const f = await family();
      const target = f[who];
      await expectError(
        updateMember(
          db,
          linked(f.me.id),
          target.id,
          keep(target, { fullName: 'TÊN MỚI' }),
        ),
        403,
      );
      expect((await get(target.id)).fullName).toBe(target.fullName);
    },
  );
  it('chưa liên kết → 403', async () => {
    const { me } = await family();
    await expectError(updateMember(db, UNLINKED, me.id, keep(me)), 403);
  });
  it('không tồn tại → 404 với admin và cả với member (kiểm tồn tại trước quyền)', async () => {
    const { me } = await family();
    await expectError(
      updateMember(db, ADMIN, 9999, input({ generation: 1 })),
      404,
    );
    await expectError(
      updateMember(db, linked(me.id), 9999, input({ generation: 1 })),
      404,
    );
    await expectError(
      updateMember(db, UNLINKED, 9999, input({ generation: 1 })),
      404,
    );
  });
  it('đổi bố → đời người đó và con cháu cập nhật', async () => {
    const { me, child } = await family();
    const newFather = await make(db, { gender: 'MALE', generation: 5 });
    await updateMember(db, ADMIN, me.id, keep(me, { fatherId: newFather.id }));
    expect(await gen(me.id)).toBe(6);
    expect(await gen(child.id)).toBe(7);
  });
  it('người có bố gửi đời khác → đời vẫn theo bố', async () => {
    const { me } = await family();
    await updateMember(db, ADMIN, me.id, keep(me, { generation: 9 }));
    expect(await gen(me.id)).toBe(3);
  });
  it('người nhập tay đổi đời 1 → 2 → con cháu +1', async () => {
    const { grandpa, father, me, wife, child } = await family();
    await updateMember(db, ADMIN, grandpa.id, keep(grandpa, { generation: 2 }));
    expect(await gen(grandpa.id)).toBe(2);
    expect(await gen(father.id)).toBe(3);
    expect(await gen(me.id)).toBe(4);
    expect(await gen(wife.id)).toBe(4);
    expect(await gen(child.id)).toBe(5);
  });
  it('không bố mẹ và không gửi đời → 400', async () => {
    const { stranger } = await family();
    await expectError(
      updateMember(
        db,
        ADMIN,
        stranger.id,
        keep(stranger, { generation: null }),
      ),
      400,
      { generation: 'Vui lòng nhập đời.' },
    );
  });
  it('chọn con làm bố → 400 fatherId', async () => {
    const { me, child } = await family();
    await expectError(
      updateMember(db, ADMIN, me.id, keep(me, { fatherId: child.id })),
      400,
      { fatherId: 'Không thể chọn con cháu của mình làm bố.' },
    );
  });
  it('đổi giới tính người đang là bố → 400 errors.gender', async () => {
    const { me } = await family();
    await expectError(
      updateMember(db, ADMIN, me.id, keep(me, { gender: 'FEMALE' })),
      400,
      {
        gender: 'Không thể đổi giới tính: người này đang là bố trong gia phả.',
      },
    );
    expect((await get(me.id)).gender).toBe('MALE');
  });
  it('chuyển đã khuất → còn sống: cột ngày mất/giỗ/nơi an táng thành null', async () => {
    const dead = await make(db, {
      generation: 1,
      isDeceased: true,
      deathYear: 2000,
      deathMonth: 8,
      deathDay: 23,
      deathCalendar: 'LUNAR',
      deathLunarLeap: false,
      anniversaryDay: 23,
      anniversaryMonth: 8,
      anniversaryCalendar: 'LUNAR',
      burialPlace: 'Nghĩa trang làng',
    });
    await updateMember(db, ADMIN, dead.id, keep(dead));
    expect(await get(dead.id)).toMatchObject({
      isDeceased: false,
      deathYear: null,
      deathMonth: null,
      deathDay: null,
      deathCalendar: null,
      deathLunarLeap: false,
      anniversaryDay: null,
      anniversaryMonth: null,
      anniversaryCalendar: null,
      burialPlace: null,
    });
  });
  it('đời lan vượt giới hạn → 409 và rollback', async () => {
    const f = await make(db, { gender: 'MALE', generation: 199 });
    const c = await make(db, { generation: 200, fatherId: f.id });
    await expectError(
      updateMember(db, ADMIN, f.id, keep(f, { generation: 200, note: 'x' })),
      409,
    );
    expect(await get(f.id)).toMatchObject({ generation: 199, note: null });
    expect(await gen(c.id)).toBe(200);
  });

  describe('chặn leo quyền: member không đổi bố/mẹ đang lưu', () => {
    it('member đổi bố của chính mình sang người khác → 403, không đổi gì', async () => {
      const { me, stranger } = await family();
      await expectError(
        updateMember(
          db,
          linked(me.id),
          me.id,
          keep(me, { fatherId: stranger.id, fullName: 'TÊN MỚI' }),
        ),
        403,
      );
      expect(await get(me.id)).toMatchObject({
        fatherId: me.fatherId,
        fullName: me.fullName,
      });
    });
    it('member đặt mẹ cho vợ mình (đang trống) → 403', async () => {
      const { me, wife } = await family();
      const x = await make(db, { gender: 'FEMALE', generation: 1 });
      await expectError(
        updateMember(
          db,
          linked(me.id),
          wife.id,
          keep(wife, { motherId: x.id }),
        ),
        403,
      );
      expect((await get(wife.id)).motherId).toBeNull();
    });
    it('member gỡ bố của con mình (về null) → 403', async () => {
      const { me, child } = await family();
      await expectError(
        updateMember(
          db,
          linked(me.id),
          child.id,
          keep(child, { fatherId: null }),
        ),
        403,
      );
      expect((await get(child.id)).fatherId).toBe(me.id);
    });
    it('admin làm cùng thao tác (đổi bố, đặt mẹ, gỡ bố) → OK', async () => {
      const { me, wife, child, stranger } = await family();
      const x = await make(db, { gender: 'FEMALE', generation: 1 });
      await updateMember(db, ADMIN, me.id, keep(me, { fatherId: stranger.id }));
      await updateMember(db, ADMIN, wife.id, keep(wife, { motherId: x.id }));
      await updateMember(
        db,
        ADMIN,
        child.id,
        keep(child, { fatherId: null, motherId: null, generation: 7 }),
      );
      expect((await get(me.id)).fatherId).toBe(stranger.id);
      expect((await get(wife.id)).motherId).toBe(x.id);
      expect(await get(child.id)).toMatchObject({
        fatherId: null,
        motherId: null,
        generation: 7,
      });
    });
  });
});

describe('deleteMember', () => {
  it('admin xóa người không có con → hết bản ghi, Marriage xóa, tài khoản gỡ liên kết, trả avatarPath', async () => {
    const husband = await make(db, { gender: 'MALE', generation: 1 });
    const wife = await make(db, {
      gender: 'FEMALE',
      generation: 1,
      avatarPath: '/uploads/avatars/abc.jpg',
    });
    await marry(db, husband.id, wife.id);
    const user = await db.user.create({
      data: { username: 'vo', passwordHash: 'x', memberId: wife.id },
    });
    expect(await deleteMember(db, ADMIN, wife.id)).toEqual({
      avatarPath: '/uploads/avatars/abc.jpg',
    });
    expect(await db.member.findUnique({ where: { id: wife.id } })).toBeNull();
    expect(await db.marriage.count()).toBe(0);
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: user.id } })).memberId,
    ).toBeNull();
    expect(
      await db.member.findUnique({ where: { id: husband.id } }),
    ).not.toBeNull();
  });
  it('còn con → 409, không xóa', async () => {
    const { me } = await family();
    await expectError(deleteMember(db, ADMIN, me.id), 409);
    expect(await db.member.findUnique({ where: { id: me.id } })).not.toBeNull();
  });
  it('member liên kết (kể cả xóa chính mình) → 403', async () => {
    const { me, child, stranger } = await family();
    await expectError(deleteMember(db, linked(child.id), child.id), 403);
    await expectError(deleteMember(db, linked(me.id), child.id), 403);
    await expectError(deleteMember(db, linked(me.id), stranger.id), 403);
    expect(await db.member.count()).toBe(8);
  });
  it('chưa liên kết → 403', async () => {
    const { stranger } = await family();
    await expectError(deleteMember(db, UNLINKED, stranger.id), 403);
  });
  it('không tồn tại → 404', async () => {
    await expectError(deleteMember(db, ADMIN, 9999), 404);
  });
});

describe('addRelative', () => {
  it('admin thêm CON mới cho ông (nam, đời 1) → fatherId = ông, đời 2', async () => {
    const ong = await make(db, { gender: 'MALE', generation: 1 });
    const { id } = await addRelative(db, ADMIN, ong.id, 'CHILD', {
      member: input(),
    });
    expect(await get(id)).toMatchObject({ fatherId: ong.id, generation: 2 });
  });
  it('admin thêm CON có sẵn (chưa có bố) → gắn bố, đời con + cháu cập nhật', async () => {
    const ong = await make(db, { gender: 'MALE', generation: 3 });
    const con = await make(db, { gender: 'MALE', generation: 1 });
    const chau = await make(db, { generation: 2, fatherId: con.id });
    const { id } = await addRelative(db, ADMIN, ong.id, 'CHILD', {
      existingId: con.id,
    });
    expect(id).toBe(con.id);
    expect(await get(con.id)).toMatchObject({
      fatherId: ong.id,
      generation: 4,
    });
    expect(await gen(chau.id)).toBe(5);
  });
  it('thêm CON cho bà (nữ) → motherId', async () => {
    const ba = await make(db, { gender: 'FEMALE', generation: 1 });
    const { id } = await addRelative(db, ADMIN, ba.id, 'CHILD', {
      member: input(),
    });
    expect(await get(id)).toMatchObject({
      motherId: ba.id,
      fatherId: null,
      generation: 2,
    });
  });
  it('thêm CON khi người đó chưa rõ giới tính → 400 errors.gender', async () => {
    const x = await make(db, { gender: null, generation: 1 });
    await expectError(
      addRelative(db, ADMIN, x.id, 'CHILD', { member: input() }),
      400,
      { gender: 'Cần biết giới tính của người này trước khi thêm con.' },
    );
    expect(await db.member.count()).toBe(1);
  });
  it('CON có sẵn đã có bố khác → 409', async () => {
    const { me, brother } = await family();
    await expectError(
      addRelative(db, ADMIN, brother.id, 'CHILD', { existingId: me.id }),
      409,
    );
    expect((await get(me.id)).fatherId).toBe(me.fatherId);
  });
  it('chọn chính tổ tiên của mình làm con → 400 (vòng)', async () => {
    const { me, grandpa } = await family();
    await expectError(
      addRelative(db, ADMIN, me.id, 'CHILD', { existingId: grandpa.id }),
      400,
      { fatherId: 'Không thể chọn con cháu của mình làm bố.' },
    );
  });
  it('thêm BỐ mới cho người đời 1 → bố đời 1, người đó đời 2, con cháu +1', async () => {
    const goc = await make(db, { gender: 'MALE', generation: 1 });
    const con = await make(db, { generation: 2, fatherId: goc.id });
    const { id } = await addRelative(db, ADMIN, goc.id, 'FATHER', {
      member: input({ gender: 'FEMALE' }),
    });
    expect(await get(id)).toMatchObject({ gender: 'MALE', generation: 1 });
    expect(await get(goc.id)).toMatchObject({ fatherId: id, generation: 2 });
    expect(await gen(con.id)).toBe(3);
  });
  it('thêm MẸ mới → giới tính ép nữ, gắn motherId', async () => {
    const x = await make(db, { gender: 'MALE', generation: 3 });
    const { id } = await addRelative(db, ADMIN, x.id, 'MOTHER', {
      member: input({ gender: null }),
    });
    expect(await get(id)).toMatchObject({ gender: 'FEMALE', generation: 2 });
    expect(await get(x.id)).toMatchObject({ motherId: id, generation: 3 });
  });
  it('thêm BỐ khi đã có bố → 409', async () => {
    const { me } = await family();
    await expectError(
      addRelative(db, ADMIN, me.id, 'FATHER', { member: input() }),
      409,
    );
    expect(await db.member.count()).toBe(8);
  });
  it('thêm MẸ có sẵn là nam → 400', async () => {
    const x = await make(db, { generation: 2 });
    const male = await make(db, { gender: 'MALE', generation: 1 });
    await expectError(
      addRelative(db, ADMIN, x.id, 'MOTHER', { existingId: male.id }),
      400,
      { motherId: 'Mẹ phải là nữ.' },
    );
  });
  it('thêm VỢ mới cho người trong họ → Marriage (person1Id < person2Id), vợ có đời bằng chồng', async () => {
    const { me } = await family();
    const { id } = await addRelative(db, ADMIN, me.id, 'SPOUSE', {
      member: input({ gender: 'FEMALE', generation: 9 }),
    });
    const m = await db.marriage.findFirstOrThrow({
      where: { OR: [{ person1Id: id }, { person2Id: id }] },
    });
    expect(m).toMatchObject({ person1Id: me.id, person2Id: id });
    expect(await gen(id)).toBe(3);
  });
  it('thêm VỢ có sẵn đã là vợ → 400 errors.spouseId', async () => {
    const { me, wife } = await family();
    await expectError(
      addRelative(db, ADMIN, me.id, 'SPOUSE', { existingId: wife.id }),
      400,
      { spouseId: 'Hai người đã là vợ chồng.' },
    );
  });
  it('người có nhiều vợ (thêm lần 2 người khác) → 2 Marriage', async () => {
    const { me } = await family();
    await addRelative(db, ADMIN, me.id, 'SPOUSE', {
      member: input({ gender: 'FEMALE' }),
    });
    expect(
      await db.marriage.count({
        where: { OR: [{ person1Id: me.id }, { person2Id: me.id }] },
      }),
    ).toBe(2);
  });
  it('thêm CON cho người đời 200 → 409 (vượt giới hạn đời), không tạo gì', async () => {
    const x = await make(db, { gender: 'MALE', generation: 200 });
    await expectError(
      addRelative(db, ADMIN, x.id, 'CHILD', { member: input() }),
      409,
    );
    expect(await db.member.count()).toBe(1);
  });

  describe('quyền', () => {
    it('member liên kết thêm con mới cho chính mình → OK', async () => {
      const { me } = await family();
      const { id } = await addRelative(db, linked(me.id), me.id, 'CHILD', {
        member: input(),
      });
      expect(await get(id)).toMatchObject({ fatherId: me.id, generation: 4 });
    });
    it('member liên kết thêm con mới cho bố mình (thêm em) → OK', async () => {
      const { me, father } = await family();
      const { id } = await addRelative(db, linked(me.id), father.id, 'CHILD', {
        member: input(),
      });
      expect(await get(id)).toMatchObject({
        fatherId: father.id,
        generation: 3,
      });
    });
    it('member liên kết thêm con cho anh ruột → 403', async () => {
      const { me, brother } = await family();
      await expectError(
        addRelative(db, linked(me.id), brother.id, 'CHILD', {
          member: input(),
        }),
        403,
      );
      expect(await db.member.count()).toBe(8);
    });
    it('chưa liên kết → 403', async () => {
      const { me } = await family();
      await expectError(
        addRelative(db, UNLINKED, me.id, 'CHILD', { member: input() }),
        403,
      );
    });
    it('người đích không tồn tại → 404 (admin và member)', async () => {
      const { me } = await family();
      await expectError(
        addRelative(db, ADMIN, 9999, 'CHILD', { member: input() }),
        404,
      );
      await expectError(
        addRelative(db, linked(me.id), 9999, 'CHILD', { member: input() }),
        404,
      );
    });
  });

  describe('chặn leo quyền: member không gắn người có sẵn / bố mẹ tùy ý cho người mới', () => {
    // [người được thêm vào, người có sẵn] — người được thêm vào luôn là người thân của "tôi".
    const existingCases = {
      FATHER: async (f: Awaited<ReturnType<typeof family>>) => [
        f.wife.id,
        f.stranger.id,
      ],
      MOTHER: async (f: Awaited<ReturnType<typeof family>>) => [
        f.wife.id,
        (await make(db, { gender: 'FEMALE', generation: 1 })).id,
      ],
      CHILD: async (f: Awaited<ReturnType<typeof family>>) => [
        f.me.id,
        f.stranger.id,
      ],
      SPOUSE: async (f: Awaited<ReturnType<typeof family>>) => [
        f.me.id,
        (await make(db, { gender: 'FEMALE', generation: 1 })).id,
      ],
    } as const;
    const kinds = ['FATHER', 'MOTHER', 'CHILD', 'SPOUSE'] as const;

    it.each(kinds)('member liên kết gắn %s có sẵn → 403', async (kind) => {
      const f = await family();
      const [id, existingId] = await existingCases[kind](f);
      const before = await db.member.findMany({ orderBy: { id: 'asc' } });
      const marriages = await db.marriage.count();
      await expectError(
        addRelative(db, linked(f.me.id), id, kind, { existingId }),
        403,
      );
      expect(await db.member.findMany({ orderBy: { id: 'asc' } })).toEqual(
        before,
      );
      expect(await db.marriage.count()).toBe(marriages);
    });
    it.each(kinds)('admin gắn %s có sẵn → OK', async (kind) => {
      const f = await family();
      const [id, existingId] = await existingCases[kind](f);
      expect(await addRelative(db, ADMIN, id, kind, { existingId })).toEqual({
        id: existingId,
      });
    });

    // Người mới tạo qua FATHER/MOTHER/SPOUSE không được mang bố/mẹ.
    const withParent = {
      FATHER: (f: Awaited<ReturnType<typeof family>>) =>
        [f.wife.id, input({ fatherId: f.stranger.id })] as const,
      MOTHER: (f: Awaited<ReturnType<typeof family>>) =>
        [
          f.wife.id,
          input({ gender: 'FEMALE', fatherId: f.stranger.id }),
        ] as const,
      SPOUSE: (f: Awaited<ReturnType<typeof family>>) =>
        [f.me.id, input({ gender: 'FEMALE', motherId: f.mother.id })] as const,
    };
    const newKinds = ['FATHER', 'MOTHER', 'SPOUSE'] as const;
    it.each(newKinds)(
      'member liên kết tạo %s mới có bố/mẹ → 403, không tạo gì',
      async (kind) => {
        const f = await family();
        const [id, member] = withParent[kind](f);
        await expectError(
          addRelative(db, linked(f.me.id), id, kind, { member }),
          403,
        );
        expect(await db.member.count()).toBe(8);
      },
    );
    it.each(newKinds)('admin tạo %s mới có bố/mẹ → OK', async (kind) => {
      const f = await family();
      const [id, member] = withParent[kind](f);
      const created = await addRelative(db, ADMIN, id, kind, { member });
      expect(await get(created.id)).toMatchObject({
        fatherId: member.fatherId,
        motherId: member.motherId,
      });
    });

    it('member liên kết thêm CON mới, mẹ là người không phải vợ mình → 403', async () => {
      const { me } = await family();
      const x = await make(db, { gender: 'FEMALE', generation: 3 });
      await expectError(
        addRelative(db, linked(me.id), me.id, 'CHILD', {
          member: input({ motherId: x.id }),
        }),
        403,
      );
      expect(await db.member.count()).toBe(9);
    });
    it('admin thêm CON mới, mẹ là người không phải vợ → OK', async () => {
      const { me } = await family();
      const x = await make(db, { gender: 'FEMALE', generation: 3 });
      const { id } = await addRelative(db, ADMIN, me.id, 'CHILD', {
        member: input({ motherId: x.id }),
      });
      expect(await get(id)).toMatchObject({ fatherId: me.id, motherId: x.id });
    });
    it('member liên kết thêm CON mới, mẹ là vợ hiện tại → OK; bố trong input bị ghi đè', async () => {
      const { me, wife, stranger } = await family();
      const { id } = await addRelative(db, linked(me.id), me.id, 'CHILD', {
        member: input({ motherId: wife.id, fatherId: stranger.id }),
      });
      expect(await get(id)).toMatchObject({
        fatherId: me.id,
        motherId: wife.id,
        generation: 4,
      });
    });
    it('member liên kết thêm CON mới cho mẹ mình, bố là chồng hiện tại của mẹ → OK', async () => {
      const { me, father, mother } = await family();
      const { id } = await addRelative(db, linked(me.id), mother.id, 'CHILD', {
        member: input({ fatherId: father.id }),
      });
      expect(await get(id)).toMatchObject({
        fatherId: father.id,
        motherId: mother.id,
      });
    });
  });
});

describe('removeSpouse', () => {
  it('admin gỡ → Marriage mất, cả hai còn', async () => {
    const { me, wife } = await family();
    await removeSpouse(db, ADMIN, me.id, wife.id);
    expect(
      await db.marriage.count({
        where: { OR: [{ person1Id: me.id }, { person2Id: me.id }] },
      }),
    ).toBe(0);
    expect(
      await db.member.count({ where: { id: { in: [me.id, wife.id] } } }),
    ).toBe(2);
  });
  it('không có Marriage → 404', async () => {
    const { me, stranger } = await family();
    await expectError(removeSpouse(db, ADMIN, me.id, stranger.id), 404);
  });
  it('người không tồn tại → 404', async () => {
    const { me } = await family();
    await expectError(removeSpouse(db, ADMIN, 9999, me.id), 404);
  });
  it('member liên kết gỡ vợ của chính mình → OK', async () => {
    const { me, wife } = await family();
    await removeSpouse(db, linked(me.id), me.id, wife.id);
    expect(await db.marriage.count()).toBe(1);
  });
  it('member liên kết gỡ cho người không phải người thân → 403', async () => {
    const { me, grandpa } = await family();
    const ba = await make(db, { gender: 'FEMALE', generation: 1 });
    await marry(db, grandpa.id, ba.id);
    await expectError(removeSpouse(db, linked(me.id), grandpa.id, ba.id), 403);
    expect(await db.marriage.count()).toBe(3);
  });
  it('chưa liên kết → 403', async () => {
    const { me, wife } = await family();
    await expectError(removeSpouse(db, UNLINKED, me.id, wife.id), 403);
  });
});

describe('getMemberDetail', () => {
  it('trả bố, mẹ, vợ (marriageId, order), con theo birthOrder → năm sinh → id', async () => {
    const { father, mother, me, wife, child } = await family();
    const m = await db.marriage.findFirstOrThrow({
      where: { person1Id: me.id, person2Id: wife.id },
    });
    await db.marriage.update({ where: { id: m.id }, data: { order: 1 } });
    const c2 = await make(db, {
      generation: 4,
      fatherId: me.id,
      birthOrder: 1,
    });
    const c3 = await make(db, {
      generation: 4,
      fatherId: me.id,
      birthYear: 1990,
    });
    const c4 = await make(db, {
      generation: 4,
      fatherId: me.id,
      birthYear: 1980,
    });
    const d = await getMemberDetail(db, ADMIN, me.id, TODAY);
    expect(d.father?.id).toBe(father.id);
    expect(d.mother?.id).toBe(mother.id);
    expect(d.spouses).toEqual([
      expect.objectContaining({ id: wife.id, marriageId: m.id, order: 1 }),
    ]);
    expect(d.children.map((c) => c.id)).toEqual([
      c2.id,
      c4.id,
      c3.id,
      child.id,
    ]);
    expect(d.children[0]).not.toHaveProperty('birthOrder');
  });
  it('generationLocked: true khi có bố, false khi nhập tay', async () => {
    const { me, stranger } = await family();
    expect(
      (await getMemberDetail(db, ADMIN, me.id, TODAY)).generationLocked,
    ).toBe(true);
    expect(
      (await getMemberDetail(db, ADMIN, stranger.id, TODAY)).generationLocked,
    ).toBe(false);
  });
  it('nextAnniversary: đã khuất giỗ âm 23/8 → 03/10/2026, còn 0 ngày; người còn sống → null', async () => {
    const dead = await make(db, {
      generation: 1,
      isDeceased: true,
      anniversaryDay: 23,
      anniversaryMonth: 8,
      anniversaryCalendar: 'LUNAR',
    });
    const alive = await make(db, {
      generation: 1,
      anniversaryDay: 23,
      anniversaryMonth: 8,
      anniversaryCalendar: 'LUNAR',
    });
    expect(
      (await getMemberDetail(db, ADMIN, dead.id, TODAY)).nextAnniversary,
    ).toEqual({
      date: { year: 2026, month: 10, day: 3 },
      daysLeft: 0,
    });
    expect(
      (await getMemberDetail(db, ADMIN, alive.id, TODAY)).nextAnniversary,
    ).toBeNull();
  });
  it('permissions theo vai trò', async () => {
    const { me, father, stranger } = await family();
    const perm = async (
      actor: Parameters<typeof getMemberDetail>[1],
      id: number,
    ) => (await getMemberDetail(db, actor, id, TODAY)).permissions;
    expect(await perm(ADMIN, stranger.id)).toEqual({
      canEdit: true,
      canDelete: true,
    });
    expect(await perm(linked(me.id), father.id)).toEqual({
      canEdit: true,
      canDelete: false,
    });
    expect(await perm(linked(me.id), stranger.id)).toEqual({
      canEdit: false,
      canDelete: false,
    });
    expect(await perm(UNLINKED, father.id)).toEqual({
      canEdit: false,
      canDelete: false,
    });
  });
  it('không tồn tại → 404', async () => {
    await expectError(getMemberDetail(db, ADMIN, 9999, TODAY), 404);
  });
});

describe('searchMembers', () => {
  it('"vu van" khớp "VŨ VĂN AN" (không dấu)', async () => {
    const an = await make(db, { fullName: 'VŨ VĂN AN' });
    await make(db, { fullName: 'LÊ THỊ BA' });
    expect((await searchMembers(db, { q: 'vu van' })).map((r) => r.id)).toEqual(
      [an.id],
    );
  });
  it('"Đặng" khớp "ĐẶNG THỊ ÁNH"', async () => {
    const anh = await make(db, { fullName: 'ĐẶNG THỊ ÁNH' });
    expect((await searchMembers(db, { q: 'Đặng' })).map((r) => r.id)).toEqual([
      anh.id,
    ]);
  });
  it('lọc generation, gender, excludeId', async () => {
    const a = await make(db, { gender: 'MALE', generation: 2 });
    const b = await make(db, { gender: 'FEMALE', generation: 2 });
    const c = await make(db, { gender: 'MALE', generation: 3 });
    const ids = async (q: Parameters<typeof searchMembers>[1]) =>
      (await searchMembers(db, q)).map((r) => r.id);
    expect(await ids({ generation: 2 })).toEqual([a.id, b.id]);
    expect(await ids({ gender: 'MALE' })).toEqual([a.id, c.id]);
    expect(await ids({ excludeId: a.id })).toEqual([b.id, c.id]);
  });
  it('trả fatherName/motherName', async () => {
    const { me } = await family();
    const [r] = await searchMembers(db, { q: 'vu van toi' });
    expect(r).toMatchObject({
      id: me.id,
      fatherName: 'VŨ VĂN BỐ',
      motherName: 'NGUYỄN THỊ MẸ',
    });
    const [g] = await searchMembers(db, { q: 'vu van ong' });
    expect(g).toMatchObject({ fatherName: null, motherName: null });
  });
  it('limit 2 → 2 kết quả; limit 999 → tối đa 50; mặc định 20', async () => {
    await db.member.createMany({
      data: Array.from({ length: 55 }, (_, i) => ({
        fullName: `VŨ VĂN ${i}`,
        searchName: `vu van ${i}`,
        generation: 1,
      })),
    });
    expect(await searchMembers(db, { limit: 2 })).toHaveLength(2);
    expect(await searchMembers(db, { limit: 999 })).toHaveLength(50);
    expect(await searchMembers(db, {})).toHaveLength(20);
  });
  it('xếp theo đời rồi tên', async () => {
    const ba = await make(db, { fullName: 'VŨ VĂN BA', generation: 2 });
    const an = await make(db, { fullName: 'VŨ VĂN AN', generation: 2 });
    const cuong = await make(db, { fullName: 'VŨ VĂN CƯỜNG', generation: 1 });
    expect((await searchMembers(db, {})).map((r) => r.id)).toEqual([
      cuong.id,
      an.id,
      ba.id,
    ]);
  });
});

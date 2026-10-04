import { describe, expect, it } from 'vitest';
import { createMember, loginAs, marry } from '../../test/helpers/factories.js';
import { testDb as db } from '../../test/helpers/test-db.js';
import { createSession, validateSessionToken } from '../auth/session.js';

describe('schema Member/Marriage', () => {
  it('tên trùng nhau được phép (fullName không unique)', async () => {
    await createMember(db, { fullName: 'vũ đức dũng', generation: 5 });
    await createMember(db, { fullName: 'VŨ ĐỨC DŨNG', generation: 5 });
    expect(await db.member.count({ where: { fullName: 'VŨ ĐỨC DŨNG' } })).toBe(
      2,
    );
  });

  it('factory chuẩn hóa tên và searchName', async () => {
    const m = await createMember(db, { fullName: '  vũ   đức dũng ' });
    expect(m.fullName).toBe('VŨ ĐỨC DŨNG');
    expect(m.searchName).toBe('vu duc dung');
  });

  it('đời < 1 bị CHECK chặn', async () => {
    await expect(createMember(db, { generation: 0 })).rejects.toThrow(
      /Member_generation_check/,
    );
  });

  it('không tự làm bố / mẹ của chính mình (CHECK)', async () => {
    const m = await createMember(db);
    await expect(
      db.member.update({ where: { id: m.id }, data: { fatherId: m.id } }),
    ).rejects.toThrow(/Member_not_own_parent_check/);
    await expect(
      db.member.update({ where: { id: m.id }, data: { motherId: m.id } }),
    ).rejects.toThrow(/Member_not_own_parent_check/);
  });

  it('Marriage: person1Id < person2Id (CHECK) và cặp là duy nhất', async () => {
    const a = await createMember(db);
    const b = await createMember(db);
    const m = await marry(db, b.id, a.id);
    expect([m.person1Id, m.person2Id]).toEqual([a.id, b.id]);
    await expect(marry(db, a.id, b.id)).rejects.toMatchObject({
      code: 'P2002',
    });
    await expect(
      db.marriage.create({ data: { person1Id: b.id, person2Id: a.id } }),
    ).rejects.toThrow(/Marriage_person_order_check/);
    await expect(
      db.marriage.create({ data: { person1Id: a.id, person2Id: a.id } }),
    ).rejects.toThrow(/Marriage_person_order_check/);
  });

  it('xóa bố / mẹ khi còn con → bị chặn (Restrict)', async () => {
    const father = await createMember(db, { gender: 'MALE' });
    const mother = await createMember(db, { gender: 'FEMALE' });
    await createMember(db, {
      fatherId: father.id,
      motherId: mother.id,
      generation: 2,
    });
    await expect(
      db.member.delete({ where: { id: father.id } }),
    ).rejects.toMatchObject({
      code: 'P2003',
      message: expect.stringMatching(/Member_fatherId_fkey/),
    });
    await expect(
      db.member.delete({ where: { id: mother.id } }),
    ).rejects.toMatchObject({
      code: 'P2003',
      message: expect.stringMatching(/Member_motherId_fkey/),
    });
    expect(await db.member.count()).toBe(3);
  });

  it('xóa member → xóa Marriage liên quan, gỡ memberId của tài khoản', async () => {
    const a = await createMember(db);
    const b = await createMember(db);
    const c = await createMember(db);
    await marry(db, a.id, b.id);
    await marry(db, b.id, c.id);
    const user = await db.user.create({
      data: { username: 'linked', passwordHash: 'x', memberId: a.id },
    });
    await db.member.delete({ where: { id: a.id } });
    expect(await db.marriage.count()).toBe(1);
    expect(
      (await db.user.findUniqueOrThrow({ where: { id: user.id } })).memberId,
    ).toBeNull();
  });

  it('một member tối đa một tài khoản', async () => {
    const a = await createMember(db);
    await db.user.create({
      data: { username: 'one', passwordHash: 'x', memberId: a.id },
    });
    await expect(
      db.user.create({
        data: { username: 'two', passwordHash: 'x', memberId: a.id },
      }),
    ).rejects.toMatchObject({ code: 'P2002' });
  });

  it('session trả memberId của tài khoản', async () => {
    const a = await createMember(db);
    const user = await db.user.create({
      data: { username: 'withmember', passwordHash: 'x', memberId: a.id },
    });
    const { token } = await createSession(db, user.id);
    expect(await validateSessionToken(db, token)).toMatchObject({
      memberId: a.id,
    });
  });

  it('loginAs tạo tài khoản + session dùng được', async () => {
    const a = await createMember(db);
    const { cookie, userId } = await loginAs(db, { memberId: a.id });
    const token = cookie.replace(/^giapha_session=/, '');
    expect(await validateSessionToken(db, token)).toEqual({
      id: userId,
      username: expect.stringMatching(/^u_[0-9a-f]{12}$/),
      role: 'MEMBER',
      memberId: a.id,
    });
    const admin = await loginAs(db, { role: 'ADMIN' });
    expect(
      await validateSessionToken(
        db,
        admin.cookie.replace(/^giapha_session=/, ''),
      ),
    ).toMatchObject({ role: 'ADMIN', memberId: null });
  });
});

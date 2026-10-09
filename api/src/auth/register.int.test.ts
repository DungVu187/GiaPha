import { describe, expect, it } from 'vitest';
import { createMember as make, marry } from '../../test/helpers/factories.js';
import { testDb as db } from '../../test/helpers/test-db.js';
import { verifyPassword } from './password.js';
import {
  findClaimableMembers,
  register,
  uniqueViolationOn,
} from './register.js';
import type { RegisterInput } from './register-input.js';

const input = (patch: Partial<RegisterInput> = {}): RegisterInput => ({
  username: 'dungvu123',
  password: 'MatKhau@123',
  fullName: 'VŨ ĐỨC DŨNG',
  generation: 5,
  email: null,
  claim: { kind: 'NONE' },
  ...patch,
});

async function seedDung() {
  const thinh = await make(db, {
    fullName: 'VŨ ĐỨC THỊNH',
    generation: 4,
    gender: 'MALE',
  });
  const lan = await make(db, {
    fullName: 'TRẦN THỊ LAN',
    generation: 4,
    gender: 'FEMALE',
  });
  await marry(db, thinh.id, lan.id);
  const dung1 = await make(db, {
    fullName: 'VŨ ĐỨC DŨNG',
    generation: 5,
    gender: 'MALE',
    fatherId: thinh.id,
    motherId: lan.id,
    birthYear: 2003,
    birthMonth: 7,
    birthDay: 18,
  });
  const binh = await make(db, {
    fullName: 'VŨ VĂN BÌNH',
    generation: 4,
    gender: 'MALE',
  });
  const dung2 = await make(db, {
    fullName: 'VŨ ĐỨC DŨNG',
    generation: 5,
    gender: 'MALE',
    fatherId: binh.id,
    birthYear: 1998,
  });
  return { thinh, lan, binh, dung1, dung2 };
}

async function caught(promise: Promise<unknown>): Promise<unknown> {
  try {
    await promise;
  } catch (error) {
    return error;
  }
  throw new Error('expected rejection');
}

describe('findClaimableMembers', () => {
  it('trả người cùng tên + đời, còn sống, chưa liên kết; kèm tên bố mẹ, ngày sinh; xếp id', async () => {
    const { dung1, dung2 } = await seedDung();
    expect(await findClaimableMembers(db, 'VŨ ĐỨC DŨNG', 5)).toEqual([
      {
        id: dung1.id,
        fullName: 'VŨ ĐỨC DŨNG',
        generation: 5,
        fatherName: 'VŨ ĐỨC THỊNH',
        motherName: 'TRẦN THỊ LAN',
        birthYear: 2003,
        birthMonth: 7,
        birthDay: 18,
      },
      {
        id: dung2.id,
        fullName: 'VŨ ĐỨC DŨNG',
        generation: 5,
        fatherName: 'VŨ VĂN BÌNH',
        motherName: null,
        birthYear: 1998,
        birthMonth: null,
        birthDay: null,
      },
    ]);
  });

  it('loại: đã liên kết, đã khuất, khác đời, khác dấu (DUNG ≠ DŨNG)', async () => {
    const linked = await make(db, { fullName: 'VŨ ĐỨC DŨNG', generation: 5 });
    await db.user.create({
      data: { username: 'dalienket', passwordHash: 'x', memberId: linked.id },
    });
    await make(db, {
      fullName: 'VŨ ĐỨC DŨNG',
      generation: 5,
      isDeceased: true,
    });
    await make(db, { fullName: 'VŨ ĐỨC DŨNG', generation: 6 });
    await make(db, { fullName: 'VŨ ĐỨC DUNG', generation: 5 });
    expect(await findClaimableMembers(db, 'VŨ ĐỨC DŨNG', 5)).toEqual([]);
  });
});

describe('uniqueViolationOn', () => {
  it('nhận đúng cột từ lỗi P2002 thật: username, email, memberId', async () => {
    const m = await make(db);
    await db.user.create({
      data: {
        username: 'dau',
        passwordHash: 'x',
        email: 'a@vu.vn',
        memberId: m.id,
      },
    });
    const dup = (data: {
      username: string;
      email?: string;
      memberId?: number;
    }) => caught(db.user.create({ data: { passwordHash: 'x', ...data } }));
    expect(uniqueViolationOn(await dup({ username: 'dau' }))).toBe('username');
    expect(
      uniqueViolationOn(await dup({ username: 'khac1', email: 'a@vu.vn' })),
    ).toBe('email');
    expect(
      uniqueViolationOn(await dup({ username: 'khac2', memberId: m.id })),
    ).toBe('memberId');
  });

  it('lỗi không phải P2002 → null', async () => {
    const fk = await caught(
      db.user.create({
        data: { username: 'khongco', passwordHash: 'x', memberId: 999999 },
      }),
    );
    expect(uniqueViolationOn(fk)).toBeNull();
    expect(uniqueViolationOn(new Error('x'))).toBeNull();
  });
});

describe('register', () => {
  it('không ai khớp → tạo Member + User trong một lần; mật khẩu băm; role MEMBER', async () => {
    const r = await register(db, input({ email: 'dung@vu.vn' }));
    expect(r.kind).toBe('created');
    if (r.kind !== 'created') return;
    expect(r.claimed).toBe(false);
    expect(r.user).toEqual({
      id: expect.any(Number),
      username: 'dungvu123',
      role: 'MEMBER',
      memberId: expect.any(Number),
    });
    const member = await db.member.findUniqueOrThrow({
      where: { id: r.user.memberId! },
    });
    expect(member).toMatchObject({
      fullName: 'VŨ ĐỨC DŨNG',
      searchName: 'vu duc dung',
      generation: 5,
      gender: null,
      isDeceased: false,
      fatherId: null,
      motherId: null,
      birthYear: null,
    });
    const user = await db.user.findUniqueOrThrow({ where: { id: r.user.id } });
    expect(user.email).toBe('dung@vu.vn');
    expect(user.passwordHash).not.toContain('MatKhau@123');
    expect(await verifyPassword(user.passwordHash, 'MatKhau@123')).toBe(true);
  });

  it('có người khớp, chưa chọn → trả danh sách, KHÔNG tạo gì', async () => {
    const { dung1, dung2 } = await seedDung();
    const members = await db.member.count();
    const r = await register(db, input());
    expect(r).toEqual({
      kind: 'matches',
      matches: [
        expect.objectContaining({ id: dung1.id }),
        expect.objectContaining({ id: dung2.id }),
      ],
    });
    expect(await db.user.count()).toBe(0);
    expect(await db.member.count()).toBe(members);
  });

  it('"Đây là tôi" → User gắn đúng hồ sơ có sẵn, không tạo Member, không sửa hồ sơ', async () => {
    const { dung1 } = await seedDung();
    const members = await db.member.count();
    const before = await db.member.findUniqueOrThrow({
      where: { id: dung1.id },
    });
    const r = await register(
      db,
      input({ claim: { kind: 'MEMBER', memberId: dung1.id } }),
    );
    expect(r).toEqual({
      kind: 'created',
      claimed: true,
      user: {
        id: expect.any(Number),
        username: 'dungvu123',
        role: 'MEMBER',
        memberId: dung1.id,
      },
    });
    expect(await db.member.count()).toBe(members);
    expect(
      await db.member.findUniqueOrThrow({ where: { id: dung1.id } }),
    ).toEqual(before);
  });

  it('"Tạo thành viên mới" khi có người khớp → tạo Member mới', async () => {
    const { dung1, dung2 } = await seedDung();
    const r = await register(db, input({ claim: { kind: 'NEW' } }));
    if (r.kind !== 'created') throw new Error(r.kind);
    expect(r.claimed).toBe(false);
    expect([dung1.id, dung2.id]).not.toContain(r.user.memberId);
    expect(await findClaimableMembers(db, 'VŨ ĐỨC DŨNG', 5)).toHaveLength(2);
  });

  it('nhận hồ sơ không khớp tên/đời (id tùy ý) → claim-unavailable, không tạo gì', async () => {
    const { thinh } = await seedDung();
    const r = await register(
      db,
      input({ claim: { kind: 'MEMBER', memberId: thinh.id } }),
    );
    expect(r.kind).toBe('claim-unavailable');
    expect(await db.user.count()).toBe(0);
  });

  it('nhận hồ sơ không tồn tại → claim-unavailable', async () => {
    const r = await register(
      db,
      input({ claim: { kind: 'MEMBER', memberId: 999999 } }),
    );
    expect(r).toEqual({ kind: 'claim-unavailable', matches: [] });
  });

  it('nhận hồ sơ đã có tài khoản → claim-unavailable kèm danh sách còn lại', async () => {
    const { dung1, dung2 } = await seedDung();
    await db.user.create({
      data: { username: 'nguoitruoc', passwordHash: 'x', memberId: dung1.id },
    });
    const r = await register(
      db,
      input({ claim: { kind: 'MEMBER', memberId: dung1.id } }),
    );
    expect(r).toEqual({
      kind: 'claim-unavailable',
      matches: [expect.objectContaining({ id: dung2.id })],
    });
    expect(await db.user.count()).toBe(1);
  });

  it('nhận hồ sơ người đã khuất → claim-unavailable', async () => {
    const dead = await make(db, {
      fullName: 'VŨ ĐỨC DŨNG',
      generation: 5,
      isDeceased: true,
    });
    const r = await register(
      db,
      input({ claim: { kind: 'MEMBER', memberId: dead.id } }),
    );
    expect(r.kind).toBe('claim-unavailable');
  });

  it('username đã có → invalid, không tạo gì', async () => {
    await db.user.create({
      data: { username: 'dungvu123', passwordHash: 'x' },
    });
    expect(await register(db, input())).toEqual({
      kind: 'invalid',
      errors: { username: 'Tên đăng nhập đã có người dùng.' },
    });
    expect(await db.member.count()).toBe(0);
  });

  it('email đã có → invalid; cả username và email trùng → trả cả hai lỗi', async () => {
    await db.user.create({
      data: { username: 'nguoikhac', passwordHash: 'x', email: 'dung@vu.vn' },
    });
    expect(await register(db, input({ email: 'dung@vu.vn' }))).toEqual({
      kind: 'invalid',
      errors: { email: 'Email này đã được dùng cho tài khoản khác.' },
    });
    expect(
      await register(db, input({ username: 'nguoikhac', email: 'dung@vu.vn' })),
    ).toEqual({
      kind: 'invalid',
      errors: {
        username: 'Tên đăng nhập đã có người dùng.',
        email: 'Email này đã được dùng cho tài khoản khác.',
      },
    });
    expect(await db.member.count()).toBe(0);
  });

  it('hai người cùng nhận MỘT hồ sơ cùng lúc → đúng một người thành công', async () => {
    const { dung1 } = await seedDung();
    const results = await Promise.all([
      register(
        db,
        input({
          username: 'nguoi_a',
          claim: { kind: 'MEMBER', memberId: dung1.id },
        }),
      ),
      register(
        db,
        input({
          username: 'nguoi_b',
          claim: { kind: 'MEMBER', memberId: dung1.id },
        }),
      ),
    ]);
    expect(results.map((r) => r.kind).sort()).toEqual([
      'claim-unavailable',
      'created',
    ]);
    expect(await db.user.count({ where: { memberId: dung1.id } })).toBe(1);
    expect(await db.user.count()).toBe(1);
  });

  it('hai người cùng đăng ký MỘT username cùng lúc → một thành công, một báo trùng; không thừa Member', async () => {
    const results = await Promise.all([
      register(db, input({ fullName: 'VŨ VĂN MỘT' })),
      register(db, input({ fullName: 'VŨ VĂN HAI' })),
    ]);
    const kinds = results.map((r) => r.kind).sort();
    expect(kinds).toEqual(['created', 'invalid']);
    const failed = results.find((r) => r.kind === 'invalid');
    expect(failed).toEqual({
      kind: 'invalid',
      errors: { username: 'Tên đăng nhập đã có người dùng.' },
    });
    expect(await db.user.count()).toBe(1);
    expect(await db.member.count()).toBe(1); // Member của người thua đã rollback
  });

  it('mật khẩu có dấu đăng ký dạng NFD, đăng nhập dạng NFC vẫn đúng', async () => {
    const r = await register(
      db,
      input({ password: 'Mật khẩu đẹp'.normalize('NFD') }),
    );
    if (r.kind !== 'created') throw new Error(r.kind);
    const user = await db.user.findUniqueOrThrow({ where: { id: r.user.id } });
    expect(
      await verifyPassword(user.passwordHash, 'Mật khẩu đẹp'.normalize('NFC')),
    ).toBe(true);
  });
});

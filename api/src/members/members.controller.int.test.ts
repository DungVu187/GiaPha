import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from '../../test/helpers/app.js';
import { createMember, loginAs, marry } from '../../test/helpers/factories.js';
import { testDb as db } from '../../test/helpers/test-db.js';

const FORBIDDEN = { message: 'Bạn không có quyền thực hiện thao tác này.' };
const NOT_FOUND = { message: 'Không tìm thấy thành viên.' };
const BAD_QUERY = {
  message: 'Dữ liệu không hợp lệ.',
  errors: { query: 'Tham số tìm kiếm không hợp lệ.' },
};
const BAD_TARGET = {
  message: 'Dữ liệu không hợp lệ.',
  errors: { target: 'Chọn người có sẵn hoặc nhập người mới.' },
};

describe('members API', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app.close());

  async function family() {
    const ong = await createMember(db, {
      fullName: 'VŨ VĂN ÔNG',
      gender: 'MALE',
      generation: 1,
    });
    const bo = await createMember(db, {
      fullName: 'VŨ VĂN BỐ',
      gender: 'MALE',
      generation: 2,
      fatherId: ong.id,
    });
    const me = await createMember(db, {
      fullName: 'VŨ VĂN TÔI',
      gender: 'MALE',
      generation: 3,
      fatherId: bo.id,
    });
    const bac = await createMember(db, {
      fullName: 'VŨ VĂN BÁC',
      gender: 'MALE',
      generation: 2,
      fatherId: ong.id,
    });
    return { ong, bo, me, bac };
  }

  // Đủ vai trò cho test quyền: admin, member là `me`, chưa liên kết.
  async function actors(meId: number) {
    return {
      admin: await loginAs(db, { role: 'ADMIN' }),
      member: await loginAs(db, { memberId: meId }),
      unlinked: await loginAs(db),
    };
  }

  it('chưa đăng nhập → 401 ở mọi route', async () => {
    const f = await family();
    const id = f.me.id;
    const res = [
      await http().get('/api/members'),
      await http().get(`/api/members/${id}`),
      await http().post('/api/members').send({ fullName: 'A', generation: 1 }),
      await http()
        .put(`/api/members/${id}`)
        .send({ fullName: 'A', generation: 1 }),
      await http().delete(`/api/members/${id}`),
      await http()
        .post(`/api/members/${id}/relatives`)
        .send({ relation: 'CHILD', member: { fullName: 'A' } }),
      await http().delete(`/api/members/${id}/spouses/${f.bac.id}`),
    ];
    expect(res.map((r) => r.status)).toEqual([
      401, 401, 401, 401, 401, 401, 401,
    ]);
    expect(await db.member.count()).toBe(4);
  });

  describe('GET /api/members', () => {
    it('tìm không dấu; mọi vai trò (kể cả chưa liên kết) xem được', async () => {
      const f = await family();
      const a = await actors(f.me.id);
      for (const u of [a.admin, a.member, a.unlinked]) {
        const res = await http()
          .get('/api/members?q=vu van bo')
          .set('Cookie', u.cookie);
        expect(res.status).toBe(200);
        expect(res.body).toEqual([
          expect.objectContaining({
            id: f.bo.id,
            fullName: 'VŨ VĂN BỐ',
            fatherName: 'VŨ VĂN ÔNG',
            motherName: null,
          }),
        ]);
      }
    });

    it('lọc theo generation, gender, excludeId, limit', async () => {
      const f = await family();
      const u = await loginAs(db);
      const res = await http()
        .get(
          `/api/members?q=vu&generation=2&gender=MALE&excludeId=${f.bo.id}&limit=5`,
        )
        .set('Cookie', u.cookie);
      expect(res.status).toBe(200);
      expect(res.body.map((m: { id: number }) => m.id)).toEqual([f.bac.id]);
      const limited = await http()
        .get('/api/members?limit=1&gender=')
        .set('Cookie', u.cookie);
      expect(limited.body).toHaveLength(1);
    });

    it.each([
      'generation=abc',
      'generation=0',
      'generation=-1',
      'generation=1.5',
      'generation=99999999999',
      'limit=abc',
      'limit=0',
      'excludeId=-3',
      'excludeId=1e3',
      'gender=OTHER',
      `q=${'a'.repeat(101)}`,
      'q=a&q=b',
      'generation=1&generation=2',
      'gender=MALE&gender=FEMALE',
    ])('query sai ?%s → 400 errors.query', async (qs) => {
      const u = await loginAs(db);
      const res = await http()
        .get(`/api/members?${qs}`)
        .set('Cookie', u.cookie);
      expect(res.status).toBe(400);
      expect(res.body).toEqual(BAD_QUERY);
    });

    it('q đúng 100 ký tự vẫn hợp lệ', async () => {
      const u = await loginAs(db);
      const res = await http()
        .get(`/api/members?q=${'a'.repeat(100)}`)
        .set('Cookie', u.cookie);
      expect(res.status).toBe(200);
      expect(res.body).toEqual([]);
    });
  });

  describe('GET /api/members/:id', () => {
    it('trả đủ trường; permissions theo vai trò', async () => {
      const f = await family();
      const a = await actors(f.me.id);
      const get = (id: number, cookie: string) =>
        http().get(`/api/members/${id}`).set('Cookie', cookie);

      const res = await get(f.bo.id, a.admin.cookie);
      expect(res.status).toBe(200);
      expect(res.body).toMatchObject({
        id: f.bo.id,
        fullName: 'VŨ VĂN BỐ',
        generation: 2,
        father: { id: f.ong.id, fullName: 'VŨ VĂN ÔNG' },
        mother: null,
        spouses: [],
        children: [expect.objectContaining({ id: f.me.id })],
        generationLocked: true,
        nextAnniversary: null,
        permissions: { canEdit: true, canDelete: true },
      });

      expect((await get(f.bo.id, a.member.cookie)).body.permissions).toEqual({
        canEdit: true,
        canDelete: false,
      });
      expect((await get(f.bac.id, a.member.cookie)).body.permissions).toEqual({
        canEdit: false,
        canDelete: false,
      });
      expect((await get(f.bo.id, a.unlinked.cookie)).body.permissions).toEqual({
        canEdit: false,
        canDelete: false,
      });
      expect((await get(f.ong.id, a.admin.cookie)).body.generationLocked).toBe(
        false,
      );
    });

    it.each(['abc', '999999', '0', '-1', '1.5', '2147483648', '1e3'])(
      '/api/members/%s → 404 cùng thông báo',
      async (id) => {
        const u = await loginAs(db);
        const res = await http()
          .get(`/api/members/${id}`)
          .set('Cookie', u.cookie);
        expect(res.status).toBe(404);
        expect(res.body).toEqual(NOT_FOUND);
      },
    );
  });

  describe('POST /api/members', () => {
    it('admin 201; member liên kết 403; chưa liên kết 403', async () => {
      const f = await family();
      const a = await actors(f.me.id);
      const body = { fullName: 'vũ văn mới', gender: 'MALE', generation: 1 };
      const res = await http()
        .post('/api/members')
        .set('Cookie', a.admin.cookie)
        .send(body);
      expect(res.status).toBe(201);
      expect(res.body).toEqual({ id: expect.any(Number) });
      expect(
        (await db.member.findUniqueOrThrow({ where: { id: res.body.id } }))
          .fullName,
      ).toBe('VŨ VĂN MỚI');
      const m = await http()
        .post('/api/members')
        .set('Cookie', a.member.cookie)
        .send(body);
      expect(m.status).toBe(403);
      expect(m.body).toEqual(FORBIDDEN);
      const u = await http()
        .post('/api/members')
        .set('Cookie', a.unlinked.cookie)
        .send(body);
      expect(u.status).toBe(403);
      expect(u.body).toEqual(FORBIDDEN);
      expect(await db.member.count()).toBe(5);
    });

    it('dữ liệu sai → 400 kèm errors tiếng Việt', async () => {
      const admin = await loginAs(db, { role: 'ADMIN' });
      const res = await http()
        .post('/api/members')
        .set('Cookie', admin.cookie)
        .send({ fullName: '' });
      expect(res.status).toBe(400);
      expect(res.body).toEqual({
        message: 'Dữ liệu không hợp lệ.',
        errors: { fullName: 'Vui lòng nhập họ tên.' },
      });
    });

    it('body là mảng → 400', async () => {
      const admin = await loginAs(db, { role: 'ADMIN' });
      const res = await http()
        .post('/api/members')
        .set('Cookie', admin.cookie)
        .send([1, 2]);
      expect(res.status).toBe(400);
      expect(res.body.message).toBe('Dữ liệu không hợp lệ.');
    });
  });

  describe('PUT /api/members/:id', () => {
    it('admin sửa bác → 204, tên chuẩn hóa ở DB', async () => {
      const f = await family();
      const admin = await loginAs(db, { role: 'ADMIN' });
      const res = await http()
        .put(`/api/members/${f.bac.id}`)
        .set('Cookie', admin.cookie)
        .send({
          fullName: '  vũ   văn bác cả ',
          gender: 'MALE',
          fatherId: f.ong.id,
        });
      expect(res.status).toBe(204);
      const bac = await db.member.findUniqueOrThrow({
        where: { id: f.bac.id },
      });
      expect(bac.fullName).toBe('VŨ VĂN BÁC CẢ');
      expect(bac.searchName).toBe('vu van bac ca');
    });

    it('member sửa bố mình → 204 (DB đổi)', async () => {
      const f = await family();
      const { member } = await actors(f.me.id);
      const res = await http()
        .put(`/api/members/${f.bo.id}`)
        .set('Cookie', member.cookie)
        .send({
          fullName: 'vũ văn bố',
          gender: 'MALE',
          fatherId: f.ong.id,
          note: 'Trưởng chi',
        });
      expect(res.status).toBe(204);
      const bo = await db.member.findUniqueOrThrow({ where: { id: f.bo.id } });
      expect(bo.note).toBe('Trưởng chi');
    });

    it('member sửa bác / ông nội → 403; chưa liên kết → 403; DB không đổi', async () => {
      const f = await family();
      const a = await actors(f.me.id);
      const body = (fatherId: number | null) => ({
        fullName: 'SỬA TRÁI PHÉP',
        gender: 'MALE',
        generation: 1,
        fatherId,
      });
      for (const [cookie, target, fatherId] of [
        [a.member.cookie, f.bac.id, f.ong.id],
        [a.member.cookie, f.ong.id, null],
        [a.unlinked.cookie, f.bo.id, f.ong.id],
      ] as const) {
        const res = await http()
          .put(`/api/members/${target}`)
          .set('Cookie', cookie)
          .send(body(fatherId));
        expect(res.status).toBe(403);
        expect(res.body).toEqual(FORBIDDEN);
      }
      expect(
        await db.member.count({ where: { fullName: 'SỬA TRÁI PHÉP' } }),
      ).toBe(0);
    });

    it('R12: member đổi bố/mẹ của người thân → 403', async () => {
      const f = await family();
      const { member } = await actors(f.me.id);
      const res = await http()
        .put(`/api/members/${f.me.id}`)
        .set('Cookie', member.cookie)
        .send({ fullName: 'VŨ VĂN TÔI', gender: 'MALE', fatherId: f.bac.id });
      expect(res.status).toBe(403);
      expect(res.body).toEqual(FORBIDDEN);
      expect(
        (await db.member.findUniqueOrThrow({ where: { id: f.me.id } }))
          .fatherId,
      ).toBe(f.bo.id);
    });

    it('dữ liệu sai → 400; id sai → 404', async () => {
      const f = await family();
      const admin = await loginAs(db, { role: 'ADMIN' });
      const bad = await http()
        .put(`/api/members/${f.bac.id}`)
        .set('Cookie', admin.cookie)
        .send({ fullName: 'A', gender: 'X' });
      expect(bad.status).toBe(400);
      expect(bad.body).toEqual({
        message: 'Dữ liệu không hợp lệ.',
        errors: { gender: 'Giới tính không hợp lệ.' },
      });
      const missing = await http()
        .put('/api/members/abc')
        .set('Cookie', admin.cookie)
        .send({ fullName: 'A', generation: 1 });
      expect(missing.status).toBe(404);
      expect(missing.body).toEqual(NOT_FOUND);
    });
  });

  describe('DELETE /api/members/:id', () => {
    it('admin xóa người không có con → 204; còn con → 409', async () => {
      const f = await family();
      const admin = await loginAs(db, { role: 'ADMIN' });
      const ok = await http()
        .delete(`/api/members/${f.bac.id}`)
        .set('Cookie', admin.cookie);
      expect(ok.status).toBe(204);
      expect(
        await db.member.findUnique({ where: { id: f.bac.id } }),
      ).toBeNull();
      const conflict = await http()
        .delete(`/api/members/${f.bo.id}`)
        .set('Cookie', admin.cookie);
      expect(conflict.status).toBe(409);
      expect(conflict.body).toEqual({
        message:
          'Không thể xóa: người này còn con trong gia phả. Hãy gỡ quan hệ con trước.',
      });
    });

    it('member (bố, bác, chính mình) → 403; chưa liên kết → 403; id lạ → 404', async () => {
      const f = await family();
      const a = await actors(f.me.id);
      for (const [cookie, id] of [
        [a.member.cookie, f.me.id],
        [a.member.cookie, f.bo.id],
        [a.member.cookie, f.bac.id],
        [a.unlinked.cookie, f.bac.id],
      ] as const) {
        const res = await http()
          .delete(`/api/members/${id}`)
          .set('Cookie', cookie);
        expect(res.status).toBe(403);
        expect(res.body).toEqual(FORBIDDEN);
      }
      expect(await db.member.count()).toBe(4);
      const missing = await http()
        .delete('/api/members/999999')
        .set('Cookie', a.admin.cookie);
      expect(missing.status).toBe(404);
    });
  });

  describe('POST /api/members/:id/relatives', () => {
    const post = (id: number, cookie: string, body: unknown) =>
      http()
        .post(`/api/members/${id}/relatives`)
        .set('Cookie', cookie)
        .send(body as object);

    it('admin thêm CON mới cho me → 201, con có fatherId = me, đời 4', async () => {
      const f = await family();
      const admin = await loginAs(db, { role: 'ADMIN' });
      const res = await post(f.me.id, admin.cookie, {
        relation: 'CHILD',
        member: { fullName: 'vũ văn con', gender: 'MALE' },
      });
      expect(res.status).toBe(201);
      expect(res.body).toEqual({ id: expect.any(Number) });
      const child = await db.member.findUniqueOrThrow({
        where: { id: res.body.id },
      });
      expect(child).toMatchObject({
        fullName: 'VŨ VĂN CON',
        fatherId: f.me.id,
        generation: 4,
      });
    });

    it('admin gắn người có sẵn làm vợ → 201', async () => {
      const f = await family();
      const wife = await createMember(db, {
        fullName: 'NGUYỄN THỊ VỢ',
        gender: 'FEMALE',
        generation: 1,
      });
      const admin = await loginAs(db, { role: 'ADMIN' });
      const res = await post(f.me.id, admin.cookie, {
        relation: 'SPOUSE',
        existingId: wife.id,
      });
      expect(res.status).toBe(201);
      expect(res.body).toEqual({ id: wife.id });
      expect(
        (await db.member.findUniqueOrThrow({ where: { id: wife.id } }))
          .generation,
      ).toBe(3);
    });

    it('member thêm CON mới cho chính mình → 201; thêm VỢ mới → 201 và có Marriage', async () => {
      const f = await family();
      const { member } = await actors(f.me.id);
      const child = await post(f.me.id, member.cookie, {
        relation: 'CHILD',
        member: { fullName: 'VŨ THỊ CON', gender: 'FEMALE' },
      });
      expect(child.status).toBe(201);
      const wife = await post(f.me.id, member.cookie, {
        relation: 'SPOUSE',
        member: { fullName: 'trần thị vợ', gender: 'FEMALE' },
      });
      expect(wife.status).toBe(201);
      const [person1Id, person2Id] = [f.me.id, wife.body.id].sort(
        (x, y) => x - y,
      );
      expect(
        await db.marriage.findUnique({
          where: { person1Id_person2Id: { person1Id, person2Id } },
        }),
      ).not.toBeNull();
    });

    it('member thêm CON cho bác → 403; chưa liên kết → 403', async () => {
      const f = await family();
      const a = await actors(f.me.id);
      const body = { relation: 'CHILD', member: { fullName: 'VŨ VĂN LẠ' } };
      for (const [id, cookie] of [
        [f.bac.id, a.member.cookie],
        [f.me.id, a.unlinked.cookie],
      ] as const) {
        const res = await post(id, cookie, body);
        expect(res.status).toBe(403);
        expect(res.body).toEqual(FORBIDDEN);
      }
      expect(await db.member.count()).toBe(4);
    });

    it('R12: member gắn người có sẵn (mọi loại quan hệ) → 403', async () => {
      const f = await family();
      const other = await createMember(db, {
        fullName: 'LÊ THỊ KHÁC',
        gender: 'FEMALE',
        generation: 3,
      });
      const { member } = await actors(f.me.id);
      for (const relation of ['MOTHER', 'SPOUSE', 'CHILD']) {
        const res = await post(f.me.id, member.cookie, {
          relation,
          existingId: other.id,
        });
        expect(res.status).toBe(403);
        expect(res.body).toEqual(FORBIDDEN);
      }
      expect(await db.marriage.count()).toBe(0);
    });

    it('R12: member tạo người mới trỏ bố/mẹ sang người có sẵn → 403; trỏ mẹ là vợ hiện tại cho CHILD → 201', async () => {
      const f = await family();
      const wife = await createMember(db, {
        fullName: 'NGUYỄN THỊ VỢ',
        gender: 'FEMALE',
        generation: 3,
      });
      await marry(db, f.me.id, wife.id);
      const stranger = await createMember(db, {
        fullName: 'LÊ THỊ LẠ',
        gender: 'FEMALE',
        generation: 3,
      });
      const { member } = await actors(f.me.id);
      const bad = await post(f.me.id, member.cookie, {
        relation: 'CHILD',
        member: { fullName: 'VŨ VĂN CON', motherId: stranger.id },
      });
      expect(bad.status).toBe(403);
      expect(bad.body).toEqual(FORBIDDEN);
      const badSpouse = await post(f.me.id, member.cookie, {
        relation: 'SPOUSE',
        member: {
          fullName: 'TRẦN THỊ HAI',
          gender: 'FEMALE',
          fatherId: f.bac.id,
        },
      });
      expect(badSpouse.status).toBe(403);
      const ok = await post(f.me.id, member.cookie, {
        relation: 'CHILD',
        member: { fullName: 'VŨ VĂN CON', motherId: wife.id },
      });
      expect(ok.status).toBe(201);
      expect(
        await db.member.findUniqueOrThrow({ where: { id: ok.body.id } }),
      ).toMatchObject({ fatherId: f.me.id, motherId: wife.id });
    });

    it.each([
      [{ relation: 'CHILD' }, BAD_TARGET],
      [{ relation: 'CHILD', existingId: null, member: null }, BAD_TARGET],
      [
        { relation: 'CHILD', existingId: 1, member: { fullName: 'A' } },
        BAD_TARGET,
      ],
      [{ relation: 'CHILD', existingId: '5' }, BAD_TARGET],
      [{ relation: 'CHILD', existingId: 0 }, BAD_TARGET],
      [{ relation: 'CHILD', existingId: -2 }, BAD_TARGET],
      [{ relation: 'CHILD', existingId: 1.5 }, BAD_TARGET],
      [{ relation: 'CHILD', existingId: 2147483648 }, BAD_TARGET],
      [
        { relation: 'UNCLE', member: { fullName: 'A' } },
        {
          message: 'Dữ liệu không hợp lệ.',
          errors: { relation: 'Loại quan hệ không hợp lệ.' },
        },
      ],
      [
        { relation: 'CHILD', member: { fullName: '' } },
        {
          message: 'Dữ liệu không hợp lệ.',
          errors: { fullName: 'Vui lòng nhập họ tên.' },
        },
      ],
    ])('body sai %j → 400', async (body, expected) => {
      const f = await family();
      const admin = await loginAs(db, { role: 'ADMIN' });
      const res = await post(f.me.id, admin.cookie, body);
      expect(res.status).toBe(400);
      expect(res.body).toEqual(expected);
      expect(await db.member.count()).toBe(4);
    });

    it('body là mảng / không phải object → 400 errors.relation', async () => {
      const f = await family();
      const admin = await loginAs(db, { role: 'ADMIN' });
      const res = await post(f.me.id, admin.cookie, [1]);
      expect(res.status).toBe(400);
      expect(res.body.errors).toEqual({
        relation: 'Loại quan hệ không hợp lệ.',
      });
    });

    it('thêm BỐ khi đã có bố → 409; id lạ → 404', async () => {
      const f = await family();
      const admin = await loginAs(db, { role: 'ADMIN' });
      const res = await post(f.me.id, admin.cookie, {
        relation: 'FATHER',
        member: { fullName: 'VŨ VĂN BỐ HAI' },
      });
      expect(res.status).toBe(409);
      expect(res.body).toEqual({ message: 'Người này đã có bố.' });
      const missing = await post(999999, admin.cookie, {
        relation: 'FATHER',
        member: { fullName: 'A' },
      });
      expect(missing.status).toBe(404);
      expect(missing.body).toEqual(NOT_FOUND);
    });
  });

  describe('DELETE /api/members/:id/spouses/:spouseId', () => {
    async function setup() {
      const f = await family();
      const wife = await createMember(db, {
        fullName: 'NGUYỄN THỊ VỢ',
        gender: 'FEMALE',
        generation: 3,
      });
      const bacWife = await createMember(db, {
        fullName: 'TRẦN THỊ BÁC GÁI',
        gender: 'FEMALE',
        generation: 2,
      });
      await marry(db, f.me.id, wife.id);
      await marry(db, f.bac.id, bacWife.id);
      return { ...f, wife, bacWife, ...(await actors(f.me.id)) };
    }
    const del = (id: number, spouseId: number | string, cookie: string) =>
      http()
        .delete(`/api/members/${id}/spouses/${spouseId}`)
        .set('Cookie', cookie);

    it('admin gỡ → 204', async () => {
      const s = await setup();
      expect((await del(s.bac.id, s.bacWife.id, s.admin.cookie)).status).toBe(
        204,
      );
      expect(await db.marriage.count()).toBe(1);
    });

    it('member gỡ vợ của chính mình → 204', async () => {
      const s = await setup();
      expect((await del(s.me.id, s.wife.id, s.member.cookie)).status).toBe(204);
      expect(await db.marriage.count()).toBe(1);
    });

    it('member gỡ cho người không phải người thân → 403; chưa liên kết → 403', async () => {
      const s = await setup();
      for (const [id, spouseId, cookie] of [
        [s.bac.id, s.bacWife.id, s.member.cookie],
        [s.me.id, s.wife.id, s.unlinked.cookie],
      ] as const) {
        const res = await del(id, spouseId, cookie);
        expect(res.status).toBe(403);
        expect(res.body).toEqual(FORBIDDEN);
      }
      expect(await db.marriage.count()).toBe(2);
    });

    it('không có Marriage → 404; spouseId sai → 404', async () => {
      const s = await setup();
      const res = await del(s.me.id, s.bac.id, s.admin.cookie);
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ message: 'Không tìm thấy quan hệ vợ chồng.' });
      const bad = await del(s.me.id, 'abc', s.admin.cookie);
      expect(bad.status).toBe(404);
      expect(bad.body).toEqual(NOT_FOUND);
    });
  });
});

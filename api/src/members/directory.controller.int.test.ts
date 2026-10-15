import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from '../../test/helpers/app.js';
import { createMember as make, loginAs } from '../../test/helpers/factories.js';
import { testDb as db } from '../../test/helpers/test-db.js';

const ROLES = [
  ['ADMIN', false],
  ['MEMBER', true],
  ['MEMBER', false],
] as const;

describe('GET /api/members/stats + /api/members/directory', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app.close());

  async function cookieFor(role: 'ADMIN' | 'MEMBER', linked: boolean) {
    const self = linked ? await make(db, { fullName: 'VŨ VĂN MÌNH' }) : null;
    return (await loginAs(db, { role, memberId: self?.id ?? null })).cookie;
  }

  it('chưa đăng nhập → 401 cả hai', async () => {
    expect((await http().get('/api/members/stats')).status).toBe(401);
    expect((await http().get('/api/members/directory')).status).toBe(401);
  });

  it('stats: DB trống → 0 người, không đời nào', async () => {
    const cookie = await cookieFor('ADMIN', false);
    const res = await http().get('/api/members/stats').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ memberCount: 0, generations: [] });
  });

  it.each(ROLES)(
    'stats: %s (liên kết: %s) → số người + các đời có người, tăng dần',
    async (role, linked) => {
      const cookie = await cookieFor(role, linked);
      await make(db, { generation: 3 });
      await make(db, { generation: 1 });
      await make(db, { generation: 3 });
      const res = await http().get('/api/members/stats').set('Cookie', cookie);
      expect(res.status).toBe(200);
      const base = linked ? 1 : 0; // người "VŨ VĂN MÌNH" đời 1
      expect(res.body).toEqual({ memberCount: 3 + base, generations: [1, 3] });
    },
  );

  it('directory: không q → mọi người (không cắt 20/50), xếp đời → tên → id', async () => {
    const cookie = await cookieFor('ADMIN', false);
    await db.member.createMany({
      data: Array.from({ length: 60 }, (_, i) => ({
        fullName: `VŨ VĂN ${String(i).padStart(2, '0')}`,
        searchName: `vu van ${String(i).padStart(2, '0')}`,
        generation: i < 30 ? 2 : 1,
      })),
    });
    const res = await http()
      .get('/api/members/directory')
      .set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(60);
    expect(res.body[0]).toMatchObject({ fullName: 'VŨ VĂN 30', generation: 1 });
    expect(res.body[30]).toMatchObject({
      fullName: 'VŨ VĂN 00',
      generation: 2,
    });
  });

  it.each(ROLES)(
    'directory: %s (liên kết: %s) — q khớp tên người, tên bố hoặc tên mẹ (không dấu)',
    async (role, linked) => {
      const cookie = await cookieFor(role, linked);
      const bo = await make(db, {
        fullName: 'VŨ VĂN BỐ',
        gender: 'MALE',
        generation: 1,
      });
      const me = await make(db, {
        fullName: 'NGUYỄN THỊ MẸ',
        gender: 'FEMALE',
        generation: 1,
      });
      const con = await make(db, {
        fullName: 'VŨ VĂN CON',
        generation: 2,
        fatherId: bo.id,
        motherId: me.id,
      });
      const khac = await make(db, { fullName: 'LÊ VĂN KHÁC', generation: 2 });
      const ids = async (qs: string) =>
        (
          await http().get(`/api/members/directory${qs}`).set('Cookie', cookie)
        ).body.map((r: { id: number }) => r.id);
      expect(await ids('?q=vu%20van%20bo')).toEqual([bo.id, con.id]);
      expect(await ids('?q=Nguy%E1%BB%85n%20th%E1%BB%8B%20m%E1%BA%B9')).toEqual(
        [me.id, con.id],
      ); // "Nguyễn thị mẹ"
      expect(await ids('?q=le%20van')).toEqual([khac.id]);
      const [row] = (
        await http()
          .get('/api/members/directory?q=vu%20van%20con')
          .set('Cookie', cookie)
      ).body;
      expect(row).toMatchObject({
        id: con.id,
        fatherName: 'VŨ VĂN BỐ',
        motherName: 'NGUYỄN THỊ MẸ',
      });
    },
  );

  it('directory: generation lọc, kết hợp với q', async () => {
    const cookie = await cookieFor('ADMIN', false);
    const bo = await make(db, {
      fullName: 'VŨ VĂN BỐ',
      gender: 'MALE',
      generation: 1,
    });
    const con = await make(db, {
      fullName: 'VŨ VĂN CON',
      generation: 2,
      fatherId: bo.id,
    });
    await make(db, { fullName: 'LÊ THỊ HAI', generation: 2 });
    const ids = async (qs: string) =>
      (
        await http().get(`/api/members/directory${qs}`).set('Cookie', cookie)
      ).body.map((r: { id: number }) => r.id);
    expect(await ids('?generation=1')).toEqual([bo.id]);
    expect(await ids('?q=vu%20van%20bo&generation=2')).toEqual([con.id]);
    expect(await ids('?q=&generation=')).toHaveLength(3); // rỗng = không lọc
  });

  it.each([
    'generation=abc',
    'generation=0',
    'generation=1&generation=2',
    `q=${'a'.repeat(101)}`,
    'q=a&q=b',
  ])('directory: tham số sai (%s) → 400', async (qs) => {
    const cookie = await cookieFor('ADMIN', false);
    const res = await http()
      .get(`/api/members/directory?${qs}`)
      .set('Cookie', cookie);
    expect(res.status).toBe(400);
    expect(res.body.errors).toEqual({
      query: 'Tham số tìm kiếm không hợp lệ.',
    });
  });

  it('route stats/directory không bị nuốt bởi /:id', async () => {
    const cookie = await cookieFor('ADMIN', false);
    expect(
      (await http().get('/api/members/stats').set('Cookie', cookie)).status,
    ).toBe(200);
    expect(
      (await http().get('/api/members/directory').set('Cookie', cookie)).status,
    ).toBe(200);
  });
});

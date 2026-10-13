import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from '../../test/helpers/app.js';
import {
  createMember as make,
  loginAs,
  marry,
} from '../../test/helpers/factories.js';
import { testDb as db } from '../../test/helpers/test-db.js';

describe('GET /api/tree', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app.close());

  it('chưa đăng nhập → 401', async () => {
    expect((await http().get('/api/tree')).status).toBe(401);
  });

  it('DB trống → { families: [], roots: [] }', async () => {
    const { cookie } = await loginAs(db, { role: 'ADMIN' });
    const res = await http().get('/api/tree').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ families: [], roots: [] });
  });

  it.each([
    ['ADMIN', 'admin'],
    ['MEMBER', 'member liên kết'],
    ['MEMBER', 'chưa liên kết'],
  ] as const)(
    '%s (%s) xem được cây; dữ liệu đúng từ DB',
    async (role, kind) => {
      const ong = await make(db, {
        fullName: 'VŨ VĂN ÔNG',
        generation: 1,
        gender: 'MALE',
      });
      const ba = await make(db, {
        fullName: 'NGUYỄN THỊ BÀ',
        generation: 1,
        gender: 'FEMALE',
      });
      await marry(db, ong.id, ba.id);
      const con = await make(db, {
        fullName: 'VŨ VĂN CON',
        generation: 2,
        gender: 'MALE',
        fatherId: ong.id,
        motherId: ba.id,
        birthYear: 1950,
      });
      const gai = await make(db, {
        fullName: 'VŨ THỊ GÁI',
        generation: 2,
        gender: 'FEMALE',
        fatherId: ong.id,
      });
      const re = await make(db, {
        fullName: 'LÊ VĂN RỂ',
        generation: 2,
        gender: 'MALE',
      });
      await marry(db, gai.id, re.id);
      await make(db, {
        fullName: 'LÊ VĂN NGOẠI',
        generation: 3,
        gender: 'MALE',
        fatherId: re.id,
        motherId: gai.id,
      });
      const { cookie } = await loginAs(db, {
        role,
        memberId: kind === 'member liên kết' ? con.id : null,
      });

      const res = await http().get('/api/tree').set('Cookie', cookie);
      expect(res.status).toBe(200);
      expect(res.body.roots).toEqual([ong.id]);
      const byId = new Map(
        res.body.families.map((f: { id: number }) => [f.id, f]),
      );
      expect(
        [...byId.keys()].sort((a, b) => (a as number) - (b as number)),
      ).toEqual([ong.id, con.id, gai.id].sort((a, b) => a - b));
      expect(byId.get(ong.id)).toMatchObject({
        generation: 1,
        person: {
          fullName: 'VŨ VĂN ÔNG',
          searchName: 'vu van ong',
          fatherName: null,
        },
        spouses: [{ id: ba.id, fullName: 'NGUYỄN THỊ BÀ' }],
      });
      expect((byId.get(ong.id) as { childIds: number[] }).childIds).toContain(
        con.id,
      );
      expect(byId.get(con.id)).toMatchObject({
        person: { fatherName: 'VŨ VĂN ÔNG', birthYear: 1950 },
      });
      expect(byId.get(gai.id)).toMatchObject({
        spouses: [{ id: re.id }],
        childIds: [],
      });
      expect(JSON.stringify(res.body)).not.toContain('LÊ VĂN NGOẠI');
    },
  );
});

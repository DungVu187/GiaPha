import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from 'vitest';
import { createTestApp } from '../../test/helpers/app.js';
import { createMember as make, loginAs } from '../../test/helpers/factories.js';
import { testDb as db } from '../../test/helpers/test-db.js';

// 10:00 ngày 03/10/2026 giờ Việt Nam = 23/8/2026 âm (Bính Ngọ).
const NOW = new Date('2026-10-03T03:00:00Z');

describe('GET /api/anniversaries', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app.close());
  afterEach(() => {
    vi.useRealTimers();
  });

  const freeze = () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(NOW);
  };

  it('chưa đăng nhập → 401', async () => {
    expect((await http().get('/api/anniversaries')).status).toBe(401);
  });

  it.each([
    ['ADMIN', false],
    ['MEMBER', true],
    ['MEMBER', false],
  ] as const)(
    '%s (liên kết: %s): hôm nay âm/dương + danh sách giỗ sắp tới',
    async (role, linked) => {
      freeze();
      const self = linked ? await make(db, { fullName: 'VŨ VĂN MÌNH' }) : null;
      const { cookie } = await loginAs(db, {
        role,
        memberId: self?.id ?? null,
      });
      const dead = (
        fullName: string,
        d: number,
        m: number,
        calendar: 'SOLAR' | 'LUNAR',
        generation = 1,
      ) =>
        make(db, {
          fullName,
          generation,
          isDeceased: true,
          anniversaryDay: d,
          anniversaryMonth: m,
          anniversaryCalendar: calendar,
        });
      const hoa = await dead('NGUYỄN THỊ HOA', 25, 8, 'LUNAR', 3);
      const man = await dead('VŨ THỊ MẬN', 26, 10, 'SOLAR', 2);
      const khiem = await dead('VŨ VĂN KHIÊM', 23, 8, 'LUNAR', 4);
      await make(db, {
        fullName: 'VŨ VĂN SỐNG',
        anniversaryDay: 1,
        anniversaryMonth: 1,
        anniversaryCalendar: 'LUNAR',
      });
      await make(db, { fullName: 'VŨ VĂN THIẾU', isDeceased: true });

      const res = await http().get('/api/anniversaries').set('Cookie', cookie);
      expect(res.status).toBe(200);
      expect(res.body.today).toEqual({
        solar: { year: 2026, month: 10, day: 3 },
        lunar: { year: 2026, month: 8, day: 23, leap: false },
        lunarYearName: 'Bính Ngọ',
      });
      expect(res.body.items).toEqual([
        {
          id: khiem.id,
          fullName: 'VŨ VĂN KHIÊM',
          generation: 4,
          avatarPath: null,
          day: 23,
          month: 8,
          calendar: 'LUNAR',
          date: { year: 2026, month: 10, day: 3 },
          daysLeft: 0,
        },
        expect.objectContaining({
          id: hoa.id,
          daysLeft: 2,
          date: { year: 2026, month: 10, day: 5 },
        }),
        expect.objectContaining({
          id: man.id,
          daysLeft: 23,
          calendar: 'SOLAR',
        }),
      ]);
    },
  );

  it('không ai có ngày giỗ → items rỗng', async () => {
    freeze();
    const { cookie } = await loginAs(db, { role: 'ADMIN' });
    const res = await http().get('/api/anniversaries').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });
});

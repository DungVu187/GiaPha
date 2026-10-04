import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createTestApp } from '../../test/helpers/app.js';
import { loginAs } from '../../test/helpers/factories.js';
import { testDb as db } from '../../test/helpers/test-db.js';

const URL = '/api/calendar/anniversary-suggestion';

describe('calendar API', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(() => app.close());

  async function get(qs: string) {
    const u = await loginAs(db);
    return http().get(`${URL}?${qs}`).set('Cookie', u.cookie);
  }

  it('gợi ý giỗ từ ngày mất dương lịch đủ ngày', async () => {
    const res = await get('calendar=SOLAR&year=2026&month=9&day=25');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      suggestion: { day: 15, month: 8, calendar: 'LUNAR' },
    });
  });

  it('ngày không đầy đủ → suggestion null', async () => {
    for (const qs of [
      'calendar=SOLAR&year=1998',
      'calendar=SOLAR&year=1998&month=3',
      'calendar=SOLAR',
      'calendar=LUNAR&year=1998',
    ]) {
      const res = await get(qs);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ suggestion: null });
    }
  });

  it('âm lịch có ngày tháng → lấy luôn', async () => {
    const res = await get('calendar=LUNAR&year=1985&month=11&day=5');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      suggestion: { day: 5, month: 11, calendar: 'LUNAR' },
    });
  });

  it.each([
    'year=1998',
    'calendar=GREGORIAN&year=1998',
    'calendar=SOLAR&calendar=LUNAR',
  ])('thiếu/sai calendar ?%s → 400 errors.calendar', async (qs) => {
    const res = await get(qs);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      message: 'Dữ liệu không hợp lệ.',
      errors: { calendar: 'Chọn lịch cho ngày mất.' },
    });
  });

  it.each([
    ['calendar=SOLAR&year=1998&month=2&day=30', 'Ngày không hợp lệ.'],
    ['calendar=SOLAR&year=abc', 'Ngày tháng phải là số nguyên.'],
    ['calendar=SOLAR&year=1998&year=1999', 'Ngày tháng phải là số nguyên.'],
    ['calendar=SOLAR&year=1998&day=3', 'Có ngày thì phải có tháng.'],
    ['calendar=SOLAR&year=9999', 'Ngày không được ở tương lai.'],
    [
      'calendar=LUNAR&year=1998&month=1&day=31',
      'Ngày âm lịch chỉ từ 1 đến 30.',
    ],
    ['calendar=SOLAR&year=0', 'Năm không hợp lệ.'],
  ])('ngày sai ?%s → 400 errors.date', async (qs, message) => {
    const res = await get(qs);
    expect(res.status).toBe(400);
    expect(res.body).toEqual({
      message: 'Dữ liệu không hợp lệ.',
      errors: { date: message },
    });
  });

  it('chưa đăng nhập → 401', async () => {
    const res = await http().get(
      `${URL}?calendar=SOLAR&year=2026&month=9&day=25`,
    );
    expect(res.status).toBe(401);
  });
});

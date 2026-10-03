import { describe, expect, it } from 'vitest';
import { checkHealth } from './health.js';

describe('checkHealth', () => {
  it('probe thành công → 200 ok kèm version và latency', async () => {
    const result = await checkHealth(async () => 1, 'abc123');
    expect(result.httpStatus).toBe(200);
    expect(result.body.status).toBe('ok');
    expect(result.body.version).toBe('abc123');
    expect(result.body.db?.latencyMs).toBeGreaterThanOrEqual(0);
  });

  it('probe lỗi → 503 error, không lộ chi tiết lỗi', async () => {
    const result = await checkHealth(async () => {
      throw new Error('password authentication failed for user giapha');
    }, 'abc123');
    expect(result.httpStatus).toBe(503);
    expect(result.body).toEqual({ status: 'error', version: 'abc123' });
    expect(JSON.stringify(result.body)).not.toContain('password');
  });
});

import { describe, expect, it } from 'vitest';
import { formatLog } from './logger.js';

const NOW = new Date('2026-10-03T08:00:00.000Z');

describe('formatLog', () => {
  it('trả về JSON một dòng có time, level, event', () => {
    const line = formatLog('info', 'login_succeeded', { userId: 1 }, NOW);
    expect(line).not.toContain('\n');
    expect(JSON.parse(line)).toEqual({
      time: '2026-10-03T08:00:00.000Z',
      level: 'info',
      event: 'login_succeeded',
      userId: 1,
    });
  });

  it('không có data vẫn hợp lệ', () => {
    expect(JSON.parse(formatLog('warn', 'x', undefined, NOW))).toEqual({
      time: '2026-10-03T08:00:00.000Z',
      level: 'warn',
      event: 'x',
    });
  });

  it('data không ghi đè được time/level/event', () => {
    const parsed = JSON.parse(
      formatLog(
        'error',
        'real',
        { level: 'info', event: 'fake', time: 't' },
        NOW,
      ),
    );
    expect(parsed.level).toBe('error');
    expect(parsed.event).toBe('real');
    expect(parsed.time).toBe('2026-10-03T08:00:00.000Z');
  });
});

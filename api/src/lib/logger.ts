export type LogLevel = 'info' | 'warn' | 'error';

export function formatLog(
  level: LogLevel,
  event: string,
  data: Record<string, unknown> = {},
  now: Date = new Date(),
): string {
  const base = { time: now.toISOString(), level, event };
  try {
    return JSON.stringify({ ...data, ...base });
  } catch {
    // vòng tham chiếu, BigInt…: log vẫn phải ra, không được làm hỏng request.
    return JSON.stringify({ ...base, dataError: true });
  }
}

// Log JSON một dòng ra stdout/stderr; PM2 gom log trên VPS.
export function log(
  level: LogLevel,
  event: string,
  data?: Record<string, unknown>,
): void {
  const line = formatLog(level, event, data);
  if (level === 'error') console.error(line);
  else console.log(line);
}

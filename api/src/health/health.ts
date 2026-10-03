import { log } from '../lib/logger.js';

export type HealthResult = {
  httpStatus: 200 | 503;
  body: { status: 'ok' | 'error'; version: string; db?: { latencyMs: number } };
};

export async function checkHealth(
  probe: () => Promise<unknown>,
  version: string,
): Promise<HealthResult> {
  const started = performance.now();
  try {
    await probe();
    return {
      httpStatus: 200,
      body: {
        status: 'ok',
        version,
        db: { latencyMs: Math.round(performance.now() - started) },
      },
    };
  } catch (error) {
    log('error', 'health_check_failed', { error: String(error) });
    return { httpStatus: 503, body: { status: 'error', version } };
  }
}

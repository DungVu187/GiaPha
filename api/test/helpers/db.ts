import type { Db } from '../../src/prisma/db.js';

export function assertTestDatabaseUrl(url: string | undefined): string {
  if (!url || !/test/i.test(new URL(url).pathname)) {
    throw new Error(
      "DATABASE_URL/TEST_DATABASE_URL phải trỏ tới DB test (tên DB chứa 'test')",
    );
  }
  return url;
}

export async function resetDb(db: Db): Promise<void> {
  const rows = await db.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  if (rows.length === 0) return;
  const tables = rows.map((r) => `"${r.tablename}"`).join(', ');
  await db.$executeRawUnsafe(`TRUNCATE ${tables} RESTART IDENTITY CASCADE`);
}

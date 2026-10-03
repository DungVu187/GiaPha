import 'dotenv/config'; // không ghi đè DATABASE_URL/ADMIN_* do Playwright truyền vào
import { execSync } from 'node:child_process';
import { seedAdmin } from '../src/auth/seed-admin.js';
import { createDb } from '../src/prisma/db.js';
import { assertTestDatabaseUrl, resetDb } from '../test/helpers/db.js';

async function main() {
  const url = assertTestDatabaseUrl(process.env.DATABASE_URL);
  const { ADMIN_USERNAME, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
    throw new Error('Thiếu ADMIN_USERNAME hoặc ADMIN_PASSWORD');
  }
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });
  const db = createDb(url);
  try {
    await resetDb(db);
    await seedAdmin(db, ADMIN_USERNAME, ADMIN_PASSWORD);
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

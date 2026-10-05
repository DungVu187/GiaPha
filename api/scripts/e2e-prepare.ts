import 'dotenv/config'; // không ghi đè DATABASE_URL/ADMIN_* do Playwright truyền vào
import { execSync } from 'node:child_process';
import { hashPassword } from '../src/auth/password.js';
import { seedAdmin } from '../src/auth/seed-admin.js';
import { normalizeFullName, toSearchName } from '../src/lib/name.js';
import { createDb } from '../src/prisma/db.js';
import { assertTestDatabaseUrl, resetDb } from '../test/helpers/db.js';

async function main() {
  const url = assertTestDatabaseUrl(process.env.DATABASE_URL);
  const { ADMIN_USERNAME, ADMIN_PASSWORD } = process.env;
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) {
    throw new Error('Thiếu ADMIN_USERNAME hoặc ADMIN_PASSWORD');
  }
  const {
    E2E_MEMBER_USERNAME,
    E2E_MEMBER_PASSWORD,
    E2E_VIEWER_USERNAME,
    E2E_VIEWER_PASSWORD,
  } = process.env;
  if (
    !E2E_MEMBER_USERNAME ||
    !E2E_MEMBER_PASSWORD ||
    !E2E_VIEWER_USERNAME ||
    !E2E_VIEWER_PASSWORD
  ) {
    throw new Error('Thiếu E2E_MEMBER_* hoặc E2E_VIEWER_*');
  }
  execSync('npx prisma migrate deploy', { stdio: 'inherit' });
  const db = createDb(url);
  try {
    await resetDb(db);
    await seedAdmin(db, ADMIN_USERNAME, ADMIN_PASSWORD);

    const make = (name: string, generation: number, fatherId?: number) => {
      const fullName = normalizeFullName(name);
      return db.member.create({
        data: {
          fullName,
          searchName: toSearchName(fullName),
          generation,
          gender: 'MALE',
          fatherId,
        },
      });
    };
    const ong = await make('Vũ Văn Ông', 1);
    const bo = await make('Vũ Văn Bố', 2, ong.id);
    const toi = await make('Vũ Văn Tôi', 3, bo.id);
    await make('Vũ Văn Bác', 2, ong.id);
    await db.user.create({
      data: {
        username: E2E_MEMBER_USERNAME,
        passwordHash: await hashPassword(E2E_MEMBER_PASSWORD),
        memberId: toi.id,
      },
    });
    await db.user.create({
      data: {
        username: E2E_VIEWER_USERNAME,
        passwordHash: await hashPassword(E2E_VIEWER_PASSWORD),
      },
    });
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

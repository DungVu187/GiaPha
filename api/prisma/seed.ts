import 'dotenv/config';
import { seedAdmin } from '../src/auth/seed-admin.js';
import { createDb } from '../src/prisma/db.js';

async function main() {
  const username = process.env.ADMIN_USERNAME;
  const password = process.env.ADMIN_PASSWORD;
  if (!username || !password)
    throw new Error('Thiếu ADMIN_USERNAME hoặc ADMIN_PASSWORD');
  const db = createDb();
  try {
    const { created, user } = await seedAdmin(db, username, password);
    console.log(
      created
        ? `Đã tạo admin "${user.username}"`
        : `Admin "${user.username}" đã tồn tại, bỏ qua`,
    );
  } finally {
    await db.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

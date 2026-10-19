import 'dotenv/config'; // không ghi đè DATABASE_URL/ADMIN_* do Playwright truyền vào
import { execSync } from 'node:child_process';
import { hashPassword } from '../src/auth/password.js';
import { seedAdmin } from '../src/auth/seed-admin.js';
import { todayInVietnam } from '../src/lib/anniversary.js';
import { jdFromDate, jdToDate, solarToLunar } from '../src/lib/lunar.js';
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
    const bac = await make('Vũ Văn Bác', 2, ong.id);

    // Dữ liệu cho e2e lịch giỗ: ngày tính theo hôm nay (giờ VN) để chạy ngày nào cũng đúng.
    const today = todayInVietnam();
    const plus = (n: number) =>
      jdToDate(jdFromDate(today.day, today.month, today.year) + n);
    const deceased = (
      name: string,
      a: { day: number; month: number; calendar: 'SOLAR' | 'LUNAR' },
    ) => {
      const fullName = normalizeFullName(name);
      return db.member.create({
        data: {
          fullName,
          searchName: toSearchName(fullName),
          generation: 3,
          gender: 'MALE',
          fatherId: bac.id,
          isDeceased: true,
          anniversaryDay: a.day,
          anniversaryMonth: a.month,
          anniversaryCalendar: a.calendar,
        },
      });
    };
    for (const [name, n] of [
      ['Vũ Văn Giỗ Nay', 0],
      ['Vũ Văn Giỗ Gần', 5],
      ['Vũ Văn Giỗ Xa', 40],
    ] as const) {
      const d = plus(n);
      await deceased(name, { day: d.day, month: d.month, calendar: 'SOLAR' });
    }
    const l = solarToLunar(plus(10));
    await deceased('Vũ Văn Giỗ Âm', {
      day: l.day,
      month: l.month,
      calendar: 'LUNAR',
    });

    // Dữ liệu cho e2e cây: con gái có chồng ngoài họ và cháu ngoại (không vẽ trên cây).
    const gaiName = normalizeFullName('Vũ Thị Gái');
    const gai = await db.member.create({
      data: {
        fullName: gaiName,
        searchName: toSearchName(gaiName),
        generation: 2,
        gender: 'FEMALE',
        fatherId: ong.id,
      },
    });
    const reName = normalizeFullName('Lê Văn Rể');
    const re = await db.member.create({
      data: {
        fullName: reName,
        searchName: toSearchName(reName),
        generation: 2,
        gender: 'MALE',
      },
    });
    await db.marriage.create({
      data: {
        person1Id: Math.min(gai.id, re.id),
        person2Id: Math.max(gai.id, re.id),
      },
    });
    const ngoaiName = normalizeFullName('Lê Văn Ngoại');
    await db.member.create({
      data: {
        fullName: ngoaiName,
        searchName: toSearchName(ngoaiName),
        generation: 3,
        gender: 'MALE',
        fatherId: re.id,
        motherId: gai.id,
      },
    });

    // Dữ liệu cho e2e đăng ký: hai hồ sơ cùng tên + đời (có bố mẹ / chỉ có bố).
    const thinh = await make('Vũ Đức Thịnh', 4);
    const lanName = normalizeFullName('Trần Thị Lan');
    const lan = await db.member.create({
      data: {
        fullName: lanName,
        searchName: toSearchName(lanName),
        generation: 4,
        gender: 'FEMALE',
      },
    });
    await db.marriage.create({
      data: {
        person1Id: Math.min(thinh.id, lan.id),
        person2Id: Math.max(thinh.id, lan.id),
      },
    });
    const dungName = normalizeFullName('Vũ Đức Dũng');
    await db.member.create({
      data: {
        fullName: dungName,
        searchName: toSearchName(dungName),
        generation: 5,
        gender: 'MALE',
        fatherId: thinh.id,
        motherId: lan.id,
        birthYear: 2003,
        birthMonth: 7,
        birthDay: 18,
      },
    });
    const binh = await make('Vũ Văn Bình', 4);
    await db.member.create({
      data: {
        fullName: dungName,
        searchName: toSearchName(dungName),
        generation: 5,
        gender: 'MALE',
        fatherId: binh.id,
        birthYear: 1998,
      },
    });
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

    // Tài khoản riêng cho e2e GĐ6 (đổi mật khẩu/email, quản trị, quên mật khẩu) — không đụng tài khoản dùng chung.
    const extra = JSON.parse(process.env.E2E_EXTRA_USERS ?? '[]') as {
      username: string;
      password: string;
      email?: string | null;
      member: string | null;
    }[];
    for (const u of extra) {
      let memberId: number | null = null;
      if (u.member) {
        const fullName = normalizeFullName(u.member);
        memberId = (
          await db.member.create({
            data: {
              fullName,
              searchName: toSearchName(fullName),
              generation: 3,
              gender: 'MALE',
              fatherId: bac.id,
            },
          })
        ).id;
      }
      await db.user.create({
        data: {
          username: u.username,
          passwordHash: await hashPassword(u.password),
          email: u.email ?? null,
          memberId,
          claimedAt: memberId ? new Date() : null,
        },
      });
    }
  } finally {
    await db.$disconnect();
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

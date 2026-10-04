import { PrismaPg } from '@prisma/adapter-pg';
import { type Prisma, PrismaClient } from '../generated/prisma/client.js';

export type Db = PrismaClient;
// Client thường hoặc client trong transaction — hàm nghiệp vụ nhận kiểu này.
export type DbClient = Db | Prisma.TransactionClient;

export function databaseUrl(
  url: string | undefined = process.env.DATABASE_URL,
): string {
  if (!url) throw new Error('DATABASE_URL chưa được cấu hình');
  return url;
}

// Cho script và test; trong app dùng PrismaService.
export function createDb(url?: string): Db {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl(url) }),
  });
}

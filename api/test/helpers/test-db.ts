import { createDb } from '../../src/prisma/db.js';
import { assertTestDatabaseUrl } from './db.js';

export const testDb = createDb(assertTestDatabaseUrl(process.env.DATABASE_URL));

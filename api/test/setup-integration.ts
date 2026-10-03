import { afterAll, beforeEach } from 'vitest';
import { resetDb } from './helpers/db.js';
import { testDb } from './helpers/test-db.js';

beforeEach(() => resetDb(testDb));
afterAll(() => testDb.$disconnect());

import { execSync } from 'node:child_process';
import { assertTestDatabaseUrl } from './helpers/db.js';

export default function setup() {
  const url = assertTestDatabaseUrl(process.env.TEST_DATABASE_URL);
  execSync('npx prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: url },
  });
}

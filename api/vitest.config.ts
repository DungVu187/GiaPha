import 'dotenv/config';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          exclude: ['src/**/*.int.test.ts'],
        },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          environment: 'node',
          include: ['src/**/*.int.test.ts'],
          globalSetup: ['./test/global-setup.ts'],
          setupFiles: ['./test/setup-integration.ts'],
          fileParallelism: false,
          env: { DATABASE_URL: process.env.TEST_DATABASE_URL ?? '' },
        },
      },
    ],
  },
});

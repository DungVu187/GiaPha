import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module.js';
import { configureApp } from './configure-app.js';
import { uploadsDir } from './members/avatar.js';

async function bootstrap() {
  const app = configureApp(
    await NestFactory.create<NestExpressApplication>(AppModule, {
      bodyParser: false,
    }),
  );
  // Dev/e2e: API tự phục vụ ảnh; production do Nginx phục vụ thư mục uploads (GĐ7).
  if (process.env.NODE_ENV !== 'production')
    app.useStaticAssets(uploadsDir(), { prefix: '/uploads/' });
  await app.listen(process.env.PORT ?? 4000);
}
await bootstrap();

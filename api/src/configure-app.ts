import type { NestExpressApplication } from '@nestjs/platform-express';

// Ứng dụng phải được tạo với `{ bodyParser: false }`: chỉ nhận JSON, không nhận
// form-urlencoded, để form HTML từ site khác không POST được (chống login/logout CSRF).
export function configureApp(
  app: NestExpressApplication,
): NestExpressApplication {
  app.setGlobalPrefix('api');
  app.useBodyParser('json');
  return app;
}

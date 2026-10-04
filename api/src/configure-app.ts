import type { NextFunction, Request, Response } from 'express';
import type { NestExpressApplication } from '@nestjs/platform-express';

// Ứng dụng phải được tạo với `{ bodyParser: false }`: chỉ nhận JSON, không nhận
// form-urlencoded, để form HTML từ site khác không POST được (chống login/logout CSRF).
export function configureApp(
  app: NestExpressApplication,
): NestExpressApplication {
  app.setGlobalPrefix('api');
  app.useBodyParser('json');
  // Lỗi của body-parser xảy ra trước khi vào Nest → trả thông báo tiếng Việt thay vì mặc định tiếng Anh.
  app.use(
    (
      err: { type?: string },
      _req: Request,
      res: Response,
      next: NextFunction,
    ) => {
      if (err?.type === 'entity.parse.failed')
        return res
          .status(400)
          .json({ message: 'Dữ liệu gửi lên không hợp lệ.' });
      if (err?.type === 'entity.too.large')
        return res.status(413).json({ message: 'Dữ liệu gửi lên quá lớn.' });
      next(err);
    },
  );
  return app;
}

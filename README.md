# Gia Phả họ Vũ

Website gia phả cho dòng họ Vũ: quản lý thành viên theo đời, quan hệ bố/mẹ/vợ chồng/con, ngày mất và ngày giỗ (âm/dương lịch), phân quyền theo tài khoản.

## Tính năng

Đã có:

- Đăng nhập bằng session (cookie httpOnly, lưu DB), tài khoản admin tạo từ seed.
- Thêm / sửa / xóa thành viên; ngày tháng không đầy đủ (chỉ năm, tháng + năm, hoặc đủ).
- Quan hệ bố, mẹ, vợ/chồng (nhiều cuộc hôn nhân), con; đời tự tính từ bố/mẹ và tự cập nhật xuống con cháu.
- Còn sống / đã khuất, ngày mất, nơi an táng; ngày giỗ âm hoặc dương lịch, tự gợi ý từ ngày mất. Lịch âm theo thuật toán Hồ Ngọc Đức (múi giờ +7).
- Phân quyền: Admin toàn quyền; thành viên đã liên kết tài khoản sửa được bản thân và người thân trực tiếp; tài khoản chưa liên kết chỉ xem.
- Ảnh đại diện (JPEG/PNG/WebP, tối đa 5 MB, lưu trên ổ đĩa).
- Tìm thành viên theo tên, gõ không dấu được.
- Tự đăng ký tài khoản; nếu gia phả đã có người trùng họ tên + đời chưa có tài khoản thì chọn "Đây là tôi" để nhận hồ sơ, hoặc tạo hồ sơ mới.
- Cây gia phả tự dựng theo đời: phóng to/thu nhỏ, kéo, thu gọn/mở nhánh, tìm người trên cây, bấm thẻ xem chi tiết; chỉ vẽ người trong dòng (theo dòng cha) và vợ/chồng.
- Danh sách thành viên nhóm theo đời: lọc theo đời, một ô tìm khớp tên người hoặc tên bố/mẹ (gõ không dấu được).
- Lịch giỗ: 30 ngày tới / 12 tháng tới, nhóm theo tháng, "Còn N ngày", hôm nay kèm ngày âm lịch và năm can chi.
- Trang chủ: lời chào theo hồ sơ, giỗ 30 ngày tới, ô tìm, lối tắt.
- Cây gia phả dễ xem trên điện thoại: mở ở mức chữ đọc được, thu nhỏ thì thẻ chỉ còn tên, chế độ "dạng danh sách theo nhánh".
- Giao diện điện thoại có thanh tab đáy và menu ngăn kéo; tablet có header một hàng.

Đang làm: tài khoản của tôi, quên mật khẩu, trang quản trị, triển khai VPS.

## Công nghệ

| Phần | Công nghệ |
|---|---|
| `api/` | NestJS 12 (TypeScript, ESM), Prisma 7, PostgreSQL 18 |
| `web/` | Next.js 16 (App Router), React 19, Tailwind CSS 4, shadcn/ui, React Flow |
| Test | Vitest (unit + integration với Postgres thật), Playwright (e2e) |
| CI | GitHub Actions |

Frontend và backend là hai app riêng trong cùng repo. Trình duyệt chỉ gọi `/api/*` trên domain của web (dev: Next rewrites sang `localhost:4000`).

## Cấu trúc thư mục

```
GiaPha/
├── api/          # NestJS: API, nghiệp vụ, Prisma, auth
│   ├── prisma/   # schema, migrations, seed
│   ├── scripts/  # tạo DB local, chuẩn bị DB e2e
│   ├── test/     # hạ tầng integration test
│   └── src/      # lib/ (logic thuần), auth/, members/, prisma/, …
└── web/          # Next.js: chỉ giao diện
    ├── e2e/      # Playwright
    └── src/      # app/, components/, lib/
```

## Cài đặt (máy dev)

Yêu cầu: Node.js 24, PostgreSQL 18 cài sẵn trên máy.

1. Tạo role và database (`giapha`, `giapha_test`) bằng superuser `postgres`:

   ```bash
   psql -U postgres -h localhost -f api/scripts/create-local-db.sql
   ```

   Trên Windows, `psql` thường nằm ở `C:\Program Files\PostgreSQL\18\bin\psql.exe`.

2. API:

   ```bash
   cd api
   cp .env.example .env   # điền DATABASE_URL, ADMIN_USERNAME, ADMIN_PASSWORD…
   npm install
   npm run db:migrate
   npm run db:seed
   ```

3. Web:

   ```bash
   cd web
   cp .env.example .env
   npm install
   ```

## Chạy

```bash
cd api && npm run start:dev   # API: http://localhost:4000/api
cd web && npm run dev         # Web: http://localhost:3000
```

Ảnh tải lên lưu ở `api/uploads/` (đổi bằng `UPLOADS_DIR`). Khi dev, API phục vụ `/uploads`; khi chạy thật, Nginx phục vụ.

## Kiểm tra code và test

| Thư mục | Lệnh | Việc |
|---|---|---|
| `api/` | `npm run format && npm run lint && npm run typecheck` | format, lint (oxlint), typecheck |
| `web/` | `npm run lint && npm run typecheck` | lint, typecheck |
| `api/`, `web/` | `npm run test:unit` | unit test |
| `api/` | `npm run test:int` | integration test trên DB `giapha_test` |
| `web/` | `npm --prefix ../api run build && npm run build && npm run test:e2e` | e2e Playwright (tắt dev server trước; Playwright tự chạy api + web trên DB `giapha_test`) |

## Dành cho người đóng góp

Quy ước code, quy tắc nghiệp vụ và quy trình làm việc nằm ở [AGENTS.md](AGENTS.md). Không commit file `.env` hay secret; biến môi trường mẫu để ở `.env.example`.

# AGENTS.md — Gia Phả họ Vũ

Hướng dẫn chung cho mọi AI agent (Claude, Codex, Cursor, …) làm việc trong repo này. Đọc hết file này trước khi làm bất cứ việc gì.

## Dự án là gì

Website gia phả cho dòng họ Vũ: đăng ký/đăng nhập, liên kết tài khoản với thành viên có sẵn, quản lý thành viên theo đời, quan hệ bố/mẹ/vợ chồng/con, tự sinh cây gia phả, còn sống/đã khuất, ngày mất, ngày giỗ (âm/dương lịch).

## Nguồn sự thật (đọc theo thứ tự ưu tiên)

1. `docs/superpowers/specs/2026-10-03-gia-pha-design.md` — **spec đã chốt**. Ghi đè tài liệu gốc ở những điểm nó nêu.
2. `yeu-cau-he-thong-gia-pha.md` — tài liệu yêu cầu gốc (nghiệp vụ, giao diện, ví dụ hiển thị).
3. `docs/superpowers/plans/` — plan triển khai từng giai đoạn (nếu có).

**Các file `.md` trên chỉ lưu trên máy người dùng, KHÔNG có trên GitHub** (`.gitignore` chặn mọi `*.md` trừ `AGENTS.md`, `CLAUDE.md`). Clone repo về mà không thấy spec → hỏi người dùng, đừng đoán. Không bao giờ commit/push file `.md` nào khác hai file này.

Mâu thuẫn giữa code và spec → dừng lại hỏi người dùng, không tự chọn.
Muốn đổi một quyết định đã chốt (bảng D1–D16 trong spec) → hỏi người dùng trước.

## Trạng thái hiện tại

- GĐ1 xong. Bước tiếp theo: plan GĐ2.
- Cập nhật mục này khi xong mỗi giai đoạn.

| GĐ | Nội dung | Trạng thái |
|---|---|---|
| 1 | Khung NestJS (`api/`) + Next.js (`web/`), Postgres, Prisma, seed admin, đăng nhập session, `/api/health`, CI | Xong |
| 2 | CRUD thành viên, quan hệ, đời, ngày giỗ + lịch âm, phân quyền, ảnh | Chưa làm |
| 3 | Đăng ký + phát hiện trùng + "Đây là tôi" | Chưa làm |
| 4 | Cây gia phả (React Flow) | Chưa làm |
| 5 | Danh sách theo đời, tìm kiếm, lịch giỗ, dashboard | Chưa làm |
| 6 | Tài khoản, quên mật khẩu, trang quản trị | Chưa làm |
| 7 | Deploy VPS (Nginx, PM2, SSL, backup), CD, monitor, UptimeRobot | Chưa làm |

## Stack

- **Tách riêng frontend và backend**, hai app độc lập trong cùng repo:
  - `api/` — **NestJS** + TypeScript: toàn bộ API, nghiệp vụ, Prisma, auth. Mọi route có tiền tố `/api`.
  - `web/` — **Next.js (App Router)** + TypeScript: **chỉ giao diện**. Không Prisma, không server actions ghi dữ liệu; mọi dữ liệu lấy qua API.
- Cùng origin: trình duyệt chỉ gọi `/api/*` trên domain của web (dev: Next rewrites → `localhost:4000`; prod: Nginx → NestJS). Không CORS.
- Tailwind CSS + shadcn/ui (web).
- Prisma + PostgreSQL **cài native** (không Docker). Dev: Postgres 18 trên Windows.
- Auth: session lưu DB + cookie httpOnly do API đặt. **Không dùng JWT.**
- Cây: React Flow + dagre.
- Ảnh: lưu ổ đĩa (`uploads/`), Nginx phục vụ. Không dùng Cloudinary/S3.
- Test: Vitest (unit + integration với Postgres thật), Playwright (e2e).
- Deploy VPS: **Nginx + PM2** (không Docker, để nhẹ VPS; Docker xem xét sau). CI: GitHub Actions.
- Monitor: UptimeRobot ping `/api/health`. **Không tự viết trang monitor.** API log JSON ra stdout. Công cụ xem tài nguyên/log trên VPS chốt lại ở GĐ7.

## Cấu trúc thư mục

```
GiaPha/
├── api/                 # NestJS
│   ├── prisma/          # schema, migrations, seed
│   ├── scripts/         # script tiện ích (tạo DB local, chuẩn bị DB e2e)
│   ├── test/            # hạ tầng integration test
│   └── src/
│       ├── lib/         # logic thuần, có unit test
│       ├── prisma/      # PrismaService, createDb
│       └── <module>/    # auth/, health/, members/… (controller + logic + test)
├── web/                 # Next.js (UI)
│   ├── e2e/             # Playwright (chạy cả api + web)
│   └── src/
│       ├── app/         # routes
│       ├── lib/         # helper gọi API, logic UI thuần, có test
│       └── components/
└── docs/superpowers/    # specs/ và plans/ (local, không push)
```

## Quy tắc nghiệp vụ không được làm sai

Chi tiết đầy đủ ở spec mục 3–6. Những điểm hay bị làm sai:

- `username` UNIQUE; `full_name` **không** UNIQUE (người trùng tên là bình thường).
- Họ tên luôn chuẩn hóa: trim, gộp khoảng trắng, IN HOA. Làm ở cả client và server; server là nguồn tin cậy.
- Tài khoản (`User`) và thành viên (`Member`) là hai bảng tách rời. `User.member_id` UNIQUE, nullable.
- Quan hệ con cái lưu bằng `father_id` / `mother_id` trên bản ghi người con. **Không** lưu mảng `children`.
- Vợ/chồng lưu ở bảng `Marriage` riêng (cho phép nhiều cuộc hôn nhân).
- Đời tự tính từ bố/mẹ (+1); vợ/chồng ngoài họ lấy đời của người trong họ. Đổi đời → cập nhật cả con cháu.
- Ngày tháng có thể không đầy đủ (chỉ năm / tháng+năm / đủ) → lưu năm, tháng, ngày thành các cột int riêng.
- Ngày mất và ngày giỗ là hai trường riêng. Lịch âm dùng thuật toán Hồ Ngọc Đức, múi giờ +7 (không dùng thư viện lịch Trung Quốc).
- Hiển thị: người còn sống **không** hiện chữ "Còn sống"; người đã khuất hiện "ĐÃ KHUẤT", ngày mất, ngày giỗ, nơi an táng.
- Cây chỉ vẽ người trong dòng (theo dòng cha) + vợ/chồng; không vẽ con của con gái.
- Mọi thao tác ghi phải kiểm tra quyền ở server (Admin / Member đã liên kết / chưa liên kết — xem spec mục 5).

## Quy ước code

- Tên biến, hàm, file, bảng: tiếng Anh. Chữ hiển thị trên giao diện: tiếng Việt.
- Logic nghiệp vụ nằm ở `api/`. Logic thuần (không gọi DB) có unit test Vitest; logic chạm DB nhận `db` làm tham số để integration test được.
- `web/` không chứa nghiệp vụ — chỉ hiển thị và gọi API. Kiểm tra quyền chỉ tin ở `api/`.
- Không thêm thư viện mới khi vài dòng code tự viết được. Thêm dependency mới → nêu lý do.
- Không thêm tính năng ngoài spec (xem spec mục 9 "Ngoài phạm vi MVP").
- Không commit secret; biến môi trường mẫu để ở `.env.example`.
- `api/` là ESM (NestJS 12): import tương đối phải có đuôi `.js`.

## Test — bắt buộc

**Mọi tính năng / sửa lỗi phải kèm test đủ các case cần thiết.** Không có test = chưa xong.

- Mỗi hàm / action cần test: case đúng, case biên (rỗng, null, ngày không đầy đủ, tháng nhuận, trùng tên…), case sai (dữ liệu không hợp lệ, không đủ quyền).
- Sửa lỗi: viết test tái hiện lỗi trước, thấy đỏ, rồi mới sửa.
- Logic thuần → unit test (`*.test.ts`). Code chạm DB (logic `api/`, controller NestJS) → integration test trên Postgres thật (`*.int.test.ts`). Luồng người dùng chính → e2e Playwright. Chi tiết: spec mục 8.
- Mọi thao tác ghi phải có test cho từng vai trò: Admin, Member đã liên kết, chưa liên kết.
- Không mock Prisma/DB trong integration test. Không xóa / skip test để CI xanh.

## Quy trình làm việc

1. Mỗi giai đoạn: viết plan vào `docs/superpowers/plans/` → người dùng duyệt → mới code.
2. Viết test trước, rồi code (TDD).
3. Xong một việc: chạy lint + typecheck + test + build, báo kết quả thật (kể cả khi lỗi). CI phải xanh.
4. Commit nhỏ, message rõ ràng. Chỉ commit/push khi người dùng yêu cầu. Chỉ push code (+ `AGENTS.md`, `CLAUDE.md`); spec/plan/tài liệu `.md` giữ local. Remote: `https://github.com/DungVu187/GiaPha.git`, nhánh `main`.
5. Xong giai đoạn: cập nhật bảng "Trạng thái hiện tại" ở trên.

## Lệnh thường dùng

Lần đầu trên máy mới (Postgres 18 native đã cài):
- `psql -U postgres -h localhost -f api/scripts/create-local-db.sql` — chạy bằng superuser `postgres` (tạo role `giapha`, DB `giapha` + `giapha_test`). Trên Windows psql thường không có trong PATH: `"C:\Program Files\PostgreSQL\18\bin\psql.exe"`.
- `api/`: `cp .env.example .env && npm install && npm run db:migrate && npm run db:seed`
- `web/`: `cp .env.example .env && npm install`

| Thư mục | Lệnh | Việc |
|---|---|---|
| `api/` | `npm run start:dev` | API tại http://localhost:4000/api |
| `web/` | `npm run dev` | giao diện tại http://localhost:3000 |
| `api/` | `npm run format && npm run lint && npm run typecheck` | kiểm tra code (lint = oxlint) |
| `web/` | `npm run lint && npm run typecheck` | kiểm tra code (typecheck chạy `next typegen` trước) |
| `api/`, `web/` | `npm run test:unit` | unit test (`*.test.ts`) |
| `api/` | `npm run test:int` | integration test với Postgres thật (`*.int.test.ts`, DB `giapha_test`) |
| `web/` | `npm --prefix ../api run build && npm run build && npm run test:e2e` | e2e Playwright (tắt dev server trước: Playwright tự chạy api + web trên cổng 4000/3000; DB `giapha_test`) |
| `api/` | `npm run db:migrate` | tạo/áp migration (DB dev) |
| `api/` | `npm run db:seed` | tạo admin từ `ADMIN_USERNAME` / `ADMIN_PASSWORD` |

# CLAUDE.md

@AGENTS.md

## Riêng cho Claude Code: chọn model cho subagent

Chỉ dùng 2 model: **Sonnet** và **Opus**. Không dùng Haiku, Fable hay model khác.
Luôn truyền `model` rõ ràng khi gọi Agent tool (`"sonnet"` hoặc `"opus"`), không để mặc định.

| Mức task | Model | Ví dụ |
|---|---|---|
| Nhẹ – vừa | `sonnet` | Tìm kiếm / khám phá code, sửa nhỏ 1–2 file, viết UI component theo mẫu có sẵn, viết test cho hàm thuần đã rõ đặc tả, cập nhật docs, review diff nhỏ |
| Nặng | `opus` | Thiết kế kiến trúc, schema Prisma + migration, auth / session / bảo mật, phân quyền, thuật toán lịch âm & tính ngày giỗ, layout cây gia phả, debug lỗi khó, refactor nhiều file, review cuối trước khi chốt giai đoạn |

Phân vân giữa hai mức → chọn `opus`.

Lưu ý: subagent kiểu `fork` luôn chạy cùng model với phiên chính và bỏ qua `model` → task cần `sonnet` thì dùng subagent thường (vd. `general-purpose`, `Explore`), không dùng `fork`.

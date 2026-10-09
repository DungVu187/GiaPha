# CLAUDE.md

@AGENTS.md

## Riêng cho Claude Code: chọn model cho subagent

Dùng 3 model: **Haiku**, **Sonnet**, **Opus**. Không dùng Fable hay model khác.
Luôn truyền `model` rõ ràng khi gọi Agent tool (`"haiku"`, `"sonnet"` hoặc `"opus"`), không để mặc định.

| Mức task | Model | Ví dụ |
|---|---|---|
| Rất nhẹ, máy móc | `haiku` | Plan đã có sẵn code đầy đủ chỉ việc chép + chạy test (1–2 file), sửa một dòng / đổi chữ / đổi hằng, tìm file hoặc grep nhanh, re-review một bản sửa nhỏ |
| Nhẹ – vừa | `sonnet` | Tìm kiếm / khám phá code, sửa nhỏ 1–2 file cần tự quyết một chút, viết UI component theo mẫu có sẵn, viết test cho hàm thuần đã rõ đặc tả, cập nhật docs, review task (mức sàn cho reviewer), e2e |
| Nặng | `opus` | Thiết kế kiến trúc, schema Prisma + migration, auth / session / bảo mật, phân quyền, thuật toán lịch âm & tính ngày giỗ, layout cây gia phả, debug lỗi khó, refactor nhiều file, review cuối trước khi chốt giai đoạn |

Phân vân giữa hai mức → chọn mức cao hơn. Reviewer tối thiểu `sonnet` (trừ re-review bản sửa vài dòng có thể dùng `haiku`). Task phải tự quyết về bảo mật / quyền / dữ liệu (không có code mẫu đầy đủ) không giao `haiku`; nếu `haiku` làm task có code mẫu ở vùng này thì reviewer phải là `sonnet` trở lên.

Agent cục bộ (trong `.claude/agents/`, không push) để chọn sẵn model + effort: `haiku-medium`, `haiku-high`, `sonnet-low`, `sonnet-medium`, `opus-medium`, `opus-high`.

Lưu ý: subagent kiểu `fork` luôn chạy cùng model với phiên chính và bỏ qua `model` → task cần `haiku`/`sonnet` thì dùng subagent thường (vd. `general-purpose`, `Explore`, hoặc agent cục bộ ở trên), không dùng `fork`.

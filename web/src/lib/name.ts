// Bản sao của api/src/lib/name.ts để xem trước; server mới là nguồn tin cậy.
export function normalizeFullName(input: string): string {
  return input.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleUpperCase("vi");
}

// Bản sao api/src/lib/name.ts: bỏ dấu + chữ thường để tìm không dấu.
export function toSearchName(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

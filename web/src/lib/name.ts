// Bản sao của api/src/lib/name.ts để xem trước; server mới là nguồn tin cậy.
export function normalizeFullName(input: string): string {
  return input.normalize("NFC").trim().replace(/\s+/g, " ").toLocaleUpperCase("vi");
}

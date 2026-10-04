// Họ tên lưu IN HOA, khoảng trắng gọn (spec §3). Server là nguồn tin cậy; web có bản sao để xem trước.
export function normalizeFullName(input: string): string {
  return input
    .normalize('NFC')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleUpperCase('vi');
}

// Bỏ dấu + chữ thường để tìm kiếm không dấu.
export function toSearchName(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

// Kiểm tra sớm ở trình duyệt cho dễ dùng; server (api/src/auth/credentials.ts) mới là nguồn tin cậy.
export function validateNewPassword(next: string, confirm: string): { newPassword?: string; confirmPassword?: string } {
  if (!next) return { newPassword: "Vui lòng nhập mật khẩu mới." };
  if (next.normalize("NFC").length < 8) return { newPassword: "Mật khẩu phải có ít nhất 8 ký tự." };
  if (next.length > 256) return { newPassword: "Mật khẩu tối đa 256 ký tự." };
  if (next !== confirm) return { confirmPassword: "Mật khẩu nhập lại không khớp." };
  return {};
}

import { describe, expect, it } from "vitest";
import { validateNewPassword } from "./account-form";

describe("validateNewPassword", () => {
  it("hợp lệ → không lỗi", () => {
    expect(validateNewPassword("12345678", "12345678")).toEqual({});
  });
  it("trống / ngắn (đo NFC) / dài", () => {
    expect(validateNewPassword("", "")).toEqual({ newPassword: "Vui lòng nhập mật khẩu mới." });
    expect(validateNewPassword("1234567", "1234567")).toEqual({ newPassword: "Mật khẩu phải có ít nhất 8 ký tự." });
    expect(validateNewPassword("ếếếếếếế".normalize("NFD"), "ếếếếếếế".normalize("NFD")).newPassword).toBe("Mật khẩu phải có ít nhất 8 ký tự.");
    expect(validateNewPassword("a".repeat(257), "a".repeat(257))).toEqual({ newPassword: "Mật khẩu tối đa 256 ký tự." });
  });
  it("nhập lại không khớp", () => {
    expect(validateNewPassword("12345678", "12345679")).toEqual({ confirmPassword: "Mật khẩu nhập lại không khớp." });
  });
});

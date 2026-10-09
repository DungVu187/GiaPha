import { describe, expect, it } from "vitest";
import {
  createNewHint,
  GENERATION_OPTIONS,
  interpretRegisterResponse,
  matchBirth,
  matchesIntro,
  toRegisterBody,
  type RegisterMatch,
  type RegisterValues,
} from "./register-form";

const v: RegisterValues = {
  username: "dungvu123",
  password: "MatKhau@123",
  fullName: "vũ đức dũng",
  generation: "5",
  email: "",
};

describe("toRegisterBody", () => {
  it("lần đầu: không gửi claim; email trống → null; đời là số", () => {
    expect(toRegisterBody(v, null)).toEqual({
      username: "dungvu123",
      password: "MatKhau@123",
      fullName: "vũ đức dũng",
      generation: 5,
      email: null,
    });
  });
  it("chưa chọn đời → generation null (để server báo lỗi)", () => {
    expect(toRegisterBody({ ...v, generation: "" }, null).generation).toBeNull();
  });
  it("email có chữ → gửi nguyên (server chuẩn hóa)", () => {
    expect(toRegisterBody({ ...v, email: " Ten@Email.com " }, null).email).toBe(" Ten@Email.com ");
  });
  it("Đây là tôi → claim là id; Tạo mới → claim NEW", () => {
    expect(toRegisterBody(v, 12).claim).toBe(12);
    expect(toRegisterBody(v, "NEW").claim).toBe("NEW");
  });
});

describe("chữ hiển thị", () => {
  it("matchesIntro theo số người", () => {
    expect(matchesIntro(2, "VŨ ĐỨC DŨNG", 5)).toBe(
      "Gia phả đã có 2 người tên VŨ ĐỨC DŨNG, Đời 5 chưa có tài khoản. Nếu một trong số này là bạn, chọn “Đây là tôi” để nhận hồ sơ đó.",
    );
    expect(matchesIntro(1, "VŨ ĐỨC DŨNG", 5)).toBe(
      "Gia phả đã có 1 người tên VŨ ĐỨC DŨNG, Đời 5 chưa có tài khoản. Nếu đó là bạn, chọn “Đây là tôi” để nhận hồ sơ đó.",
    );
  });
  it("createNewHint", () => {
    expect(createNewHint("VŨ ĐỨC DŨNG", 5)).toBe(
      "Tạo hồ sơ mới mang tên VŨ ĐỨC DŨNG, Đời 5. Tên trùng với người khác là bình thường.",
    );
  });
  it("matchBirth: đủ / chỉ năm / không có", () => {
    const m = { id: 1, fullName: "A", generation: 5, fatherName: null, motherName: null };
    expect(matchBirth({ ...m, birthYear: 2003, birthMonth: 7, birthDay: 18 })).toBe("18/07/2003");
    expect(matchBirth({ ...m, birthYear: 1998, birthMonth: null, birthDay: null })).toBe("1998");
    expect(matchBirth({ ...m, birthYear: null, birthMonth: null, birthDay: null })).toBe("Chưa có thông tin");
  });
  it("GENERATION_OPTIONS là 1..30", () => {
    expect(GENERATION_OPTIONS[0]).toBe(1);
    expect(GENERATION_OPTIONS.at(-1)).toBe(30);
    expect(GENERATION_OPTIONS).toHaveLength(30);
  });
});

describe("interpretRegisterResponse", () => {
  const match: RegisterMatch = {
    id: 7,
    fullName: "VŨ ĐỨC DŨNG",
    generation: 5,
    fatherName: "VŨ ĐỨC THỊNH",
    motherName: null,
    birthYear: 2003,
    birthMonth: 7,
    birthDay: 18,
  };
  const FALLBACK = "Đăng ký thất bại, vui lòng thử lại.";

  it("201 → created", () => {
    expect(interpretRegisterResponse(201, { id: 1, username: "a" })).toEqual({ kind: "created" });
  });
  it("200 có matches → matches", () => {
    expect(interpretRegisterResponse(200, { matches: [match] })).toEqual({ kind: "matches", matches: [match] });
  });
  it("200 thiếu matches → error", () => {
    expect(interpretRegisterResponse(200, {})).toEqual({ kind: "error", message: FALLBACK });
  });
  it("409 có matches → taken kèm message + danh sách mới", () => {
    expect(interpretRegisterResponse(409, { message: "Hồ sơ này vừa được người khác nhận.", matches: [] })).toEqual({
      kind: "taken",
      message: "Hồ sơ này vừa được người khác nhận.",
      matches: [],
    });
  });
  it("409 thiếu matches → error dùng message", () => {
    expect(interpretRegisterResponse(409, { message: "Xung đột." })).toEqual({ kind: "error", message: "Xung đột." });
  });
  it("400 có lỗi theo ô → field-errors (bỏ khóa lạ)", () => {
    expect(
      interpretRegisterResponse(400, {
        message: "Dữ liệu không hợp lệ.",
        errors: { username: "Tên đăng nhập đã được dùng.", generation: "Vui lòng chọn đời.", claim: "x" },
      }),
    ).toEqual({
      kind: "field-errors",
      errors: { username: "Tên đăng nhập đã được dùng.", generation: "Vui lòng chọn đời." },
    });
  });
  it("400 errors rỗng → error với message", () => {
    expect(interpretRegisterResponse(400, { message: "Dữ liệu không hợp lệ.", errors: {} })).toEqual({
      kind: "error",
      message: "Dữ liệu không hợp lệ.",
    });
  });
  it("400 chỉ có khóa lạ (claim) → error với message", () => {
    expect(
      interpretRegisterResponse(400, { message: "Dữ liệu không hợp lệ.", errors: { claim: "Lựa chọn không hợp lệ." } }),
    ).toEqual({ kind: "error", message: "Dữ liệu không hợp lệ." });
  });
  it("400 khóa hợp lệ nhưng không phải chuỗi → error", () => {
    expect(interpretRegisterResponse(400, { errors: { username: 1 } })).toEqual({ kind: "error", message: FALLBACK });
  });
  it("500 → error mặc định", () => {
    expect(interpretRegisterResponse(500, { statusCode: 500 })).toEqual({ kind: "error", message: FALLBACK });
  });
  it("body không phải object → error mặc định", () => {
    expect(interpretRegisterResponse(400, null)).toEqual({ kind: "error", message: FALLBACK });
    expect(interpretRegisterResponse(409, "lỗi")).toEqual({ kind: "error", message: FALLBACK });
    expect(interpretRegisterResponse(200, [match])).toEqual({ kind: "error", message: FALLBACK });
  });
});

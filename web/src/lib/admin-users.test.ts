import { describe, expect, it } from "vitest";
import { type AdminUser, filterUsers, formatDateVN, isLastAdmin, isRecentClaim } from "./admin-users";

const NOW = new Date("2026-10-19T03:00:00Z");
const u = (id: number, over: Partial<AdminUser> = {}): AdminUser => ({
  id,
  username: `user${id}`,
  email: null,
  role: "MEMBER",
  createdAt: "2026-10-01T00:00:00.000Z",
  claimedAt: null,
  member: null,
  ...over,
});

describe("isRecentClaim", () => {
  it("≤ 30 ngày → true; quá 30 ngày / null → false", () => {
    expect(isRecentClaim("2026-09-19T03:00:00.000Z", NOW)).toBe(true);
    expect(isRecentClaim("2026-09-19T02:59:59.000Z", NOW)).toBe(false);
    expect(isRecentClaim(null, NOW)).toBe(false);
  });
});

describe("filterUsers", () => {
  const users = [
    u(1, { username: "dungvu123", member: { id: 9, fullName: "VŨ ĐỨC DŨNG", generation: 5, avatarPath: null }, claimedAt: "2026-10-18T00:00:00.000Z" }),
    u(2, { username: "hangvu56", member: { id: 8, fullName: "VŨ THỊ HẰNG", generation: 4, avatarPath: null } }),
    u(3, { username: "minh2006" }),
  ];
  it("tìm không dấu theo tên đăng nhập hoặc tên thành viên", () => {
    expect(filterUsers(users, "", false, NOW).map((x) => x.id)).toEqual([1, 2, 3]);
    expect(filterUsers(users, "hang", false, NOW).map((x) => x.id)).toEqual([2]);
    expect(filterUsers(users, "Vũ Đức", false, NOW).map((x) => x.id)).toEqual([1]);
    expect(filterUsers(users, "MINH", false, NOW).map((x) => x.id)).toEqual([3]);
  });
  it("chỉ tài khoản vừa nhận hồ sơ", () => {
    expect(filterUsers(users, "", true, NOW).map((x) => x.id)).toEqual([1]);
    expect(filterUsers(users, "hang", true, NOW)).toEqual([]);
  });
});

describe("isLastAdmin", () => {
  it("đúng khi người đó là Admin duy nhất", () => {
    expect(isLastAdmin([u(1, { role: "ADMIN" }), u(2)], 1)).toBe(true);
    expect(isLastAdmin([u(1, { role: "ADMIN" }), u(2, { role: "ADMIN" })], 1)).toBe(false);
    expect(isLastAdmin([u(1, { role: "ADMIN" }), u(2)], 2)).toBe(false);
  });
});

describe("formatDateVN", () => {
  it("dd/mm/yyyy theo giờ Việt Nam", () => {
    expect(formatDateVN("2026-10-18T17:30:00.000Z")).toBe("19/10/2026");
    expect(formatDateVN("2026-01-05T00:00:00.000Z")).toBe("05/01/2026");
  });
});

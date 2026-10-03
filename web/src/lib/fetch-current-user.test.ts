import { describe, expect, it, vi } from "vitest";
import { fetchCurrentUser } from "./fetch-current-user";

const API = "http://api.local";
const USER = { id: 1, username: "admin", role: "ADMIN" };

function fakeFetch(status: number, body: unknown = {}) {
  return vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status }));
}

describe("fetchCurrentUser", () => {
  it("không có token → null, không gọi API", async () => {
    const fetchFn = fakeFetch(200, USER);
    expect(await fetchCurrentUser(undefined, API, fetchFn)).toBeNull();
    expect(await fetchCurrentUser("", API, fetchFn)).toBeNull();
    expect(fetchFn).not.toHaveBeenCalled();
  });

  it("200 → trả user; gọi đúng URL, gửi cookie, không cache", async () => {
    const fetchFn = fakeFetch(200, USER);
    expect(await fetchCurrentUser("tok123", API, fetchFn)).toEqual(USER);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("http://api.local/api/auth/me");
    expect(new Headers(init?.headers).get("cookie")).toBe("giapha_session=tok123");
    expect(init?.cache).toBe("no-store");
  });

  it("401 → null", async () => {
    expect(await fetchCurrentUser("het-han", API, fakeFetch(401))).toBeNull();
  });

  it("500 → throw (API lỗi thì báo lỗi, không coi như chưa đăng nhập)", async () => {
    await expect(fetchCurrentUser("tok", API, fakeFetch(500))).rejects.toThrow(/500/);
  });
});

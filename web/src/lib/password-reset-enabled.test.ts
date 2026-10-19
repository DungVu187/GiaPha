import { describe, expect, it, vi } from "vitest";
import { fetchPasswordResetEnabled } from "./password-reset-enabled";

const API = "http://api.local";

function fakeFetch(status: number, body: unknown) {
  return vi.fn<typeof fetch>(async () => new Response(JSON.stringify(body), { status }));
}

describe("fetchPasswordResetEnabled", () => {
  it("200 { enabled: true } → true; gọi đúng URL, không cache", async () => {
    const fetchFn = fakeFetch(200, { enabled: true });
    expect(await fetchPasswordResetEnabled(API, fetchFn)).toBe(true);
    const [url, init] = fetchFn.mock.calls[0];
    expect(url).toBe("http://api.local/api/auth/password-reset/enabled");
    expect(init?.cache).toBe("no-store");
  });

  it("200 { enabled: false } → false", async () => {
    expect(await fetchPasswordResetEnabled(API, fakeFetch(200, { enabled: false }))).toBe(false);
  });

  it("API lỗi 5xx / 404 → false (không làm sập trang)", async () => {
    expect(await fetchPasswordResetEnabled(API, fakeFetch(500, { message: "x" }))).toBe(false);
    expect(await fetchPasswordResetEnabled(API, fakeFetch(502, {}))).toBe(false);
    expect(await fetchPasswordResetEnabled(API, fakeFetch(404, {}))).toBe(false);
  });

  it("không gọi được API (lỗi mạng) → false", async () => {
    const fetchFn = vi.fn<typeof fetch>(async () => {
      throw new TypeError("fetch failed");
    });
    expect(await fetchPasswordResetEnabled(API, fetchFn)).toBe(false);
  });

  it("body không phải JSON / enabled không phải true → false", async () => {
    const notJson = vi.fn<typeof fetch>(async () => new Response("<html>", { status: 200 }));
    expect(await fetchPasswordResetEnabled(API, notJson)).toBe(false);
    expect(await fetchPasswordResetEnabled(API, fakeFetch(200, { enabled: "yes" }))).toBe(false);
    expect(await fetchPasswordResetEnabled(API, fakeFetch(200, null))).toBe(false);
  });

  it("API cổng không ai nghe (fetch thật) → false", async () => {
    expect(await fetchPasswordResetEnabled("http://127.0.0.1:1")).toBe(false);
  });
});

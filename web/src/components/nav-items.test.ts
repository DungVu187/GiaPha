import { describe, expect, it } from "vitest";
import { NAV_ITEMS } from "./nav-items";

const active = (path: string) => NAV_ITEMS.filter((i) => i.match(path)).map((i) => i.href);

describe("NAV_ITEMS.match", () => {
  it("/tree và /tree/1 chỉ sáng mục Cây", () => {
    expect(active("/tree")).toEqual(["/tree"]);
    expect(active("/tree/1")).toEqual(["/tree"]);
  });
  it("/treeX không sáng mục nào", () => expect(active("/treeX")).toEqual([]));
  it("/ chỉ sáng Trang chủ", () => expect(active("/")).toEqual(["/"]));
  it("/members/5 sáng Thành viên", () => expect(active("/members/5")).toEqual(["/members"]));
  it("/anniversaries sáng Lịch giỗ", () => expect(active("/anniversaries")).toEqual(["/anniversaries"]));
});

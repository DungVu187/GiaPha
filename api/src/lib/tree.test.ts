import { describe, expect, it } from 'vitest';
import {
  buildTree,
  compareSiblings,
  type TreeMarriageRow,
  type TreeMemberRow,
} from './tree.js';

let nextMarriage = 1;
function m(id: number, patch: Partial<TreeMemberRow> = {}): TreeMemberRow {
  return {
    id,
    fullName: `NGƯỜI ${id}`,
    searchName: `nguoi ${id}`,
    generation: 1,
    gender: 'MALE',
    isDeceased: false,
    birthOrder: null,
    birthYear: null,
    birthMonth: null,
    birthDay: null,
    deathYear: null,
    deathMonth: null,
    deathDay: null,
    deathCalendar: null,
    anniversaryDay: null,
    anniversaryMonth: null,
    anniversaryCalendar: null,
    burialPlace: null,
    avatarPath: null,
    fatherId: null,
    motherId: null,
    ...patch,
  };
}
function wed(
  a: number,
  b: number,
  order: number | null = null,
): TreeMarriageRow {
  return {
    id: nextMarriage++,
    person1Id: Math.min(a, b),
    person2Id: Math.max(a, b),
    order,
  };
}
const ids = (t: ReturnType<typeof buildTree>) => t.families.map((f) => f.id);
const fam = (t: ReturnType<typeof buildTree>, id: number) =>
  t.families.find((f) => f.id === id);

describe('buildTree', () => {
  it('rỗng → không có gì', () => {
    expect(buildTree([], [])).toEqual({ families: [], roots: [] });
  });

  it('3 đời theo dòng cha: mỗi người trong dòng một khối, con dưới bố', () => {
    const t = buildTree(
      [
        m(1),
        m(2, { generation: 2, fatherId: 1 }),
        m(3, { generation: 3, fatherId: 2 }),
      ],
      [],
    );
    expect(ids(t)).toEqual([1, 2, 3]);
    expect(t.roots).toEqual([1]);
    expect(fam(t, 1)?.childIds).toEqual([2]);
    expect(fam(t, 2)?.childIds).toEqual([3]);
    expect(fam(t, 3)?.childIds).toEqual([]);
    expect(fam(t, 2)?.person.fatherName).toBe('NGƯỜI 1');
    expect(fam(t, 1)?.person.fatherName).toBeNull();
  });

  it('cụ tổ + vợ đều không bố mẹ: chồng là gốc, vợ là thẻ vợ trong khối (P3)', () => {
    const t = buildTree([m(1), m(2, { gender: 'FEMALE' })], [wed(1, 2)]);
    expect(ids(t)).toEqual([1]);
    expect(t.roots).toEqual([1]);
    expect(fam(t, 1)?.spouses.map((s) => s.id)).toEqual([2]);
  });

  it('cặp không bố mẹ, vợ id nhỏ hơn: vẫn chồng là gốc (nam trước)', () => {
    const t = buildTree([m(1, { gender: 'FEMALE' }), m(2)], [wed(1, 2)]);
    expect(t.roots).toEqual([2]);
    expect(fam(t, 2)?.spouses.map((s) => s.id)).toEqual([1]);
  });

  it('cặp không bố mẹ, chưa rõ giới: id nhỏ là gốc', () => {
    const t = buildTree(
      [m(5, { gender: null }), m(3, { gender: null })],
      [wed(3, 5)],
    );
    expect(t.roots).toEqual([3]);
  });

  it('con dâu ngoài họ (không bố mẹ) lấy chồng trong dòng → thẻ vợ, không thành gốc', () => {
    const t = buildTree(
      [
        m(1),
        m(2, { generation: 2, fatherId: 1 }),
        m(3, { generation: 2, gender: 'FEMALE' }),
      ],
      [wed(2, 3)],
    );
    expect(ids(t)).toEqual([1, 2]);
    expect(fam(t, 2)?.spouses.map((s) => s.id)).toEqual([3]);
  });

  it('con gái trong dòng: có khối riêng (kèm chồng ngoài họ) nhưng KHÔNG vẽ con của con gái (D6)', () => {
    const t = buildTree(
      [
        m(1),
        m(2, { generation: 2, gender: 'FEMALE', fatherId: 1 }), // con gái
        m(3, { generation: 2 }), // rể, không bố mẹ
        m(4, { generation: 3, fatherId: 3, motherId: 2 }), // cháu ngoại
      ],
      [wed(2, 3)],
    );
    expect(ids(t)).toEqual([1, 2]);
    expect(fam(t, 2)?.spouses.map((s) => s.id)).toEqual([3]);
    expect(fam(t, 2)?.childIds).toEqual([]);
    expect(t.families.some((f) => f.spouses.some((s) => s.id === 4))).toBe(
      false,
    );
  });

  it('rể ngoài họ còn vợ khác không bố mẹ → vợ khác là gốc riêng, rể vẫn là thẻ chồng của con gái', () => {
    const t = buildTree(
      [
        m(1),
        m(2, { generation: 2, gender: 'FEMALE', fatherId: 1 }), // G: con gái trong dòng
        m(3, { generation: 2 }), // R: rể, không bố mẹ
        m(4, { generation: 2, gender: 'FEMALE' }), // V: vợ khác của R, không bố mẹ
      ],
      [wed(2, 3), wed(3, 4)],
    );
    expect(ids(t)).toEqual([1, 2, 4]);
    expect(t.roots).toEqual([1, 4]);
    expect(fam(t, 2)?.spouses.map((s) => s.id)).toEqual([3]);
    expect(fam(t, 4)?.spouses.map((s) => s.id)).toEqual([3]);
    expect(fam(t, 3)).toBeUndefined();
  });

  it('người chỉ có mẹ trong DB (không bố) → không vẽ (P2)', () => {
    const t = buildTree(
      [
        m(1),
        m(2, { generation: 2, gender: 'FEMALE', fatherId: 1 }),
        m(3, { generation: 3, motherId: 2 }),
      ],
      [],
    );
    expect(ids(t)).toEqual([1, 2]);
  });

  it('bố mẹ chung không có Marriage → coi là vợ chồng ngầm: bà là thẻ vợ trong khối ông, không là gốc', () => {
    const t = buildTree(
      [
        m(1), // ÔNG
        m(2, { gender: 'FEMALE' }), // BÀ: không bố mẹ, không Marriage
        m(3, { generation: 2, fatherId: 1, motherId: 2 }), // CON
      ],
      [],
    );
    expect(ids(t)).toEqual([1, 3]);
    expect(t.roots).toEqual([1]);
    expect(fam(t, 1)?.spouses.map((s) => s.id)).toEqual([2]);
    expect(fam(t, 2)).toBeUndefined();
  });

  it('con gái + rể không Marriage nhưng có con chung → rể là thẻ chồng, cháu ngoại không vẽ (D6)', () => {
    const t = buildTree(
      [
        m(1),
        m(2, { generation: 2, gender: 'FEMALE', fatherId: 1 }), // GÁI
        m(3, { generation: 2 }), // RỂ: không bố mẹ, không Marriage
        m(4, { generation: 3, fatherId: 3, motherId: 2 }), // NGOẠI
      ],
      [],
    );
    expect(ids(t)).toEqual([1, 2]);
    expect(t.roots).toEqual([1]);
    expect(fam(t, 2)?.spouses.map((s) => s.id)).toEqual([3]);
    expect(fam(t, 2)?.childIds).toEqual([]);
    expect(fam(t, 3)).toBeUndefined();
    expect(JSON.stringify(t)).not.toContain('NGƯỜI 4');
  });

  it('bố mẹ chung đã có Marriage → không nhân đôi thẻ vợ', () => {
    const t = buildTree(
      [
        m(1),
        m(2, { gender: 'FEMALE' }),
        m(3, { generation: 2, fatherId: 1, motherId: 2 }),
        m(4, { generation: 2, fatherId: 1, motherId: 2 }),
      ],
      [wed(1, 2)],
    );
    expect(fam(t, 1)?.spouses.map((s) => s.id)).toEqual([2]);
  });

  it('vợ có Marriage xếp trước, vợ ngầm sau (theo id con chung nhỏ nhất, rồi id người)', () => {
    const t = buildTree(
      [
        m(1),
        m(5, { gender: 'FEMALE' }), // vợ ngầm, con chung id 9
        m(6, { gender: 'FEMALE' }), // vợ ngầm, con chung id 8 → trước 5
        m(7, { gender: 'FEMALE' }), // vợ có Marriage
        m(8, { generation: 2, fatherId: 1, motherId: 6 }),
        m(9, { generation: 2, fatherId: 1, motherId: 5 }),
        m(10, { generation: 2, fatherId: 1, motherId: 5 }),
      ],
      [wed(1, 7)],
    );
    expect(fam(t, 1)?.spouses.map((s) => s.id)).toEqual([7, 6, 5]);
  });

  it('người vừa đăng ký chưa có bố → gốc riêng, giữ đời của mình', () => {
    const t = buildTree(
      [m(1), m(2, { generation: 2, fatherId: 1 }), m(9, { generation: 5 })],
      [],
    );
    expect(t.roots).toEqual([1, 9]);
    expect(fam(t, 9)?.generation).toBe(5);
  });

  it('con dâu có bố mẹ trong DB → là người trong dòng nhà mình VÀ là thẻ vợ nhà chồng (P4)', () => {
    const t = buildTree(
      [
        m(1),
        m(2, { generation: 2, fatherId: 1 }), // nhà chồng
        m(10, { generation: 1 }),
        m(11, { generation: 2, gender: 'FEMALE', fatherId: 10 }), // nhà vợ
      ],
      [wed(2, 11)],
    );
    expect(t.roots).toEqual([1, 10]);
    expect(ids(t)).toEqual([1, 10, 2, 11]);
    expect(fam(t, 2)?.spouses.map((s) => s.id)).toEqual([11]);
  });

  it('nhiều vợ: xếp theo Marriage.order (thiếu → sau), rồi id hôn nhân', () => {
    const marriages = [wed(1, 4), wed(1, 2, 2), wed(1, 3, 1)];
    const t = buildTree(
      [
        m(1),
        m(2, { gender: 'FEMALE' }),
        m(3, { gender: 'FEMALE' }),
        m(4, { gender: 'FEMALE' }),
      ],
      marriages,
    );
    expect(fam(t, 1)?.spouses.map((s) => s.id)).toEqual([3, 2, 4]);
  });

  it('con xếp: birthOrder → năm → tháng → ngày → id; thiếu xếp sau', () => {
    const kids = [
      m(10, { generation: 2, fatherId: 1 }),
      m(11, { generation: 2, fatherId: 1, birthYear: 1950 }),
      m(12, { generation: 2, fatherId: 1, birthYear: 1950, birthMonth: 3 }),
      m(13, { generation: 2, fatherId: 1, birthOrder: 2 }),
      m(14, { generation: 2, fatherId: 1, birthOrder: 1, birthYear: 1990 }),
      m(15, { generation: 2, fatherId: 1, birthYear: 1940 }),
    ];
    const t = buildTree([m(1), ...kids], []);
    expect(fam(t, 1)?.childIds).toEqual([14, 13, 15, 12, 11, 10]);
  });

  it('compareSiblings: id quyết định khi mọi thứ bằng nhau', () => {
    expect(compareSiblings(m(2), m(1))).toBeGreaterThan(0);
    expect(compareSiblings(m(1), m(1))).toBe(0);
  });

  it('gốc xếp theo đời rồi ngày sinh rồi id', () => {
    const t = buildTree(
      [
        m(7, { generation: 3 }),
        m(5, { generation: 1, birthYear: 1900 }),
        m(6, { generation: 1, birthYear: 1890 }),
      ],
      [],
    );
    expect(t.roots).toEqual([6, 5, 7]);
  });

  it('thẻ mang đủ trường hiển thị, không lộ fatherId/motherId/birthOrder', () => {
    const t = buildTree(
      [
        m(1, {
          isDeceased: true,
          deathYear: 1998,
          deathCalendar: 'SOLAR',
          anniversaryDay: 12,
          anniversaryMonth: 8,
          anniversaryCalendar: 'LUNAR',
          burialPlace: 'Đồng Lạc',
          avatarPath: '/uploads/avatars/x.jpg',
        }),
      ],
      [],
    );
    const card = fam(t, 1)!.person;
    expect(card).toMatchObject({
      isDeceased: true,
      deathYear: 1998,
      anniversaryDay: 12,
      burialPlace: 'Đồng Lạc',
      avatarPath: '/uploads/avatars/x.jpg',
      searchName: 'nguoi 1',
    });
    expect(card).not.toHaveProperty('fatherId');
    expect(card).not.toHaveProperty('motherId');
    expect(card).not.toHaveProperty('birthOrder');
  });

  it('hôn nhân trỏ tới người không có trong danh sách → bỏ qua', () => {
    const t = buildTree([m(1)], [wed(1, 99)]);
    expect(fam(t, 1)?.spouses).toEqual([]);
  });

  it('dữ liệu vòng không làm treo (trả kết quả hữu hạn)', () => {
    // 1 là bố của 2, 2 là bố của 1 — GĐ2 chặn, nhưng hàm vẫn phải dừng.
    const t = buildTree([m(1, { fatherId: 2 }), m(2, { fatherId: 1 })], []);
    expect(t.roots).toEqual([]);
  });
});

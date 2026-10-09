import { describe, expect, it } from 'vitest';
import { parseRegisterInput } from './register-input.js';

const base = {
  username: 'dungvu123',
  password: 'MatKhau@123',
  fullName: 'vũ đức dũng',
  generation: 5,
};
const value = (body: unknown) => {
  const r = parseRegisterInput(body);
  if (!r.ok) throw new Error(JSON.stringify(r.errors));
  return r.value;
};
const errors = (body: unknown) => {
  const r = parseRegisterInput(body);
  if (r.ok) throw new Error('mong đợi lỗi');
  return r.errors;
};

describe('parseRegisterInput', () => {
  it('hợp lệ tối thiểu → chuẩn hóa username, họ tên; email null; claim NONE', () => {
    expect(
      value({
        ...base,
        username: '  DungVu123 ',
        fullName: '  vũ   đức dũng ',
      }),
    ).toEqual({
      username: 'dungvu123',
      password: 'MatKhau@123',
      fullName: 'VŨ ĐỨC DŨNG',
      generation: 5,
      email: null,
      claim: { kind: 'NONE' },
    });
  });

  it('mật khẩu giữ nguyên (không trim)', () => {
    expect(value({ ...base, password: '  có dấu  ' }).password).toBe(
      '  có dấu  ',
    );
  });

  it.each([
    [{ username: undefined }, 'username', 'Vui lòng nhập tên đăng nhập.'],
    [{ username: '   ' }, 'username', 'Vui lòng nhập tên đăng nhập.'],
    [
      { username: 'ab' },
      'username',
      'Tên đăng nhập 3–32 ký tự, chỉ gồm chữ thường không dấu, số, dấu chấm (.) hoặc gạch dưới (_).',
    ],
    [
      { username: 'dũng' },
      'username',
      'Tên đăng nhập 3–32 ký tự, chỉ gồm chữ thường không dấu, số, dấu chấm (.) hoặc gạch dưới (_).',
    ],
    [{ username: 123 }, 'username', 'Vui lòng nhập tên đăng nhập.'],
    [{ password: '' }, 'password', 'Vui lòng nhập mật khẩu.'],
    [{ password: '1234567' }, 'password', 'Mật khẩu phải có ít nhất 8 ký tự.'],
    [{ password: 'a'.repeat(257) }, 'password', 'Mật khẩu tối đa 256 ký tự.'],
    [{ fullName: '   ' }, 'fullName', 'Vui lòng nhập họ và tên.'],
    [{ fullName: 'A'.repeat(101) }, 'fullName', 'Họ tên tối đa 100 ký tự.'],
    [{ generation: undefined }, 'generation', 'Vui lòng chọn đời.'],
    [{ generation: null }, 'generation', 'Vui lòng chọn đời.'],
    [{ generation: '5' }, 'generation', 'Đời phải là số nguyên từ 1 đến 200.'],
    [{ generation: 0 }, 'generation', 'Đời phải là số nguyên từ 1 đến 200.'],
    [{ generation: 201 }, 'generation', 'Đời phải là số nguyên từ 1 đến 200.'],
    [{ generation: 2.5 }, 'generation', 'Đời phải là số nguyên từ 1 đến 200.'],
    [{ email: 'khong-phai-email' }, 'email', 'Email không hợp lệ.'],
    [{ email: 'a b@c.vn' }, 'email', 'Email không hợp lệ.'],
    [{ email: `${'a'.repeat(250)}@c.vn` }, 'email', 'Email không hợp lệ.'],
    [{ email: 5 }, 'email', 'Email không hợp lệ.'],
    [{ claim: 'ME' }, 'claim', 'Lựa chọn không hợp lệ.'],
    [{ claim: 0 }, 'claim', 'Lựa chọn không hợp lệ.'],
    [{ claim: 2147483648 }, 'claim', 'Lựa chọn không hợp lệ.'],
    [{ claim: '7' }, 'claim', 'Lựa chọn không hợp lệ.'],
  ])('%j → lỗi ở %s', (patch, key, message) => {
    expect(errors({ ...base, ...patch })[key]).toBe(message);
  });

  it('mật khẩu 8 ký tự dạng tổ hợp (NFD) được đếm theo NFC', () => {
    // "ếếếếếếếế" NFC = 8 ký tự; NFD = 24 → vẫn hợp lệ, và 7 ký tự NFC thì lỗi dù NFD dài hơn 8.
    expect(
      value({ ...base, password: 'ế'.repeat(8).normalize('NFD') }).password,
    ).toBe('ế'.repeat(8).normalize('NFD'));
    expect(
      errors({ ...base, password: 'ế'.repeat(7).normalize('NFD') }).password,
    ).toBe('Mật khẩu phải có ít nhất 8 ký tự.');
  });

  it('mật khẩu đúng 256 ký tự hợp lệ', () => {
    expect(value({ ...base, password: 'a'.repeat(256) }).password).toHaveLength(
      256,
    );
  });

  it('mật khẩu tối đa đo theo độ dài thô (khớp đăng nhập): NFD thô 257 nhưng NFC ≤ 256 → lỗi', () => {
    const pw = 'ế'.repeat(86).normalize('NFD').slice(0, 257);
    expect(pw).toHaveLength(257);
    expect(pw.normalize('NFC').length).toBeLessThanOrEqual(256);
    expect(errors({ ...base, password: pw }).password).toBe(
      'Mật khẩu tối đa 256 ký tự.',
    );
  });

  it('email: trim + chữ thường; rỗng/chỉ khoảng trắng/null → null', () => {
    expect(value({ ...base, email: '  Ten@Email.COM ' }).email).toBe(
      'ten@email.com',
    );
    expect(value({ ...base, email: '   ' }).email).toBeNull();
    expect(value({ ...base, email: null }).email).toBeNull();
  });

  it('claim: "NEW" → NEW; số nguyên dương → MEMBER', () => {
    expect(value({ ...base, claim: 'NEW' }).claim).toEqual({ kind: 'NEW' });
    expect(value({ ...base, claim: 7 }).claim).toEqual({
      kind: 'MEMBER',
      memberId: 7,
    });
    expect(value({ ...base, claim: null }).claim).toEqual({ kind: 'NONE' });
  });

  it('body không phải object (null, mảng, chuỗi) → lỗi đủ 4 trường bắt buộc', () => {
    for (const body of [null, [], 'x', 5]) {
      expect(Object.keys(errors(body)).sort()).toEqual([
        'fullName',
        'generation',
        'password',
        'username',
      ]);
    }
  });

  it('gom nhiều lỗi một lần', () => {
    expect(
      Object.keys(
        errors({ username: 'ab', password: '1', fullName: '', generation: 0 }),
      ).sort(),
    ).toEqual(['fullName', 'generation', 'password', 'username']);
  });
});

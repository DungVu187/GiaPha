import { normalizeFullName } from '../lib/name.js';
import { MAX_GENERATION } from '../members/member-input.js';
import { newPasswordError, parseOptionalEmail } from './credentials.js';
import { isValidUsername, normalizeUsername } from './username.js';

export type RegisterClaim =
  { kind: 'NONE' } | { kind: 'NEW' } | { kind: 'MEMBER'; memberId: number };

export type RegisterInput = {
  username: string;
  password: string;
  fullName: string;
  generation: number;
  email: string | null;
  claim: RegisterClaim;
};

export type RegisterErrors = Record<string, string>;

export const USERNAME_RULE =
  'Tên đăng nhập 3–32 ký tự, chỉ gồm chữ thường không dấu, số, dấu chấm (.) hoặc gạch dưới (_).';
export const USERNAME_TAKEN = 'Tên đăng nhập đã có người dùng.';
export const EMAIL_TAKEN = 'Email này đã được dùng cho tài khoản khác.';

const MAX_FULL_NAME_LENGTH = 100;
const MAX_INT32 = 2147483647;

const isMissing = (v: unknown) => v === undefined || v === null;

export function parseRegisterInput(
  body: unknown,
): { ok: true; value: RegisterInput } | { ok: false; errors: RegisterErrors } {
  const raw =
    typeof body === 'object' && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : {};
  const errors: RegisterErrors = {};

  const username =
    typeof raw.username === 'string' ? normalizeUsername(raw.username) : '';
  if (!username) errors.username = 'Vui lòng nhập tên đăng nhập.';
  else if (!isValidUsername(username)) errors.username = USERNAME_RULE;

  const password = typeof raw.password === 'string' ? raw.password : '';
  const passwordError = newPasswordError(raw.password);
  if (passwordError) errors.password = passwordError;

  const fullName =
    typeof raw.fullName === 'string' ? normalizeFullName(raw.fullName) : '';
  if (!fullName) errors.fullName = 'Vui lòng nhập họ và tên.';
  else if (fullName.length > MAX_FULL_NAME_LENGTH)
    errors.fullName = `Họ tên tối đa ${MAX_FULL_NAME_LENGTH} ký tự.`;

  const generation = raw.generation;
  if (isMissing(generation)) errors.generation = 'Vui lòng chọn đời.';
  else if (
    typeof generation !== 'number' ||
    !Number.isInteger(generation) ||
    generation < 1 ||
    generation > MAX_GENERATION
  )
    errors.generation = `Đời phải là số nguyên từ 1 đến ${MAX_GENERATION}.`;

  const parsedEmail = parseOptionalEmail(raw.email);
  if (!parsedEmail.ok) errors.email = parsedEmail.error;
  const email = parsedEmail.ok ? parsedEmail.email : null;

  let claim: RegisterClaim = { kind: 'NONE' };
  if (!isMissing(raw.claim)) {
    if (raw.claim === 'NEW') claim = { kind: 'NEW' };
    else if (
      typeof raw.claim === 'number' &&
      Number.isInteger(raw.claim) &&
      raw.claim >= 1 &&
      raw.claim <= MAX_INT32
    )
      claim = { kind: 'MEMBER', memberId: raw.claim };
    else errors.claim = 'Lựa chọn không hợp lệ.';
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    value: {
      username,
      password,
      fullName,
      generation: generation as number,
      email,
      claim,
    },
  };
}

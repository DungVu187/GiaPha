import { describe, expect, it } from 'vitest';
import { testDb as db } from '../../test/helpers/test-db.js';
import {
  createSession,
  hashToken,
  invalidateSession,
  invalidateUserSessions,
  SESSION_TTL_MS,
  validateSessionToken,
} from './session.js';

const NOW = new Date('2026-10-03T00:00:00.000Z');

function makeUser(username = 'dungvu123') {
  return db.user.create({
    data: { username, passwordHash: 'x', role: 'MEMBER' },
  });
}

describe('session', () => {
  it('createSession lưu hash của token, không lưu token gốc', async () => {
    const user = await makeUser();
    const { token, expiresAt } = await createSession(db, user.id, NOW);
    expect(token.length).toBeGreaterThanOrEqual(43);
    expect(expiresAt.getTime()).toBe(NOW.getTime() + SESSION_TTL_MS);
    expect(await db.session.findUnique({ where: { id: token } })).toBeNull();
    expect(
      await db.session.findUnique({ where: { id: hashToken(token) } }),
    ).not.toBeNull();
  });

  it('mỗi lần tạo cho token khác nhau', async () => {
    const user = await makeUser();
    const a = await createSession(db, user.id, NOW);
    const b = await createSession(db, user.id, NOW);
    expect(a.token).not.toBe(b.token);
  });

  it('validate token hợp lệ → trả user, không kèm passwordHash', async () => {
    const user = await makeUser();
    const { token } = await createSession(db, user.id, NOW);
    expect(await validateSessionToken(db, token, NOW)).toEqual({
      id: user.id,
      username: 'dungvu123',
      role: 'MEMBER',
      memberId: null,
    });
  });

  it('token không tồn tại / rỗng → null', async () => {
    expect(await validateSessionToken(db, 'khong-ton-tai', NOW)).toBeNull();
    expect(await validateSessionToken(db, '', NOW)).toBeNull();
  });

  it('token hết hạn → null và session bị xóa', async () => {
    const user = await makeUser();
    const { token } = await createSession(db, user.id, NOW);
    const other = await makeUser('user_khac');
    const { token: otherToken } = await createSession(
      db,
      other.id,
      new Date(NOW.getTime() + 1000),
    );
    const later = new Date(NOW.getTime() + SESSION_TTL_MS);
    expect(await validateSessionToken(db, token, later)).toBeNull();
    expect(await db.session.count()).toBe(1);
    expect(await validateSessionToken(db, otherToken, later)).not.toBeNull();
  });

  it('còn 1ms trước hạn vẫn hợp lệ', async () => {
    const user = await makeUser();
    const { token } = await createSession(db, user.id, NOW);
    const justBefore = new Date(NOW.getTime() + SESSION_TTL_MS - 1);
    expect(await validateSessionToken(db, token, justBefore)).not.toBeNull();
  });

  it('invalidateSession → token không dùng được nữa; gọi lại không lỗi', async () => {
    const user = await makeUser();
    const { token } = await createSession(db, user.id, NOW);
    await invalidateSession(db, token);
    await invalidateSession(db, token);
    expect(await validateSessionToken(db, token, NOW)).toBeNull();
  });

  it('invalidateUserSessions chỉ xóa session của user đó', async () => {
    const a = await makeUser('user_a');
    const b = await makeUser('user_b');
    const sa = await createSession(db, a.id, NOW);
    const sb = await createSession(db, b.id, NOW);
    await invalidateUserSessions(db, a.id);
    expect(await validateSessionToken(db, sa.token, NOW)).toBeNull();
    expect(await validateSessionToken(db, sb.token, NOW)).not.toBeNull();
  });
});

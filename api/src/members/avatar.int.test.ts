import { mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createTestApp } from '../../test/helpers/app.js';
import { createMember, loginAs } from '../../test/helpers/factories.js';
import { testDb as db } from '../../test/helpers/test-db.js';
import { MAX_AVATAR_BYTES, removeAvatarFile, uploadsDir } from './avatar.js';
import { setAvatar } from './member-service.js';

const PNG_HEADER = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const PNG = Buffer.concat([Buffer.from(PNG_HEADER), Buffer.alloc(100)]);
const JPG = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), Buffer.alloc(50)]);
const AVATAR_PATH = /^\/uploads\/avatars\/\d+-[0-9a-f]{16}\.png$/;
const FORBIDDEN = { message: 'Bạn không có quyền thực hiện thao tác này.' };
const NOT_FOUND = { message: 'Không tìm thấy thành viên.' };
const NO_FILE = {
  message: 'Dữ liệu không hợp lệ.',
  errors: { file: 'Vui lòng chọn ảnh.' },
};
const BAD_TYPE = {
  message: 'Dữ liệu không hợp lệ.',
  errors: { file: 'Chỉ nhận ảnh JPG, PNG hoặc WebP.' },
};

const avatarsDir = () => path.join(uploadsDir(), 'avatars');
const diskPath = (publicPath: string) =>
  path.join(avatarsDir(), path.basename(publicPath));
const avatarFiles = () => readdir(avatarsDir()).catch(() => [] as string[]);
const exists = (p: string) =>
  stat(p).then(
    () => true,
    () => false,
  );

describe('ảnh đại diện', () => {
  let app: INestApplication;
  const http = () => request(app.getHttpServer());
  beforeAll(async () => {
    app = await createTestApp();
  });
  beforeEach(() => rm(uploadsDir(), { recursive: true, force: true }));
  afterAll(async () => {
    await app.close();
    await rm(uploadsDir(), { recursive: true, force: true });
  });

  it('thư mục upload của test là thư mục tạm, không phải api/uploads', () => {
    expect(path.resolve(uploadsDir())).not.toBe(path.resolve('uploads'));
  });

  async function family() {
    const ong = await createMember(db, {
      fullName: 'VŨ VĂN ÔNG',
      gender: 'MALE',
    });
    const bo = await createMember(db, {
      fullName: 'VŨ VĂN BỐ',
      gender: 'MALE',
      generation: 2,
      fatherId: ong.id,
    });
    const me = await createMember(db, {
      fullName: 'VŨ VĂN TÔI',
      gender: 'MALE',
      generation: 3,
      fatherId: bo.id,
    });
    const bac = await createMember(db, {
      fullName: 'VŨ VĂN BÁC',
      gender: 'MALE',
      generation: 2,
      fatherId: ong.id,
    });
    return { ong, bo, me, bac };
  }

  const upload = (id: number | string, cookie: string, buf = PNG) =>
    http()
      .post(`/api/members/${id}/avatar`)
      .set('Cookie', cookie)
      .attach('file', buf, { filename: 'a.png', contentType: 'image/png' });

  const avatarOf = async (id: number) =>
    (await db.member.findUniqueOrThrow({ where: { id } })).avatarPath;

  describe('POST /api/members/:id/avatar', () => {
    it('admin upload PNG → 200, file nằm trong uploadsDir, DB khớp', async () => {
      const f = await family();
      const admin = await loginAs(db, { role: 'ADMIN' });
      const res = await upload(f.me.id, admin.cookie);
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        avatarPath: expect.stringMatching(AVATAR_PATH),
      });
      expect(res.body.avatarPath).toMatch(
        new RegExp(`^/uploads/avatars/${f.me.id}-`),
      );
      expect(await exists(diskPath(res.body.avatarPath))).toBe(true);
      expect(await avatarOf(f.me.id)).toBe(res.body.avatarPath);
    });

    it('JPEG → đuôi .jpg dù tên file/mimetype nói là PNG', async () => {
      const f = await family();
      const admin = await loginAs(db, { role: 'ADMIN' });
      const res = await upload(f.me.id, admin.cookie, JPG);
      expect(res.status).toBe(200);
      expect(res.body.avatarPath).toMatch(/\.jpg$/);
    });

    it('upload lần 2 → file cũ bị xóa, file mới còn', async () => {
      const f = await family();
      const admin = await loginAs(db, { role: 'ADMIN' });
      const first = (await upload(f.me.id, admin.cookie)).body.avatarPath;
      const second = (await upload(f.me.id, admin.cookie)).body.avatarPath;
      expect(second).not.toBe(first);
      expect(await exists(diskPath(first))).toBe(false);
      expect(await exists(diskPath(second))).toBe(true);
      expect(await avatarOf(f.me.id)).toBe(second);
      expect(await avatarFiles()).toHaveLength(1);
    });

    it('member liên kết upload cho chính mình và cho bố → 200', async () => {
      const f = await family();
      const member = await loginAs(db, { memberId: f.me.id });
      expect((await upload(f.me.id, member.cookie)).status).toBe(200);
      const res = await upload(f.bo.id, member.cookie);
      expect(res.status).toBe(200);
      expect(await avatarOf(f.bo.id)).toBe(res.body.avatarPath);
    });

    it('member liên kết, người không phải người thân → 403, không ghi file', async () => {
      const f = await family();
      const member = await loginAs(db, { memberId: f.me.id });
      for (const id of [f.bac.id, f.ong.id]) {
        const res = await upload(id, member.cookie);
        expect(res.status).toBe(403);
        expect(res.body).toEqual(FORBIDDEN);
      }
      expect(await avatarFiles()).toEqual([]);
      expect(await avatarOf(f.bac.id)).toBeNull();
    });

    it('tài khoản chưa liên kết → 403, không ghi file', async () => {
      const f = await family();
      const unlinked = await loginAs(db);
      const res = await upload(f.me.id, unlinked.cookie);
      expect(res.status).toBe(403);
      expect(res.body).toEqual(FORBIDDEN);
      expect(await avatarFiles()).toEqual([]);
    });

    it('chưa đăng nhập → 401, không ghi file', async () => {
      const f = await family();
      const res = await http()
        .post(`/api/members/${f.me.id}/avatar`)
        .attach('file', PNG, 'a.png');
      expect(res.status).toBe(401);
      expect(await avatarFiles()).toEqual([]);
    });

    it('không gửi file (kể cả gửi JSON) → 400 errors.file', async () => {
      const f = await family();
      const admin = await loginAs(db, { role: 'ADMIN' });
      const empty = await http()
        .post(`/api/members/${f.me.id}/avatar`)
        .set('Cookie', admin.cookie);
      expect(empty.status).toBe(400);
      expect(empty.body).toEqual(NO_FILE);
      const json = await http()
        .post(`/api/members/${f.me.id}/avatar`)
        .set('Cookie', admin.cookie)
        .send({ file: 'x' });
      expect(json.status).toBe(400);
      expect(json.body).toEqual(NO_FILE);
    });

    it('multipart sai tên trường hoặc nhiều file → 400 tiếng Việt, không ghi file', async () => {
      const f = await family();
      const admin = await loginAs(db, { role: 'ADMIN' });
      const wrongField = await http()
        .post(`/api/members/${f.me.id}/avatar`)
        .set('Cookie', admin.cookie)
        .attach('avatar', PNG, 'a.png');
      expect(wrongField.status).toBe(400);
      expect(wrongField.body).toEqual(NO_FILE);
      const twoFiles = await http()
        .post(`/api/members/${f.me.id}/avatar`)
        .set('Cookie', admin.cookie)
        .attach('file', PNG, 'a.png')
        .attach('file', PNG, 'b.png');
      expect(twoFiles.status).toBe(400);
      expect(twoFiles.body).toEqual(NO_FILE);
      expect(await avatarFiles()).toEqual([]);
    });

    it('GIF / SVG đổi tên .png → 400 errors.file, không ghi file', async () => {
      const f = await family();
      const admin = await loginAs(db, { role: 'ADMIN' });
      for (const buf of [
        Buffer.from('GIF89a......'),
        Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'),
      ]) {
        const res = await upload(f.me.id, admin.cookie, buf);
        expect(res.status).toBe(400);
        expect(res.body).toEqual(BAD_TYPE);
      }
      expect(await avatarFiles()).toEqual([]);
      expect(await avatarOf(f.me.id)).toBeNull();
    });

    it('đúng 5 MB → 200; 5 MB + 1 byte → 413, không ghi file', async () => {
      const f = await family();
      const admin = await loginAs(db, { role: 'ADMIN' });
      const big = Buffer.alloc(MAX_AVATAR_BYTES + 1);
      PNG.copy(big);
      const tooBig = await upload(f.me.id, admin.cookie, big);
      expect(tooBig.status).toBe(413);
      expect(tooBig.body).toEqual({ message: 'Ảnh tối đa 5 MB.' });
      expect(await avatarFiles()).toEqual([]);
      expect(await avatarOf(f.me.id)).toBeNull();

      const ok = await upload(
        f.me.id,
        admin.cookie,
        big.subarray(0, MAX_AVATAR_BYTES),
      );
      expect(ok.status).toBe(200);
    });

    it('id không tồn tại hoặc sai dạng → 404, không ghi file', async () => {
      const admin = await loginAs(db, { role: 'ADMIN' });
      for (const id of ['999999', 'abc', '0', '-1', '99999999999']) {
        const res = await upload(id, admin.cookie);
        expect(res.status).toBe(404);
        expect(res.body).toEqual(NOT_FOUND);
      }
      // Sai id được kiểm trước khi kiểm có file hay không.
      const noFile = await http()
        .post('/api/members/abc/avatar')
        .set('Cookie', admin.cookie);
      expect(noFile.status).toBe(404);
      expect(await avatarFiles()).toEqual([]);
    });

    it('ghi DB lỗi sau khi đã lưu file → file vừa lưu bị xóa, ảnh cũ giữ nguyên', async () => {
      const f = await family();
      const admin = { id: 1, role: 'ADMIN' as const, memberId: null };
      const old = await setAvatar(db, admin, f.me.id, PNG);
      // Trigger thật trên Postgres làm UPDATE avatarPath thất bại (không mock DB).
      await db.$executeRawUnsafe(
        `CREATE FUNCTION avatar_fail() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'avatar_fail'; END $$`,
      );
      await db.$executeRawUnsafe(
        `CREATE TRIGGER avatar_fail BEFORE UPDATE OF "avatarPath" ON "Member" FOR EACH ROW EXECUTE FUNCTION avatar_fail()`,
      );
      try {
        await expect(setAvatar(db, admin, f.me.id, JPG)).rejects.toThrow(
          /avatar_fail/,
        );
      } finally {
        await db.$executeRawUnsafe(`DROP TRIGGER avatar_fail ON "Member"`);
        await db.$executeRawUnsafe(`DROP FUNCTION avatar_fail()`);
      }
      expect(await avatarFiles()).toEqual([path.basename(old.avatarPath)]);
      expect(await avatarOf(f.me.id)).toBe(old.avatarPath);
    });
  });

  describe('DELETE /api/members/:id/avatar', () => {
    async function withAvatar(id: number) {
      const admin = await loginAs(db, { role: 'ADMIN' });
      return (await upload(id, admin.cookie)).body.avatarPath as string;
    }

    it('admin → 204, file bị xóa, DB null', async () => {
      const f = await family();
      const p = await withAvatar(f.me.id);
      const admin = await loginAs(db, { role: 'ADMIN' });
      const res = await http()
        .delete(`/api/members/${f.me.id}/avatar`)
        .set('Cookie', admin.cookie);
      expect(res.status).toBe(204);
      expect(await exists(diskPath(p))).toBe(false);
      expect(await avatarOf(f.me.id)).toBeNull();
    });

    it('member liên kết xóa ảnh của bố → 204', async () => {
      const f = await family();
      const p = await withAvatar(f.bo.id);
      const member = await loginAs(db, { memberId: f.me.id });
      const res = await http()
        .delete(`/api/members/${f.bo.id}/avatar`)
        .set('Cookie', member.cookie);
      expect(res.status).toBe(204);
      expect(await exists(diskPath(p))).toBe(false);
      expect(await avatarOf(f.bo.id)).toBeNull();
    });

    it('người chưa có ảnh → 204', async () => {
      const f = await family();
      const admin = await loginAs(db, { role: 'ADMIN' });
      const res = await http()
        .delete(`/api/members/${f.me.id}/avatar`)
        .set('Cookie', admin.cookie);
      expect(res.status).toBe(204);
    });

    it('không phải người thân / chưa liên kết → 403; chưa đăng nhập → 401; file còn nguyên', async () => {
      const f = await family();
      const p = await withAvatar(f.bac.id);
      const member = await loginAs(db, { memberId: f.me.id });
      const unlinked = await loginAs(db);
      for (const u of [member, unlinked]) {
        const res = await http()
          .delete(`/api/members/${f.bac.id}/avatar`)
          .set('Cookie', u.cookie);
        expect(res.status).toBe(403);
        expect(res.body).toEqual(FORBIDDEN);
      }
      const anon = await http().delete(`/api/members/${f.bac.id}/avatar`);
      expect(anon.status).toBe(401);
      expect(await exists(diskPath(p))).toBe(true);
      expect(await avatarOf(f.bac.id)).toBe(p);
    });

    it('id không tồn tại hoặc sai dạng → 404', async () => {
      const admin = await loginAs(db, { role: 'ADMIN' });
      for (const id of ['999999', 'abc']) {
        const res = await http()
          .delete(`/api/members/${id}/avatar`)
          .set('Cookie', admin.cookie);
        expect(res.status).toBe(404);
        expect(res.body).toEqual(NOT_FOUND);
      }
    });
  });

  it('DELETE /api/members/:id (admin) với người có ảnh → file bị xóa', async () => {
    const f = await family();
    const admin = await loginAs(db, { role: 'ADMIN' });
    const p = (await upload(f.me.id, admin.cookie)).body.avatarPath as string;
    const res = await http()
      .delete(`/api/members/${f.me.id}`)
      .set('Cookie', admin.cookie);
    expect(res.status).toBe(204);
    expect(await exists(diskPath(p))).toBe(false);
  });

  it('DELETE /api/members/:id bị chặn (409 còn con) → file ảnh còn nguyên', async () => {
    const f = await family();
    const admin = await loginAs(db, { role: 'ADMIN' });
    const p = (await upload(f.bo.id, admin.cookie)).body.avatarPath as string;
    const res = await http()
      .delete(`/api/members/${f.bo.id}`)
      .set('Cookie', admin.cookie);
    expect(res.status).toBe(409);
    expect(await exists(diskPath(p))).toBe(true);
  });

  describe('removeAvatarFile', () => {
    it('không xóa gì ngoài thư mục avatars (chặn ../)', async () => {
      await mkdir(avatarsDir(), { recursive: true });
      const secret = path.join(uploadsDir(), 'secret.txt');
      const inside = path.join(avatarsDir(), 'keep.png');
      await writeFile(secret, 'x');
      await writeFile(inside, 'x');
      for (const p of [
        '/uploads/avatars/../secret.txt',
        '/uploads/avatars/../../secret.txt',
        '/uploads/avatars/..\\secret.txt',
        '/uploads/avatars/sub/../keep.png',
        '/uploads/secret.txt',
        '/uploads/avatars/',
        '/uploads/avatars/.',
        '/uploads/avatars/..',
        secret,
      ]) {
        await removeAvatarFile(p);
      }
      expect(await exists(secret)).toBe(true);
      expect(await exists(inside)).toBe(true);
    });

    it('null hoặc file không tồn tại → không lỗi', async () => {
      await expect(removeAvatarFile(null)).resolves.toBeUndefined();
      await expect(
        removeAvatarFile('/uploads/avatars/1-0000000000000000.png'),
      ).resolves.toBeUndefined();
    });
  });
});

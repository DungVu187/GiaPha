import { Prisma } from '../generated/prisma/client.js';
import { toSearchName } from '../lib/name.js';
import type { Db, DbClient } from '../prisma/db.js';
import { hashPassword } from './password.js';
import {
  EMAIL_TAKEN,
  USERNAME_TAKEN,
  type RegisterErrors,
  type RegisterInput,
} from './register-input.js';
import type { SessionUser } from './session.js';

export type RegisterMatch = {
  id: number;
  fullName: string;
  generation: number;
  fatherName: string | null;
  motherName: string | null;
  birthYear: number | null;
  birthMonth: number | null;
  birthDay: number | null;
};

export type RegisterResult =
  | { kind: 'invalid'; errors: RegisterErrors }
  | { kind: 'matches'; matches: RegisterMatch[] }
  | { kind: 'claim-unavailable'; matches: RegisterMatch[] }
  | { kind: 'created'; user: SessionUser; claimed: boolean };

class ClaimUnavailable extends Error {}

export async function findClaimableMembers(
  db: DbClient,
  fullName: string,
  generation: number,
): Promise<RegisterMatch[]> {
  const rows = await db.member.findMany({
    where: { fullName, generation, isDeceased: false, user: null },
    orderBy: { id: 'asc' },
    select: {
      id: true,
      fullName: true,
      generation: true,
      birthYear: true,
      birthMonth: true,
      birthDay: true,
      father: { select: { fullName: true } },
      mother: { select: { fullName: true } },
    },
  });
  return rows.map(({ father, mother, ...m }) => ({
    ...m,
    fatherName: father?.fullName ?? null,
    motherName: mother?.fullName ?? null,
  }));
}

async function takenErrors(
  db: Db,
  input: RegisterInput,
): Promise<RegisterErrors | null> {
  const errors: RegisterErrors = {};
  if (await db.user.findUnique({ where: { username: input.username } }))
    errors.username = USERNAME_TAKEN;
  if (
    input.email !== null &&
    (await db.user.findUnique({ where: { email: input.email } }))
  )
    errors.email = EMAIL_TAKEN;
  return Object.keys(errors).length > 0 ? errors : null;
}

const UNIQUE_COLUMNS = ['username', 'email', 'memberId'] as const;

// Cột nào gây vi phạm UNIQUE (P2002). Prisma 7 + adapter-pg không có meta.target;
// tên ràng buộc nằm ở meta.driverAdapterError.cause.constraint.index (`User_<cột>_key`).
// Không dò error.message: nó chứa đoạn mã nơi gọi (có chữ `memberId`) → nhận nhầm cột.
export function uniqueViolationOn(
  error: unknown,
): (typeof UNIQUE_COLUMNS)[number] | null {
  if (
    !(error instanceof Prisma.PrismaClientKnownRequestError) ||
    error.code !== 'P2002'
  )
    return null;
  const meta = JSON.stringify(error.meta ?? {});
  return UNIQUE_COLUMNS.find((c) => meta.includes(`"User_${c}_key"`)) ?? null;
}

export async function register(
  db: Db,
  input: RegisterInput,
): Promise<RegisterResult> {
  const taken = await takenErrors(db, input);
  if (taken) return { kind: 'invalid', errors: taken };

  const { claim } = input;
  if (claim.kind === 'NONE') {
    const matches = await findClaimableMembers(
      db,
      input.fullName,
      input.generation,
    );
    if (matches.length > 0) return { kind: 'matches', matches };
  }

  // Băm trước transaction: argon2 chậm, không giữ transaction mở lâu.
  const passwordHash = await hashPassword(input.password);
  try {
    const user = await db.$transaction(async (tx) => {
      let memberId: number;
      if (claim.kind === 'MEMBER') {
        const claimable = await findClaimableMembers(
          tx,
          input.fullName,
          input.generation,
        );
        if (!claimable.some((m) => m.id === claim.memberId))
          throw new ClaimUnavailable();
        memberId = claim.memberId;
      } else {
        const member = await tx.member.create({
          data: {
            fullName: input.fullName,
            searchName: toSearchName(input.fullName),
            generation: input.generation,
          },
          select: { id: true },
        });
        memberId = member.id;
      }
      return tx.user.create({
        data: {
          username: input.username,
          passwordHash,
          email: input.email,
          memberId,
        },
        select: { id: true, username: true, role: true, memberId: true },
      });
    });
    return { kind: 'created', user, claimed: claim.kind === 'MEMBER' };
  } catch (error) {
    const column = uniqueViolationOn(error);
    if (error instanceof ClaimUnavailable || column === 'memberId')
      return {
        kind: 'claim-unavailable',
        matches: await findClaimableMembers(
          db,
          input.fullName,
          input.generation,
        ),
      };
    if (column === 'username')
      return { kind: 'invalid', errors: { username: USERNAME_TAKEN } };
    if (column === 'email')
      return { kind: 'invalid', errors: { email: EMAIL_TAKEN } };
    throw error;
  }
}

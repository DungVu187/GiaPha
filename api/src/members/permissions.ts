export type Actor = { role: 'ADMIN' | 'MEMBER'; memberId: number | null };
export type DirectRelatives = {
  selfId: number;
  fatherId: number | null;
  motherId: number | null;
  spouseIds: number[];
  childIds: number[];
};

export function directRelativeIds(r: DirectRelatives): Set<number> {
  const ids = new Set<number>([r.selfId, ...r.spouseIds, ...r.childIds]);
  if (r.fatherId !== null) ids.add(r.fatherId);
  if (r.motherId !== null) ids.add(r.motherId);
  return ids;
}

// Spec §5: member đã liên kết chỉ sửa bản thân + người thân trực tiếp; server luôn kiểm lại.
export function canEditMember(
  actor: Actor,
  targetId: number,
  actorRelatives: DirectRelatives | null,
): boolean {
  if (actor.role === 'ADMIN') return true;
  if (
    actor.memberId === null ||
    actorRelatives === null ||
    actorRelatives.selfId !== actor.memberId
  )
    return false;
  return directRelativeIds(actorRelatives).has(targetId);
}

export function canCreateIndependentMember(actor: Actor): boolean {
  return actor.role === 'ADMIN';
}

export function canDeleteMember(actor: Actor): boolean {
  return actor.role === 'ADMIN';
}

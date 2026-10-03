import { requireUser } from "@/lib/current-user";

export default async function DashboardPage() {
  const user = await requireUser();
  return (
    <h1 className="font-heading text-2xl leading-8 font-semibold">Xin chào {user.username}</h1>
  );
}

import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { RegisterFlow } from "./register-flow";

export default async function RegisterPage() {
  if (await getCurrentUser()) redirect("/");
  return (
    <main className="flex flex-1 items-center justify-center px-5 py-10 sm:py-20">
      <RegisterFlow />
    </main>
  );
}

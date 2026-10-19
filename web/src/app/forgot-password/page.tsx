import Link from "next/link";
import { AuthCard } from "@/components/auth-card";
import { apiGet } from "@/lib/api";
import { ForgotFlow } from "./forgot-flow";

export default async function ForgotPasswordPage() {
  const enabled = (await apiGet<{ enabled: boolean }>("/api/auth/password-reset/enabled"))?.enabled ?? false;
  if (!enabled) {
    return (
      <AuthCard title="Quên mật khẩu" description="Chức năng quên mật khẩu chưa được bật. Hãy nhờ quản trị viên dòng họ đặt lại mật khẩu cho bạn.">
        <Link href="/login" className="text-center font-medium text-primary underline underline-offset-4">
          Về trang đăng nhập
        </Link>
      </AuthCard>
    );
  }
  return <ForgotFlow />;
}

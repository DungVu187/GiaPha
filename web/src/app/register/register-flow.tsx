"use client";

import { CircleAlert } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { BrandSeal } from "@/components/brand-seal";
import { MemberAvatar } from "@/components/member-avatar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { normalizeFullName } from "@/lib/name";
import {
  createNewHint,
  GENERATION_OPTIONS,
  interpretRegisterResponse,
  matchBirth,
  matchesIntro,
  NO_INFO,
  REGISTER_FIELDS,
  toRegisterBody,
  type RegisterClaim,
  type RegisterErrors,
  type RegisterMatch,
  type RegisterValues,
} from "@/lib/register-form";

const EMPTY: RegisterValues = { username: "", password: "", fullName: "", generation: "", email: "" };
const CARD = "w-full gap-5 rounded-lg px-6 py-8 text-base ring-0 border border-border shadow-[var(--shadow-card)] sm:p-10";

export function RegisterFlow() {
  const router = useRouter();
  const [values, setValues] = useState<RegisterValues>(EMPTY);
  const [errors, setErrors] = useState<RegisterErrors>({});
  const [alert, setAlert] = useState<string>();
  const [matches, setMatches] = useState<RegisterMatch[] | null>(null);
  const [pending, setPending] = useState(false);

  // Sửa ô nào thì bỏ lỗi của ô đó để gợi ý (vd "Sẽ lưu thành: …") hiện lại.
  const set = (key: keyof RegisterValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setValues((v) => ({ ...v, [key]: e.target.value }));
    setErrors((errs) => (errs[key] ? { ...errs, [key]: undefined } : errs));
  };

  async function submit(claim: RegisterClaim) {
    setPending(true);
    setAlert(undefined);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toRegisterBody(values, claim)),
      });
      const outcome = interpretRegisterResponse(res.status, await res.json().catch(() => null));
      switch (outcome.kind) {
        case "created":
          router.replace("/");
          router.refresh();
          return;
        case "matches":
          setErrors({});
          setMatches(outcome.matches);
          break;
        case "taken":
          setMatches(outcome.matches);
          setAlert(outcome.message);
          break;
        case "field-errors": {
          setMatches(null);
          setErrors(outcome.errors);
          const first = REGISTER_FIELDS.find((f) => outcome.errors[f]);
          // Đợi React vẽ form + lỗi rồi mới focus.
          if (first) setTimeout(() => document.getElementById(first)?.focus());
          break;
        }
        case "error":
          setAlert(outcome.message);
      }
    } catch {
      setAlert("Không kết nối được máy chủ.");
    }
    setPending(false);
  }

  const alertBox = alert && (
    <div
      role="alert"
      className="flex items-center gap-3 rounded-md border border-destructive bg-primary-soft px-4 py-3 font-medium text-destructive"
    >
      <CircleAlert aria-hidden="true" className="size-5 shrink-0" />
      <p>{alert}</p>
    </div>
  );
  const brand = (
    <div className="flex items-center gap-3">
      <BrandSeal className="size-8" />
      <span className="font-heading text-lg font-bold text-primary">GIA PHẢ HỌ VŨ</span>
    </div>
  );

  if (matches !== null) {
    const fullName = matches[0]?.fullName ?? normalizeFullName(values.fullName);
    const generation = Number(values.generation);
    return (
      <Card className={`${CARD} max-w-[680px]`}>
        {brand}
        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-2xl leading-8 font-bold sm:text-[32px] sm:leading-10">
            Phát hiện thành viên đã tồn tại
          </h1>
          <p className="text-muted-foreground">
            {matches.length > 0
              ? matchesIntro(matches.length, fullName, generation)
              : "Không còn hồ sơ nào phù hợp để nhận."}
          </p>
        </div>
        {alertBox}
        {matches.length > 0 && (
          <ul className="flex flex-col gap-3">
            {matches.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center gap-4 rounded-md border border-border bg-muted px-4 py-4"
              >
                <MemberAvatar fullName={m.fullName} avatarPath={null} size="sm" />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-heading text-lg font-semibold">{m.fullName}</span>
                    <span className="rounded bg-accent/20 px-2 text-sm">Đời {m.generation}</span>
                  </p>
                  <p className="text-sm">
                    <span className="text-muted-foreground">Bố: </span>
                    {m.fatherName ?? NO_INFO}
                  </p>
                  <p className="text-sm">
                    <span className="text-muted-foreground">Mẹ: </span>
                    {m.motherName ?? NO_INFO}
                  </p>
                  <p className="text-sm">
                    <span className="text-muted-foreground">Ngày sinh: </span>
                    {matchBirth(m)}
                  </p>
                </div>
                <Button disabled={pending} onClick={() => submit(m.id)}>
                  Đây là tôi
                </Button>
              </li>
            ))}
          </ul>
        )}
        <div className="flex flex-col gap-3 border-t border-border pt-5">
          <h2 className="font-heading text-lg font-semibold">Không phải bạn?</h2>
          <p className="text-sm text-muted-foreground">{createNewHint(fullName, generation)}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" disabled={pending} onClick={() => submit("NEW")}>
              Tạo thành viên mới
            </Button>
            <Button
              variant="link"
              disabled={pending}
              onClick={() => {
                setMatches(null);
                setAlert(undefined);
              }}
            >
              Sửa thông tin đăng ký
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  const field = (id: keyof RegisterValues, label: string, hint: string, input: React.ReactNode) => (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id}>{label}</Label>
      {input}
      {errors[id] ? (
        <p id={`${id}-error`} className="text-sm font-medium text-destructive">
          {errors[id]}
        </p>
      ) : (
        <p id={`${id}-hint`} className="text-sm text-muted-foreground">
          {hint}
        </p>
      )}
    </div>
  );
  const aria = (id: keyof RegisterValues) => ({
    "aria-invalid": errors[id] ? true : undefined,
    "aria-describedby": errors[id] ? `${id}-error` : `${id}-hint`,
  });
  const preview = normalizeFullName(values.fullName);

  return (
    <Card className={`${CARD} max-w-[480px]`}>
      {brand}
      <div className="flex flex-col gap-2">
        <h1 className="font-heading text-2xl leading-8 font-bold sm:text-[32px] sm:leading-10">Đăng ký tài khoản</h1>
        <p className="text-muted-foreground">
          Đăng ký xong là xem được ngay toàn bộ gia phả. Nếu bạn đã có tên trong gia phả, hệ thống sẽ giúp bạn nhận
          đúng hồ sơ.
        </p>
      </div>
      {alertBox}
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit(null);
        }}
        className="flex flex-col gap-5"
      >
        {field(
          "username",
          "Tên đăng nhập",
          "Dùng để đăng nhập, không trùng với người khác.",
          <Input
            id="username"
            name="username"
            autoComplete="username"
            value={values.username}
            onChange={set("username")}
            {...aria("username")}
          />,
        )}
        {field(
          "password",
          "Mật khẩu",
          "Ít nhất 8 ký tự.",
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            value={values.password}
            onChange={set("password")}
            {...aria("password")}
          />,
        )}
        {field(
          "fullName",
          "Họ và tên",
          preview ? `Sẽ lưu thành: ${preview}` : "Họ tên sẽ được viết IN HOA.",
          <Input
            id="fullName"
            name="fullName"
            autoComplete="name"
            value={values.fullName}
            onChange={set("fullName")}
            {...aria("fullName")}
          />,
        )}
        {field(
          "generation",
          "Đời",
          "Đời của bạn trong dòng họ (cụ tổ là Đời 1).",
          <select
            id="generation"
            name="generation"
            value={values.generation}
            onChange={set("generation")}
            {...aria("generation")}
            className="h-12 rounded-md border border-input bg-card px-3 text-base outline-none focus-visible:border-2 focus-visible:border-ring aria-invalid:border-destructive"
          >
            <option value="">Chọn đời</option>
            {GENERATION_OPTIONS.map((g) => (
              <option key={g} value={g}>
                Đời {g}
              </option>
            ))}
          </select>,
        )}
        {field(
          "email",
          "Email (không bắt buộc)",
          "Dùng để lấy lại mật khẩu khi quên.",
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="ten@email.com"
            value={values.email}
            onChange={set("email")}
            {...aria("email")}
          />,
        )}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Đang đăng ký..." : "Đăng ký"}
        </Button>
      </form>
      <p className="text-center text-muted-foreground">
        Đã có tài khoản?{" "}
        <Link href="/login" className="font-medium text-primary underline underline-offset-4">
          Đăng nhập
        </Link>
      </p>
    </Card>
  );
}

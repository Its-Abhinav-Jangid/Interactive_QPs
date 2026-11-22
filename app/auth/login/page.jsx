import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/supabase/server";
import { LoginForm } from "@/components/auth/login-form";

export const metadata = {
  title: "Sign in",
};

export default async function LoginPage({ searchParams }) {
  const params = (await searchParams) || {};
  const { user } = await getCurrentUser();

  const next =
    typeof params.next === "string" && params.next.startsWith("/")
      ? params.next
      : "/";

  if (user) redirect(next);

  return (
    <LoginForm
      next={next}
      initialError={typeof params.error === "string" ? params.error : null}
    />
  );
}

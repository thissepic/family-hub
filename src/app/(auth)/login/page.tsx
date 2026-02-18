import { redirect } from "next/navigation";
import { getSession, isFullSession, isFamilySession } from "@/lib/auth";
import { db } from "@/lib/db";
import { AccountLoginScreen } from "@/components/auth/account-login-screen";

function safeRedirect(url: string | undefined | null): string | undefined {
  if (url && url.startsWith("/") && !url.startsWith("//")) return url;
  return undefined;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
  // If no user exists, redirect to setup
  const userCount = await db.user.count();
  if (userCount === 0) {
    redirect("/setup");
  }

  const { redirect: redirectParam } = await searchParams;
  const redirectTo = safeRedirect(redirectParam);

  const session = await getSession();

  // Has user session → redirect based on level (use redirectTo if available)
  if (session?.userId) {
    if (redirectTo) {
      redirect(redirectTo);
    }
    if (isFullSession(session)) {
      redirect("/");
    }
    if (isFamilySession(session)) {
      redirect("/profiles");
    }
    redirect("/families");
  }

  return <AccountLoginScreen redirectTo={redirectTo} />;
}

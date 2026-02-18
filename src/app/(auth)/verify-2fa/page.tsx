import { redirect } from "next/navigation";
import { getSession, isFullSession } from "@/lib/auth";
import { TwoFactorVerifyScreen } from "@/components/auth/two-factor-verify-screen";

function safeRedirect(url: string | undefined | null): string | undefined {
  if (url && url.startsWith("/") && !url.startsWith("//")) return url;
  return undefined;
}

export default async function Verify2FAPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; redirect?: string }>;
}) {
  const session = await getSession();
  const { token, redirect: redirectParam } = await searchParams;
  const redirectTo = safeRedirect(redirectParam);

  // Already has account session → go to profile selection
  if (session?.familyId && !isFullSession(session)) {
    redirect(redirectTo || "/profiles");
  }

  // Fully logged in → go to dashboard
  if (session && isFullSession(session)) {
    redirect(redirectTo || "/");
  }

  if (!token) {
    redirect("/login");
  }

  return <TwoFactorVerifyScreen token={token} redirectTo={redirectTo} />;
}

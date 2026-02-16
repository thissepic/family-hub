import { redirect } from "next/navigation";
import { getSession, isFullSession } from "@/lib/auth";
import { TwoFactorVerifyScreen } from "@/components/auth/two-factor-verify-screen";

export default async function Verify2FAPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const session = await getSession();

  // Already has account session → go to profile selection
  if (session?.familyId && !isFullSession(session)) {
    redirect("/profiles");
  }

  // Fully logged in → go to dashboard
  if (session && isFullSession(session)) {
    redirect("/");
  }

  const { token } = await searchParams;
  if (!token) {
    redirect("/login");
  }

  return <TwoFactorVerifyScreen token={token} />;
}

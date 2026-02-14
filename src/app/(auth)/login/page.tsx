import { redirect } from "next/navigation";
import { getSession, isFullSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { AccountLoginScreen } from "@/components/auth/account-login-screen";

export default async function LoginPage() {
  // If no family exists, redirect to setup
  const familyCount = await db.family.count();
  if (familyCount === 0) {
    redirect("/setup");
  }

  const session = await getSession();

  // Has account session but no profile → go to profile selection
  if (session?.familyId && !isFullSession(session)) {
    redirect("/profiles");
  }

  // Fully logged in → go to dashboard
  if (session && isFullSession(session)) {
    redirect("/");
  }

  return <AccountLoginScreen />;
}

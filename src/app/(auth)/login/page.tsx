import { redirect } from "next/navigation";
import { getSession, isFullSession, isFamilySession } from "@/lib/auth";
import { db } from "@/lib/db";
import { AccountLoginScreen } from "@/components/auth/account-login-screen";

export default async function LoginPage() {
  // If no user exists, redirect to setup
  const userCount = await db.user.count();
  if (userCount === 0) {
    redirect("/setup");
  }

  const session = await getSession();

  // Has user session → redirect based on level
  if (session?.userId) {
    if (isFullSession(session)) {
      redirect("/");
    }
    if (isFamilySession(session)) {
      redirect("/profiles");
    }
    // User-level only → go to family selector
    redirect("/families");
  }

  return <AccountLoginScreen />;
}

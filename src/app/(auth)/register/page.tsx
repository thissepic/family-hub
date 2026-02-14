import { redirect } from "next/navigation";
import { getSession, isFullSession } from "@/lib/auth";
import { RegisterWizard } from "@/components/auth/register-wizard";

export default async function RegisterPage() {
  const session = await getSession();

  // Has account session but no profile → go to profile selection
  if (session?.familyId && !isFullSession(session)) {
    redirect("/profiles");
  }

  // Fully logged in → go to dashboard
  if (session && isFullSession(session)) {
    redirect("/");
  }

  return <RegisterWizard />;
}

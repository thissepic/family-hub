import { redirect } from "next/navigation";
import { getSession, isFullSession, isFamilySession } from "@/lib/auth";
import { RegisterWizard } from "@/components/auth/register-wizard";

export default async function RegisterPage() {
  const session = await getSession();

  // Has user session → redirect based on level
  if (session?.userId) {
    if (isFullSession(session)) {
      redirect("/");
    }
    if (isFamilySession(session)) {
      redirect("/profiles");
    }
    redirect("/families");
  }

  return <RegisterWizard />;
}

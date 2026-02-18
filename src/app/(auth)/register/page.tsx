import { redirect } from "next/navigation";
import { getSession, isFullSession, isFamilySession } from "@/lib/auth";
import { RegisterWizard } from "@/components/auth/register-wizard";

function safeRedirect(url: string | undefined | null): string | undefined {
  if (url && url.startsWith("/") && !url.startsWith("//")) return url;
  return undefined;
}

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect?: string }>;
}) {
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

  return <RegisterWizard redirectTo={redirectTo} />;
}

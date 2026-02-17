import { redirect } from "next/navigation";
import { getSession, isFullSession, isFamilySession } from "@/lib/auth";
import { FamilySelectorScreen } from "@/components/auth/family-selector-screen";

export default async function FamiliesPage() {
  const session = await getSession();

  // No user session → login first
  if (!session?.userId) {
    redirect("/login");
  }

  // Already have full session → go to dashboard
  if (isFullSession(session)) {
    redirect("/");
  }

  // Family selected but no member → go to profile selection
  if (isFamilySession(session)) {
    redirect("/profiles");
  }

  return <FamilySelectorScreen />;
}

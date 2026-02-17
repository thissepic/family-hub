import { redirect } from "next/navigation";
import { getSession, isFullSession } from "@/lib/auth";
import { CreateFamilyWizard } from "@/components/family/create-family-wizard";

export default async function CreateFamilyPage() {
  const session = await getSession();

  // No user session → login first
  if (!session?.userId) {
    redirect("/login");
  }

  // Already have full session → go to dashboard
  if (isFullSession(session)) {
    redirect("/");
  }

  return <CreateFamilyWizard />;
}

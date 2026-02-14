import { redirect } from "next/navigation";
import { getSession, isFullSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { ProfileSelectionScreen } from "@/components/auth/profile-selection-screen";

export default async function ProfilesPage() {
  // If no family exists, redirect to setup
  const familyCount = await db.family.count();
  if (familyCount === 0) {
    redirect("/setup");
  }

  const session = await getSession();

  // No account session → login first
  if (!session?.familyId) {
    redirect("/login");
  }

  // Already have a full session → go to dashboard
  if (isFullSession(session)) {
    redirect("/");
  }

  return <ProfileSelectionScreen />;
}

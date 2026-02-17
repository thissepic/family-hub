import { redirect } from "next/navigation";
import { getSession, isFullSession, isFamilySession } from "@/lib/auth";
import { ProfileSelectionScreen } from "@/components/auth/profile-selection-screen";

export default async function ProfilesPage() {
  const session = await getSession();

  // No user session → login first
  if (!session?.userId) {
    redirect("/login");
  }

  // No family selected → go to family selector
  if (!isFamilySession(session)) {
    redirect("/families");
  }

  // Already have a full session → go to dashboard
  if (isFullSession(session)) {
    redirect("/");
  }

  return <ProfileSelectionScreen />;
}

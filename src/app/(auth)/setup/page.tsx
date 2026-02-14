import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { SetupWizard } from "@/components/setup/setup-wizard";

export default async function SetupPage() {
  // If family already exists, redirect to login
  const familyCount = await db.family.count();
  if (familyCount > 0) {
    redirect("/login");
  }

  return <SetupWizard />;
}

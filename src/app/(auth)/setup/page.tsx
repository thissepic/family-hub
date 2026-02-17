import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { SetupWizard } from "@/components/setup/setup-wizard";

export default async function SetupPage() {
  // If any user already exists, redirect to login
  const userCount = await db.user.count();
  if (userCount > 0) {
    redirect("/login");
  }

  return <SetupWizard />;
}

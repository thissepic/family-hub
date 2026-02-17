import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AccountSettings } from "@/components/account/account-settings";

export default async function AccountPage() {
  const session = await getSession();

  if (!session?.userId) {
    redirect("/login");
  }

  return <AccountSettings />;
}

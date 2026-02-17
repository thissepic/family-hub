import { getSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { AuthToolbar } from "@/components/auth/auth-toolbar";
import { UserToolbar } from "@/components/auth/user-toolbar";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();

  let userEmail: string | null = null;
  if (session?.userId) {
    const user = await db.user.findUnique({
      where: { id: session.userId },
      select: { email: true },
    });
    userEmail = user?.email ?? null;
  }

  return (
    <>
      {userEmail ? (
        <UserToolbar userEmail={userEmail} />
      ) : (
        <AuthToolbar />
      )}
      {children}
    </>
  );
}

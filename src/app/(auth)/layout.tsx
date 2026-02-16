import { AuthToolbar } from "@/components/auth/auth-toolbar";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <>
      <AuthToolbar />
      {children}
    </>
  );
}

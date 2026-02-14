import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Family Hub Display",
  description: "Always-on family dashboard for TV or tablet",
};

export default function HubLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      {children}
    </div>
  );
}

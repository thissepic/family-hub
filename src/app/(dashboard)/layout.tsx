"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/top-nav";
import { BottomNav } from "@/components/layout/bottom-nav";
import { MobileSheet } from "@/components/layout/mobile-sheet";
import { CommandPalette } from "@/components/search/command-palette";
import { EmailVerificationBanner } from "@/components/layout/email-verification-banner";
import { useTRPC } from "@/lib/trpc/client";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const trpc = useTRPC();

  const { data: session } = useQuery(trpc.auth.getSession.queryOptions());

  // Fetch member details for the top nav
  const { data: membersList } = useQuery(trpc.members.list.queryOptions());
  const currentMember = membersList?.find(
    (m) => m.id === session?.memberId
  );

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col min-w-0">
        <TopNav
          onSearchOpen={() => setSearchOpen(true)}
          memberName={currentMember?.name}
          memberColor={currentMember?.color}
          memberAvatar={currentMember?.avatar}
        />
        <EmailVerificationBanner />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 pb-20 md:pb-6">
          {children}
        </main>
        <BottomNav onMoreOpen={() => setMobileSheetOpen(true)} />
      </div>
      <MobileSheet
        open={mobileSheetOpen}
        onOpenChange={setMobileSheetOpen}
      />
      <CommandPalette open={searchOpen} onOpenChange={setSearchOpen} />
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Sidebar } from "@/components/layout/sidebar";
import { TopNav } from "@/components/layout/top-nav";
import { BottomNav } from "@/components/layout/bottom-nav";
import { MobileSheet } from "@/components/layout/mobile-sheet";
import { CommandPalette } from "@/components/search/command-palette";
import { EmailVerificationBanner } from "@/components/layout/email-verification-banner";
import { Button } from "@/components/ui/button";
import { ArrowLeftRight } from "lucide-react";
import { useTRPC } from "@/lib/trpc/client";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const trpc = useTRPC();
  const tAuth = useTranslations("auth");
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: session } = useQuery(trpc.auth.getSession.queryOptions());

  // Fetch member details for the top nav
  const { data: membersList } = useQuery(trpc.members.list.queryOptions());
  const currentMember = membersList?.find(
    (m) => m.id === session?.memberId
  );

  // Impersonation state
  const isImpersonating =
    !!session?.originalMemberId &&
    session.originalMemberId !== session.memberId;

  const switchBackMutation = useMutation(
    trpc.auth.selectProfile.mutationOptions({
      onSuccess: () => {
        queryClient.clear();
        router.push("/");
        router.refresh();
      },
    })
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
        {isImpersonating && (
          <div className="bg-amber-100 dark:bg-amber-900/50 text-amber-800 dark:text-amber-200 text-sm py-2 px-4 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ArrowLeftRight className="h-4 w-4 shrink-0" />
              <span>{tAuth("impersonating", { name: currentMember?.name ?? "" })}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              className="text-amber-800 dark:text-amber-200 hover:text-amber-900 dark:hover:text-amber-100 shrink-0"
              onClick={() =>
                switchBackMutation.mutate({
                  memberId: session.originalMemberId!,
                })
              }
              disabled={switchBackMutation.isPending}
            >
              {tAuth("switchBack")}
            </Button>
          </div>
        )}
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

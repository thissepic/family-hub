"use client";

import { Bell, Search, LogOut, User, ArrowLeftRight } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useTRPC } from "@/lib/trpc/client";

interface TopNavProps {
  onSearchOpen: () => void;
  memberName?: string;
  memberColor?: string;
  memberAvatar?: string | null;
}

export function TopNav({ onSearchOpen, memberName, memberColor, memberAvatar }: TopNavProps) {
  const t = useTranslations("nav");
  const tAuth = useTranslations("auth");
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const switchProfileMutation = useMutation(
    trpc.auth.switchProfile.mutationOptions({
      onSuccess: () => {
        queryClient.clear();
        router.push("/profiles");
        router.refresh();
      },
    })
  );

  const logoutMutation = useMutation(
    trpc.auth.logout.mutationOptions({
      onSuccess: () => {
        queryClient.clear();
        router.push("/login");
        router.refresh();
      },
    })
  );

  const { data: unreadCount } = useQuery(
    trpc.notifications.unreadCount.queryOptions()
  );

  const initials = memberName
    ? memberName
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  return (
    <header className="flex h-14 items-center border-b px-4 gap-2">
      <div className="md:hidden flex items-center gap-2 font-semibold">
        <span className="text-xl">🏠</span>
        <span>Family Hub</span>
      </div>

      <div className="flex-1" />

      <Button variant="ghost" size="icon" onClick={onSearchOpen}>
        <Search className="h-4 w-4" />
        <span className="sr-only">{t("searchPlaceholder")}</span>
      </Button>

      <Button
        variant="ghost"
        size="icon"
        className="relative"
        onClick={() => router.push("/notifications")}
      >
        <Bell className="h-4 w-4" />
        <span className="sr-only">{t("notifications")}</span>
        {typeof unreadCount === "number" && unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground flex items-center justify-center px-1">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      <ThemeToggle />

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="rounded-full">
            <Avatar className="h-8 w-8">
              <AvatarFallback
                style={{ backgroundColor: memberColor || "#3b82f6" }}
                className="text-white text-xs"
              >
                {memberAvatar || initials}
              </AvatarFallback>
            </Avatar>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => router.push("/settings")}>
            <User className="mr-2 h-4 w-4" />
            {t("settings")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => switchProfileMutation.mutate()}>
            <ArrowLeftRight className="mr-2 h-4 w-4" />
            {tAuth("switchProfile")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => logoutMutation.mutate()}>
            <LogOut className="mr-2 h-4 w-4" />
            {tAuth("logout")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}

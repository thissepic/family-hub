"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Home, Calendar, CheckSquare, RotateCcw, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";

const bottomNavItems = [
  { href: "/", icon: Home, labelKey: "home" as const },
  { href: "/calendar", icon: Calendar, labelKey: "calendar" as const },
  { href: "/tasks", icon: CheckSquare, labelKey: "tasks" as const },
  { href: "/chores", icon: RotateCcw, labelKey: "chores" as const },
];

interface BottomNavProps {
  onMoreOpen: () => void;
}

export function BottomNav({ onMoreOpen }: BottomNavProps) {
  const pathname = usePathname();
  const t = useTranslations("nav");

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t bg-background">
      <div className="flex items-center justify-around h-14">
        {bottomNavItems.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname.startsWith(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-0.5 px-3 py-1 text-xs transition-colors",
                isActive
                  ? "text-foreground"
                  : "text-muted-foreground"
              )}
            >
              <item.icon className="h-5 w-5" />
              <span>{t(item.labelKey)}</span>
            </Link>
          );
        })}
        <button
          onClick={onMoreOpen}
          className="flex flex-col items-center gap-0.5 px-3 py-1 text-xs text-muted-foreground"
        >
          <MoreHorizontal className="h-5 w-5" />
          <span>{t("more")}</span>
        </button>
      </div>
    </nav>
  );
}

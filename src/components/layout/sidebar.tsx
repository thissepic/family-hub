"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Home,
  Calendar,
  CheckSquare,
  RotateCcw,
  ShoppingCart,
  UtensilsCrossed,
  StickyNote,
  Trophy,
  Activity,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollArea } from "@/components/ui/scroll-area";

const navItems = [
  { href: "/", icon: Home, labelKey: "home" as const },
  { href: "/calendar", icon: Calendar, labelKey: "calendar" as const },
  { href: "/tasks", icon: CheckSquare, labelKey: "tasks" as const },
  { href: "/chores", icon: RotateCcw, labelKey: "chores" as const },
  { href: "/shopping", icon: ShoppingCart, labelKey: "shopping" as const },
  { href: "/meals", icon: UtensilsCrossed, labelKey: "meals" as const },
  { href: "/notes", icon: StickyNote, labelKey: "notes" as const },
  { href: "/rewards", icon: Trophy, labelKey: "rewards" as const },
  { href: "/activity", icon: Activity, labelKey: "activity" as const },
  { href: "/settings", icon: Settings, labelKey: "settings" as const },
];

export function Sidebar() {
  const pathname = usePathname();
  const t = useTranslations("nav");

  return (
    <aside className="hidden md:flex md:w-60 md:flex-col md:border-r bg-background">
      <div className="flex h-14 items-center border-b px-4">
        <Link href="/" className="flex items-center gap-2 font-semibold text-lg">
          <span className="text-2xl">🏠</span>
          <span>Family Hub</span>
        </Link>
      </div>
      <ScrollArea className="flex-1 py-2">
        <nav className="flex flex-col gap-1 px-2">
          {navItems.map((item) => {
            const isActive =
              item.href === "/"
                ? pathname === "/"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                {t(item.labelKey)}
              </Link>
            );
          })}
        </nav>
      </ScrollArea>
    </aside>
  );
}

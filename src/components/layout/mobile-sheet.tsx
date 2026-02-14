"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  ShoppingCart,
  UtensilsCrossed,
  StickyNote,
  Trophy,
  Activity,
  Bell,
  Settings,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

const moreNavItems = [
  { href: "/shopping", icon: ShoppingCart, labelKey: "shopping" as const },
  { href: "/meals", icon: UtensilsCrossed, labelKey: "meals" as const },
  { href: "/notes", icon: StickyNote, labelKey: "notes" as const },
  { href: "/rewards", icon: Trophy, labelKey: "rewards" as const },
  { href: "/activity", icon: Activity, labelKey: "activity" as const },
  { href: "/notifications", icon: Bell, labelKey: "notifications" as const },
  { href: "/settings", icon: Settings, labelKey: "settings" as const },
];

interface MobileSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileSheet({ open, onOpenChange }: MobileSheetProps) {
  const pathname = usePathname();
  const t = useTranslations("nav");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-auto max-h-[60vh]">
        <SheetHeader>
          <SheetTitle>{t("more")}</SheetTitle>
        </SheetHeader>
        <nav className="grid grid-cols-3 gap-2 py-4">
          {moreNavItems.map((item) => {
            const isActive = pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => onOpenChange(false)}
                className={cn(
                  "flex flex-col items-center gap-2 rounded-lg p-3 text-sm transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                )}
              >
                <item.icon className="h-5 w-5" />
                <span>{t(item.labelKey)}</span>
              </Link>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}

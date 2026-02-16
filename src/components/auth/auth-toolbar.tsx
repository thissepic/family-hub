"use client";

import { ThemeToggle } from "@/components/ui/theme-toggle";
import { LanguageSwitcher } from "@/components/ui/language-switcher";

export function AuthToolbar() {
  return (
    <div className="fixed top-4 right-4 z-50 flex items-center gap-1">
      <LanguageSwitcher />
      <ThemeToggle />
    </div>
  );
}

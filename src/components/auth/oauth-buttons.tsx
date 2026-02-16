"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { GoogleIcon, MicrosoftIcon } from "@/components/auth/provider-icons";

interface OAuthButtonsProps {
  mode: "login" | "register";
}

export function OAuthButtons({ mode }: OAuthButtonsProps) {
  const t = useTranslations("auth");

  return (
    <div className="space-y-2">
      <a href="/api/auth/google" className="block">
        <Button variant="outline" className="w-full gap-2" type="button">
          <GoogleIcon className="h-4 w-4" />
          {mode === "login" ? t("signInWithGoogle") : t("signUpWithGoogle")}
        </Button>
      </a>
      <a href="/api/auth/microsoft" className="block">
        <Button variant="outline" className="w-full gap-2" type="button">
          <MicrosoftIcon className="h-4 w-4" />
          {mode === "login" ? t("signInWithMicrosoft") : t("signUpWithMicrosoft")}
        </Button>
      </a>
    </div>
  );
}

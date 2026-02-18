"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { GoogleIcon, MicrosoftIcon } from "@/components/auth/provider-icons";

interface OAuthButtonsProps {
  mode: "login" | "register";
  redirectTo?: string;
}

export function OAuthButtons({ mode, redirectTo }: OAuthButtonsProps) {
  const t = useTranslations("auth");

  const googleUrl = redirectTo
    ? `/api/auth/google?redirect=${encodeURIComponent(redirectTo)}`
    : "/api/auth/google";
  const microsoftUrl = redirectTo
    ? `/api/auth/microsoft?redirect=${encodeURIComponent(redirectTo)}`
    : "/api/auth/microsoft";

  return (
    <div className="space-y-2">
      <a href={googleUrl} className="block">
        <Button variant="outline" className="w-full gap-2" type="button">
          <GoogleIcon className="h-4 w-4" />
          {mode === "login" ? t("signInWithGoogle") : t("signUpWithGoogle")}
        </Button>
      </a>
      <a href={microsoftUrl} className="block">
        <Button variant="outline" className="w-full gap-2" type="button">
          <MicrosoftIcon className="h-4 w-4" />
          {mode === "login" ? t("signInWithMicrosoft") : t("signUpWithMicrosoft")}
        </Button>
      </a>
    </div>
  );
}

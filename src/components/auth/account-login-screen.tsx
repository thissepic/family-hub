"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { Eye, EyeOff } from "lucide-react";
import Link from "next/link";

export function AccountLoginScreen({ redirectTo }: { redirectTo?: string }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  // Handle OAuth error from redirect
  useEffect(() => {
    const oauthError = searchParams.get("error");
    if (oauthError === "oauth_failed") {
      setError(t("oauthFailed"));
    } else if (oauthError === "too_many_attempts") {
      setError(t("tooManyAttempts"));
    } else if (oauthError === "oauth_not_configured") {
      setError(t("oauthNotConfigured"));
    }
  }, [searchParams, t]);

  const loginMutation = useMutation(
    trpc.account.login.mutationOptions({
      onSuccess: (data) => {
        if (data.requiresTwoFactor && data.twoFactorToken) {
          const twoFaUrl = `/verify-2fa?token=${data.twoFactorToken}${redirectTo ? `&redirect=${encodeURIComponent(redirectTo)}` : ""}`;
          router.push(twoFaUrl);
          return;
        }
        queryClient.clear();
        router.push(redirectTo || "/families");
        router.refresh();
      },
      onError: (err) => {
        if (err.message.includes("Too many")) {
          setError(t("tooManyAttempts"));
        } else if (err.message.includes("locked")) {
          setError(t("accountLocked"));
        } else if (err.message.includes("OAUTH_ONLY")) {
          setError(t("oauthOnlyAccount"));
        } else {
          setError(t("invalidCredentials"));
        }
        setPassword("");
      },
    })
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setError("");
    loginMutation.mutate({ email, password, rememberMe });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="text-4xl mb-2">🏠</div>
          <CardTitle className="text-xl">Family Hub</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {t("accountLoginSubtitle")}
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <OAuthButtons mode="login" redirectTo={redirectTo} />

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">
                {t("orDivider")}
              </span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("email")}</Label>
              <Input
                id="email"
                type="email"
                placeholder={t("emailPlaceholder")}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">{t("password")}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder={t("passwordPlaceholder")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Checkbox
                  id="rememberMe"
                  checked={rememberMe}
                  onCheckedChange={(checked) => setRememberMe(checked === true)}
                />
                <Label htmlFor="rememberMe" className="text-sm font-normal cursor-pointer">
                  {t("rememberMe")}
                </Label>
              </div>
              <Link href="/forgot-password" className="text-sm text-primary hover:underline">
                {t("forgotPassword")}
              </Link>
            </div>

            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={!email || !password || loginMutation.isPending}
            >
              {loginMutation.isPending ? t("loggingIn") : t("login")}
            </Button>

            <p className="text-sm text-center text-muted-foreground mt-4">
              {t("noAccount")}{" "}
              <Link href={redirectTo ? `/register?redirect=${encodeURIComponent(redirectTo)}` : "/register"} className="text-primary hover:underline">
                {t("createFamily")}
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { OAuthButtons } from "@/components/auth/oauth-buttons";
import { PartyPopper, Eye, EyeOff, Mail, ShieldCheck } from "lucide-react";
import Link from "next/link";

export function RegisterWizard() {
  const t = useTranslations("register");
  const tAuth = useTranslations("auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const trpc = useTRPC();

  // Detect OAuth registration mode
  const oauthProvider = searchParams.get("oauth");
  const isOAuth = oauthProvider === "google" || oauthProvider === "microsoft";
  const providerLabel = oauthProvider === "google" ? "Google" : oauthProvider === "microsoft" ? "Microsoft" : "";

  // Account fields
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [defaultLocale, setDefaultLocale] = useState<"en" | "de">("en");

  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordConfirm, setShowPasswordConfirm] = useState(false);
  const [error, setError] = useState("");
  const [registered, setRegistered] = useState(false);

  // Standard registration mutation (user account only)
  const registerMutation = useMutation(
    trpc.family.registerUser.mutationOptions({
      onSuccess: () => {
        setRegistered(true);
        setError("");
      },
      onError: (err: { message: string }) => {
        if (err.message.includes("EMAIL_TAKEN")) {
          setError(t("emailTaken"));
        } else if (err.message.includes("TOO_MANY")) {
          setError(t("tooManyAttempts"));
        } else {
          setError(t("registrationFailed"));
        }
      },
    })
  );

  // OAuth registration mutation (user account only)
  const registerOAuthMutation = useMutation(
    trpc.family.registerUserWithOAuth.mutationOptions({
      onSuccess: () => {
        setRegistered(true);
        setError("");
      },
      onError: (err: { message: string }) => {
        if (err.message.includes("EMAIL_TAKEN")) {
          setError(t("emailTaken"));
        } else if (err.message.includes("No OAuth session")) {
          setError(t("oauthSessionExpired"));
        } else if (err.message.includes("TOO_MANY")) {
          setError(t("tooManyAttempts"));
        } else {
          setError(t("registrationFailed"));
        }
      },
    })
  );

  const handleRegister = () => {
    setError("");

    if (isOAuth) {
      registerOAuthMutation.mutate({ defaultLocale });
    } else {
      if (!email || !password || password.length < 8 || password !== passwordConfirm) return;
      registerMutation.mutate({
        email,
        password,
        defaultLocale,
      });
    }
  };

  const handleContinue = () => {
    router.push("/families");
    router.refresh();
  };

  const isPending = isOAuth ? registerOAuthMutation.isPending : registerMutation.isPending;

  // Success screen after registration
  if (registered) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="w-full max-w-lg">
          <Card>
            <CardContent className="pt-8 text-center space-y-4">
              <PartyPopper className="h-16 w-16 mx-auto text-primary" />
              <h2 className="text-2xl font-bold">{t("completeTitle")}</h2>
              <p className="text-muted-foreground">{t("completeDescription")}</p>
              {!isOAuth && (
                <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3 text-left">
                  <Mail className="h-5 w-5 text-muted-foreground shrink-0" />
                  <p className="text-sm text-muted-foreground">
                    {t("verificationEmailSent")}
                  </p>
                </div>
              )}
              <Button
                onClick={handleContinue}
                className="w-full"
                size="lg"
              >
                {t("goToDashboard")}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>
              {isOAuth ? t("oauthStepFamilyTitle") : t("stepAccountTitle")}
            </CardTitle>
            <CardDescription>
              {isOAuth
                ? t("oauthStepFamilyDescription", { provider: providerLabel })
                : t("stepAccountDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Standard registration: show OAuth buttons + divider + email/password */}
            {!isOAuth && (
              <>
                <OAuthButtons mode="register" />

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">
                      {tAuth("orDivider")}
                    </span>
                  </div>
                </div>

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
                      autoComplete="new-password"
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
                <div className="space-y-2">
                  <Label htmlFor="passwordConfirm">{t("passwordConfirm")}</Label>
                  <div className="relative">
                    <Input
                      id="passwordConfirm"
                      type={showPasswordConfirm ? "text" : "password"}
                      placeholder={t("passwordConfirmPlaceholder")}
                      value={passwordConfirm}
                      onChange={(e) => setPasswordConfirm(e.target.value)}
                      autoComplete="new-password"
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPasswordConfirm(!showPasswordConfirm)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showPasswordConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>
                {password && passwordConfirm && password !== passwordConfirm && (
                  <p className="text-sm text-destructive">{t("passwordMismatch")}</p>
                )}
                {password && password.length > 0 && password.length < 8 && (
                  <p className="text-sm text-destructive">{t("passwordTooShort")}</p>
                )}
              </>
            )}

            {/* OAuth registration: show verified notice */}
            {isOAuth && (
              <div className="flex items-center gap-2 rounded-lg bg-muted/50 p-3">
                <ShieldCheck className="h-5 w-5 text-green-600 shrink-0" />
                <p className="text-sm text-muted-foreground">
                  {t("oauthVerificationNote", { provider: providerLabel })}
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label>{t("defaultLanguage")}</Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={defaultLocale === "en" ? "default" : "outline"}
                  onClick={() => setDefaultLocale("en")}
                  className="flex-1"
                >
                  English
                </Button>
                <Button
                  type="button"
                  variant={defaultLocale === "de" ? "default" : "outline"}
                  onClick={() => setDefaultLocale("de")}
                  className="flex-1"
                >
                  Deutsch
                </Button>
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}

            <Button
              onClick={handleRegister}
              disabled={
                isPending ||
                (!isOAuth && (
                  !email ||
                  !password ||
                  password.length < 8 ||
                  password !== passwordConfirm
                ))
              }
              className="w-full"
            >
              {isPending ? t("registering") : t("createAccount")}
            </Button>

            <p className="text-sm text-center text-muted-foreground">
              {t("alreadyHaveAccount")}{" "}
              <Link href="/login" className="text-primary hover:underline">
                {t("loginInstead")}
              </Link>
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

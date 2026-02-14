"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { StepIndicator } from "@/components/setup/step-indicator";
import { ColorPicker } from "@/components/setup/color-picker";
import { PartyPopper } from "lucide-react";
import Link from "next/link";

export function RegisterWizard() {
  const t = useTranslations("register");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const trpc = useTRPC();

  const [currentStep, setCurrentStep] = useState(0);

  // Step 1: Account & Family
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [defaultLocale, setDefaultLocale] = useState<"en" | "de">("en");

  // Step 2: Admin Profile
  const [adminName, setAdminName] = useState("");
  const [adminPin, setAdminPin] = useState("");
  const [adminColor, setAdminColor] = useState("#3b82f6");

  // Registration result
  const [adminMemberId, setAdminMemberId] = useState<string | null>(null);

  const [error, setError] = useState("");

  const STEP_LABELS = [t("stepAccount"), t("stepProfile"), t("stepDone")];

  const registerMutation = useMutation(
    trpc.family.register.mutationOptions({
      onSuccess: (data) => {
        setAdminMemberId(data.adminMemberId);
        setCurrentStep(2);
        setError("");
      },
      onError: (err) => {
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

  const selectProfileMutation = useMutation(
    trpc.auth.selectProfile.mutationOptions({
      onSuccess: () => {
        router.push("/");
        router.refresh();
      },
    })
  );

  const handleStep1Next = () => {
    if (!email || !password || !passwordConfirm || !familyName.trim()) return;
    if (password.length < 8) return;
    if (password !== passwordConfirm) return;
    setError("");
    setCurrentStep(1);
  };

  const handleRegister = () => {
    if (!adminName.trim() || adminPin.length < 4) return;
    if (!/^\d+$/.test(adminPin)) return;
    setError("");
    registerMutation.mutate({
      email,
      password,
      familyName: familyName.trim(),
      defaultLocale,
      adminName: adminName.trim(),
      adminPin,
      adminColor,
    });
  };

  const handleComplete = () => {
    if (!adminMemberId) {
      router.push("/login");
      return;
    }
    selectProfileMutation.mutate({ memberId: adminMemberId, pin: adminPin });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
        </div>

        <StepIndicator steps={STEP_LABELS} currentStep={currentStep} />

        {/* Step 0: Account & Family */}
        {currentStep === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>{t("stepAccountTitle")}</CardTitle>
              <CardDescription>{t("stepAccountDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">{t("email")}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder={t("emailPlaceholder")}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t("password")}</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder={t("passwordPlaceholder")}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="passwordConfirm">{t("passwordConfirm")}</Label>
                <Input
                  id="passwordConfirm"
                  type="password"
                  placeholder={t("passwordConfirmPlaceholder")}
                  value={passwordConfirm}
                  onChange={(e) => setPasswordConfirm(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              {password && passwordConfirm && password !== passwordConfirm && (
                <p className="text-sm text-destructive">{t("passwordMismatch")}</p>
              )}
              {password && password.length > 0 && password.length < 8 && (
                <p className="text-sm text-destructive">{t("passwordTooShort")}</p>
              )}

              <div className="space-y-2">
                <Label htmlFor="familyName">{t("familyName")}</Label>
                <Input
                  id="familyName"
                  placeholder={t("familyNamePlaceholder")}
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                />
              </div>

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
                onClick={handleStep1Next}
                disabled={
                  !email ||
                  !password ||
                  password.length < 8 ||
                  password !== passwordConfirm ||
                  !familyName.trim()
                }
                className="w-full"
              >
                {tCommon("next")}
              </Button>

              <p className="text-sm text-center text-muted-foreground">
                {t("alreadyHaveAccount")}{" "}
                <Link href="/login" className="text-primary hover:underline">
                  {t("loginInstead")}
                </Link>
              </p>
            </CardContent>
          </Card>
        )}

        {/* Step 1: Admin Profile */}
        {currentStep === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>{t("stepProfileTitle")}</CardTitle>
              <CardDescription>{t("stepProfileDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="adminName">{t("adminName")}</Label>
                <Input
                  id="adminName"
                  placeholder={t("adminNamePlaceholder")}
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  autoFocus
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="adminPin">{t("adminPin")}</Label>
                <Input
                  id="adminPin"
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder={t("adminPinPlaceholder")}
                  value={adminPin}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "").slice(0, 8);
                    setAdminPin(val);
                  }}
                  maxLength={8}
                />
              </div>
              {adminPin && adminPin.length > 0 && adminPin.length < 4 && (
                <p className="text-sm text-destructive">{t("pinTooShort")}</p>
              )}

              <div className="space-y-2">
                <Label>{t("adminColor")}</Label>
                <ColorPicker value={adminColor} onChange={setAdminColor} />
              </div>

              {error && (
                <p className="text-sm text-destructive text-center">{error}</p>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => { setError(""); setCurrentStep(0); }}
                  className="flex-1"
                >
                  {tCommon("back")}
                </Button>
                <Button
                  onClick={handleRegister}
                  disabled={
                    !adminName.trim() ||
                    adminPin.length < 4 ||
                    registerMutation.isPending
                  }
                  className="flex-1"
                >
                  {registerMutation.isPending ? t("registering") : t("createFamily")}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Complete */}
        {currentStep === 2 && (
          <Card>
            <CardContent className="pt-8 text-center space-y-4">
              <PartyPopper className="h-16 w-16 mx-auto text-primary" />
              <h2 className="text-2xl font-bold">{t("completeTitle")}</h2>
              <p className="text-muted-foreground">{t("completeDescription")}</p>
              <Button
                onClick={handleComplete}
                className="w-full"
                size="lg"
                disabled={selectProfileMutation.isPending}
              >
                {selectProfileMutation.isPending ? t("loggingIn") : t("goToDashboard")}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

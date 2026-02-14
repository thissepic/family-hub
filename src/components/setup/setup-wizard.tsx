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
import { StepIndicator } from "./step-indicator";
import { ColorPicker } from "./color-picker";
import { Plus, Trash2, PartyPopper } from "lucide-react";
import { HubSettingsPanel } from "@/components/hub/hub-settings-panel";

interface MemberInput {
  name: string;
  color: string;
  pin: string;
  role: "ADMIN" | "MEMBER";
}

const STEP_LABELS = ["Account", "Family", "Members", "Calendars", "Chores", "Rewards", "Display"];

export function SetupWizard() {
  const t = useTranslations("setup");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const trpc = useTRPC();

  const [currentStep, setCurrentStep] = useState(0);
  const [accountEmail, setAccountEmail] = useState("");
  const [accountPassword, setAccountPassword] = useState("");
  const [accountPasswordConfirm, setAccountPasswordConfirm] = useState("");
  const [familyName, setFamilyName] = useState("");
  const [defaultLocale, setDefaultLocale] = useState<"en" | "de">("en");
  const [adminName, setAdminName] = useState("");
  const [adminColor, setAdminColor] = useState("#3b82f6");
  const [adminPin, setAdminPin] = useState("");
  // Registered state: after family.register completes, we have an account session
  const [registeredAdminId, setRegisteredAdminId] = useState<string | null>(null);
  const [isFullyAuthenticated, setIsFullyAuthenticated] = useState(false);
  // Additional members (beyond the first admin)
  const [additionalMembers, setAdditionalMembers] = useState<MemberInput[]>([]);

  const registerFamilyMutation = useMutation(
    trpc.family.register.mutationOptions({
      onSuccess: (result) => {
        setRegisteredAdminId(result.adminMemberId);
      },
    })
  );

  const selectProfileMutation = useMutation(
    trpc.auth.selectProfile.mutationOptions({
      onSuccess: () => {
        setIsFullyAuthenticated(true);
        setCurrentStep(2);
      },
    })
  );

  const createMemberMutation = useMutation(
    trpc.members.adminCreate.mutationOptions()
  );

  const handleAccountNext = () => {
    if (!accountEmail || !accountPassword || accountPassword !== accountPasswordConfirm) return;
    if (accountPassword.length < 8) return;
    setCurrentStep(1);
  };

  const handleCreateFamily = async () => {
    if (!familyName.trim() || !adminName.trim() || adminPin.length < 4) return;

    try {
      const result = await registerFamilyMutation.mutateAsync({
        email: accountEmail,
        password: accountPassword,
        familyName: familyName.trim(),
        defaultLocale,
        adminName: adminName.trim(),
        adminPin,
        adminColor,
      });

      // Auto-login: select the admin profile to get a full session
      await selectProfileMutation.mutateAsync({
        memberId: result.adminMemberId,
        pin: adminPin,
      });
    } catch {
      // Error is shown via mutation state
    }
  };

  const handleAddMembers = async () => {
    if (!isFullyAuthenticated) return;

    const validMembers = additionalMembers.filter((m) => m.name.trim() && m.pin.length >= 4);

    // Create additional members sequentially (using authenticated adminCreate)
    for (const member of validMembers) {
      await createMemberMutation.mutateAsync({
        name: member.name.trim(),
        color: member.color,
        pin: member.pin,
        role: member.role,
        locale: defaultLocale,
      });
    }

    setCurrentStep(3);
  };

  const handleComplete = () => {
    // Already fully authenticated from registration step
    router.push("/");
    router.refresh();
  };

  const addMember = () => {
    setAdditionalMembers([...additionalMembers, { name: "", color: getNextColor(), pin: "", role: "MEMBER" }]);
  };

  const removeMember = (index: number) => {
    setAdditionalMembers(additionalMembers.filter((_, i) => i !== index));
  };

  const updateMember = (index: number, field: keyof MemberInput, value: string) => {
    const updated = [...additionalMembers];
    updated[index] = { ...updated[index], [field]: value };
    setAdditionalMembers(updated);
  };

  const getNextColor = () => {
    const colors = ["#ef4444", "#22c55e", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];
    const usedColors = [adminColor, ...additionalMembers.map((m) => m.color)];
    return colors.find((c) => !usedColors.includes(c)) || colors[0];
  };

  const hasValidAdditionalMembers = additionalMembers.length === 0 || additionalMembers.every((m) => m.name.trim() && m.pin.length >= 4);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
        </div>

        <StepIndicator steps={STEP_LABELS} currentStep={currentStep} />

        {/* Step 0: Account Credentials */}
        {currentStep === 0 && (
          <Card>
            <CardHeader>
              <CardTitle>{t("stepAccountTitle")}</CardTitle>
              <CardDescription>{t("stepAccountDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="accountEmail">{t("accountEmail")}</Label>
                <Input
                  id="accountEmail"
                  type="email"
                  placeholder={t("accountEmailPlaceholder")}
                  value={accountEmail}
                  onChange={(e) => setAccountEmail(e.target.value)}
                  autoComplete="email"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accountPassword">{t("accountPassword")}</Label>
                <Input
                  id="accountPassword"
                  type="password"
                  placeholder={t("accountPasswordPlaceholder")}
                  value={accountPassword}
                  onChange={(e) => setAccountPassword(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="accountPasswordConfirm">{t("accountPasswordConfirm")}</Label>
                <Input
                  id="accountPasswordConfirm"
                  type="password"
                  placeholder={t("accountPasswordConfirmPlaceholder")}
                  value={accountPasswordConfirm}
                  onChange={(e) => setAccountPasswordConfirm(e.target.value)}
                  autoComplete="new-password"
                />
              </div>
              {accountPassword && accountPasswordConfirm && accountPassword !== accountPasswordConfirm && (
                <p className="text-sm text-destructive">{t("passwordMismatch")}</p>
              )}
              {accountPassword && accountPassword.length < 8 && (
                <p className="text-sm text-destructive">{t("passwordTooShort")}</p>
              )}
              <Button
                onClick={handleAccountNext}
                disabled={!accountEmail || !accountPassword || accountPassword.length < 8 || accountPassword !== accountPasswordConfirm}
                className="w-full"
              >
                {tCommon("next")}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 1: Create Family + First Admin */}
        {currentStep === 1 && (
          <Card>
            <CardHeader>
              <CardTitle>{t("step1Title")}</CardTitle>
              <CardDescription>{t("step1Description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="familyName">{t("familyName")}</Label>
                <Input
                  id="familyName"
                  placeholder={t("familyNamePlaceholder")}
                  value={familyName}
                  onChange={(e) => setFamilyName(e.target.value)}
                  autoFocus
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

              {/* First Admin Profile */}
              <div className="space-y-3 p-3 rounded-lg border">
                <span className="text-sm font-medium">{t("roleAdmin")}</span>
                <div className="grid gap-3">
                  <div className="space-y-1">
                    <Label>{t("memberName")}</Label>
                    <Input
                      placeholder={t("memberNamePlaceholder")}
                      value={adminName}
                      onChange={(e) => setAdminName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>{t("memberPin")}</Label>
                    <Input
                      type="password"
                      inputMode="numeric"
                      pattern="[0-9]*"
                      placeholder={t("memberPinPlaceholder")}
                      value={adminPin}
                      onChange={(e) => setAdminPin(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label>{t("memberColor")}</Label>
                    <ColorPicker
                      value={adminColor}
                      onChange={setAdminColor}
                    />
                  </div>
                </div>
              </div>

              {registerFamilyMutation.isError && (
                <p className="text-sm text-destructive text-center">
                  {registerFamilyMutation.error?.message === "EMAIL_TAKEN"
                    ? t("emailTaken")
                    : tCommon("error")}
                </p>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(0)}
                  className="flex-1"
                >
                  {tCommon("back")}
                </Button>
                <Button
                  onClick={handleCreateFamily}
                  disabled={
                    !familyName.trim() ||
                    !adminName.trim() ||
                    adminPin.length < 4 ||
                    registerFamilyMutation.isPending ||
                    selectProfileMutation.isPending
                  }
                  className="flex-1"
                >
                  {tCommon("next")}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Add Additional Members (authenticated) */}
        {currentStep === 2 && (
          <Card>
            <CardHeader>
              <CardTitle>{t("step2Title")}</CardTitle>
              <CardDescription>{t("step2Description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {additionalMembers.map((member, index) => (
                <div key={index} className="space-y-3 p-3 rounded-lg border">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {member.role === "ADMIN" ? t("roleAdmin") : t("roleMember")}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeMember(index)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="grid gap-3">
                    <div className="space-y-1">
                      <Label>{t("memberName")}</Label>
                      <Input
                        placeholder={t("memberNamePlaceholder")}
                        value={member.name}
                        onChange={(e) => updateMember(index, "name", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>{t("memberPin")}</Label>
                      <Input
                        type="password"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        placeholder={t("memberPinPlaceholder")}
                        value={member.pin}
                        onChange={(e) => updateMember(index, "pin", e.target.value)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label>{t("memberRole")}</Label>
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant={member.role === "ADMIN" ? "default" : "outline"}
                          size="sm"
                          onClick={() => updateMember(index, "role", "ADMIN")}
                          className="flex-1"
                        >
                          {t("roleAdmin")}
                        </Button>
                        <Button
                          type="button"
                          variant={member.role === "MEMBER" ? "default" : "outline"}
                          size="sm"
                          onClick={() => updateMember(index, "role", "MEMBER")}
                          className="flex-1"
                        >
                          {t("roleMember")}
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <Label>{t("memberColor")}</Label>
                      <ColorPicker
                        value={member.color}
                        onChange={(color) => updateMember(index, "color", color)}
                      />
                    </div>
                  </div>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                onClick={addMember}
                className="w-full"
              >
                <Plus className="mr-2 h-4 w-4" />
                {t("addMember")}
              </Button>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(1)}
                  className="flex-1"
                  disabled
                >
                  {tCommon("back")}
                </Button>
                <Button
                  onClick={handleAddMembers}
                  disabled={!hasValidAdditionalMembers || createMemberMutation.isPending}
                  className="flex-1"
                >
                  {tCommon("next")}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Steps 3-5: Skip placeholders */}
        {currentStep >= 3 && currentStep <= 5 && (
          <Card>
            <CardHeader>
              <CardTitle>
                {currentStep === 3 && t("step3Title")}
                {currentStep === 4 && t("step4Title")}
                {currentStep === 5 && t("step5Title")}
              </CardTitle>
              <CardDescription>
                {currentStep === 3 && t("step3Description")}
                {currentStep === 4 && t("step4Description")}
                {currentStep === 5 && t("step5Description")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8 text-muted-foreground">
                <p>{tCommon("comingSoon")}</p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(currentStep - 1)}
                  className="flex-1"
                >
                  {tCommon("back")}
                </Button>
                <Button
                  onClick={() => setCurrentStep(currentStep + 1)}
                  className="flex-1"
                >
                  {tCommon("skip")}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 6: Hub Display */}
        {currentStep === 6 && (
          <Card>
            <CardHeader>
              <CardTitle>{t("step6Title")}</CardTitle>
              <CardDescription>{t("step6Description")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <HubSettingsPanel compact />
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setCurrentStep(5)}
                  className="flex-1"
                >
                  {tCommon("back")}
                </Button>
                <Button
                  onClick={() => setCurrentStep(7)}
                  className="flex-1"
                >
                  {tCommon("next")}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Completion */}
        {currentStep === 7 && (
          <Card>
            <CardContent className="pt-8 text-center space-y-4">
              <PartyPopper className="h-16 w-16 mx-auto text-primary" />
              <h2 className="text-2xl font-bold">{t("complete")}</h2>
              <p className="text-muted-foreground">{t("completeDescription")}</p>
              <Button onClick={handleComplete} className="w-full" size="lg">
                {t("goToDashboard")}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

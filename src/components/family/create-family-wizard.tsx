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
import { ColorPicker } from "@/components/setup/color-picker";
import Link from "next/link";

export function CreateFamilyWizard() {
  const t = useTranslations("createFamily");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const trpc = useTRPC();

  const [familyName, setFamilyName] = useState("");
  const [defaultLocale, setDefaultLocale] = useState<"en" | "de">("en");
  const [adminName, setAdminName] = useState("");
  const [adminPin, setAdminPin] = useState("");
  const [adminColor, setAdminColor] = useState("#3b82f6");
  const [error, setError] = useState("");

  const createFamilyMutation = useMutation(
    trpc.family.createFamily.mutationOptions({
      onSuccess: (data) => {
        // After creating family, select it (which auto-resolves the member)
        selectFamilyMutation.mutate({ familyId: data.familyId });
      },
      onError: () => {
        setError(t("creationFailed"));
      },
    })
  );

  const selectFamilyMutation = useMutation(
    trpc.auth.selectFamily.mutationOptions({
      onSuccess: () => {
        router.push("/");
        router.refresh();
      },
    })
  );

  const handleSubmit = () => {
    if (!familyName.trim() || !adminName.trim()) return;
    setError("");

    createFamilyMutation.mutate({
      familyName: familyName.trim(),
      defaultLocale,
      adminName: adminName.trim(),
      adminPin: adminPin || undefined,
      adminColor,
    });
  };

  const isPending = createFamilyMutation.isPending || selectFamilyMutation.isPending;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-muted-foreground mt-1">{t("subtitle")}</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("familyDetailsTitle")}</CardTitle>
            <CardDescription>{t("familyDetailsDescription")}</CardDescription>
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

            <div className="border-t pt-4 mt-4">
              <h3 className="font-medium mb-3">{t("yourProfile")}</h3>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="adminName">{t("profileName")}</Label>
                  <Input
                    id="adminName"
                    placeholder={t("profileNamePlaceholder")}
                    value={adminName}
                    onChange={(e) => setAdminName(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="adminPin">{t("profilePin")}</Label>
                  <Input
                    id="adminPin"
                    type="password"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    placeholder={t("profilePinPlaceholder")}
                    value={adminPin}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "").slice(0, 8);
                      setAdminPin(val);
                    }}
                    maxLength={8}
                  />
                  <p className="text-xs text-muted-foreground">{t("pinOptionalNote")}</p>
                </div>
                {adminPin && adminPin.length > 0 && adminPin.length < 4 && (
                  <p className="text-sm text-destructive">{t("pinTooShort")}</p>
                )}

                <div className="space-y-2">
                  <Label>{t("profileColor")}</Label>
                  <ColorPicker value={adminColor} onChange={setAdminColor} />
                </div>
              </div>
            </div>

            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                asChild
              >
                <Link href="/families">{tCommon("back")}</Link>
              </Button>
              <Button
                onClick={handleSubmit}
                disabled={
                  !familyName.trim() ||
                  !adminName.trim() ||
                  (adminPin.length > 0 && adminPin.length < 4) ||
                  isPending
                }
                className="flex-1"
              >
                {isPending ? t("creating") : t("createButton")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

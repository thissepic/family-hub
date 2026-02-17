"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Loader2, Shield, Mail, ArrowLeft } from "lucide-react";
import { SecuritySettings } from "@/components/settings/security-settings";
import Link from "next/link";

export function AccountSettings() {
  const t = useTranslations("settings");
  const tNav = useTranslations("nav");
  const trpc = useTRPC();

  const { data: session } = useQuery(trpc.auth.getSession.queryOptions());

  // Password reset state
  const [passwordResetSent, setPasswordResetSent] = useState(false);

  // Change Email state
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");

  const requestPasswordChangeMutation = useMutation(
    trpc.account.requestPasswordChange.mutationOptions({
      onSuccess: () => {
        toast.success(t("passwordResetSent"));
        setPasswordResetSent(true);
        setTimeout(() => setPasswordResetSent(false), 30000);
      },
      onError: (err) => {
        toast.error(err.message);
      },
    })
  );

  const changeEmailMutation = useMutation(
    trpc.account.changeEmail.mutationOptions({
      onSuccess: () => {
        toast.success(t("emailChangedSuccess"));
        setNewEmail("");
        setEmailPassword("");
      },
      onError: (err) => {
        toast.error(err.message);
      },
    })
  );

  const handleChangeEmail = () => {
    if (!newEmail.trim() || !emailPassword) return;
    changeEmailMutation.mutate({
      newEmail: newEmail.trim(),
      password: emailPassword,
    });
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-4 space-y-6">
        <div className="flex items-center gap-3">
          {session?.familyId ? (
            <Link href="/settings">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
          ) : (
            <Link href="/families">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-5 w-5" />
              </Button>
            </Link>
          )}
          <h1 className="text-2xl font-bold tracking-tight">
            {tNav("accountSettings")}
          </h1>
        </div>

        {/* Change Password */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5" />
              {t("changePassword")}
            </CardTitle>
            <CardDescription>
              {t("changePasswordEmailDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {t("changePasswordEmailHint")}
            </p>
            <Button
              onClick={() => requestPasswordChangeMutation.mutate()}
              disabled={
                requestPasswordChangeMutation.isPending || passwordResetSent
              }
            >
              {requestPasswordChangeMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {passwordResetSent
                ? t("passwordResetSentButton")
                : t("requestPasswordReset")}
            </Button>
          </CardContent>
        </Card>

        {/* Change Email */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              {t("changeEmail")}
            </CardTitle>
            <CardDescription>{t("changeEmailDescription")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-email">{t("newEmail")}</Label>
              <Input
                id="new-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="new@email.com"
                className="max-w-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email-password">{t("verifyPassword")}</Label>
              <Input
                id="email-password"
                type="password"
                value={emailPassword}
                onChange={(e) => setEmailPassword(e.target.value)}
                placeholder="********"
                className="max-w-sm"
              />
              <p className="text-xs text-muted-foreground">
                {t("verifyPasswordDescription")}
              </p>
            </div>
            <Button
              onClick={handleChangeEmail}
              disabled={
                changeEmailMutation.isPending ||
                !newEmail.trim() ||
                !emailPassword
              }
            >
              {changeEmailMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t("changeEmail")}
            </Button>
            <p className="text-xs text-muted-foreground">
              {t("emailChangeNotice")}
            </p>
          </CardContent>
        </Card>

        {/* 2FA, OAuth, Email Preferences */}
        <SecuritySettings />
      </div>
    </div>
  );
}

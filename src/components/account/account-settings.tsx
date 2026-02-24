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
import { Loader2, Shield, Mail, ArrowLeft, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { SecuritySettings } from "@/components/settings/security-settings";
import Link from "next/link";
import { useRouter } from "next/navigation";

export function AccountSettings() {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const tNav = useTranslations("nav");
  const trpc = useTRPC();
  const router = useRouter();

  const { data: session } = useQuery(trpc.auth.getSession.queryOptions());

  // Password reset state
  const [passwordResetSent, setPasswordResetSent] = useState(false);

  // Change Email state
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");

  // Delete Account state
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [deletePassword, setDeletePassword] = useState("");

  const { data: linkedAccountsData } = useQuery(
    trpc.account.getLinkedAccounts.queryOptions()
  );
  const hasPassword = linkedAccountsData?.hasPassword ?? true;

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

  const deleteAccountMutation = useMutation(
    trpc.account.deleteAccount.mutationOptions({
      onSuccess: () => {
        toast.success(t("accountDeleted"));
        router.push("/");
      },
      onError: (err) => {
        if (err.message === "SOLE_ADMIN") {
          toast.error(t("soleAdminError"));
        } else if (err.message === "PASSWORD_REQUIRED") {
          toast.error(t("deleteAccountPasswordRequired"));
        } else if (err.message === "INVALID_PASSWORD") {
          toast.error(t("deleteAccountInvalidPassword"));
        } else {
          toast.error(err.message);
        }
      },
    })
  );

  const confirmWord = t("deleteConfirmWord");

  const handleDeleteAccount = () => {
    deleteAccountMutation.mutate({
      confirmText: deleteConfirmText,
      password: hasPassword ? deletePassword : undefined,
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

        {/* Danger Zone */}
        <Card className="border-destructive/50">
          <CardHeader>
            <CardTitle className="text-destructive flex items-center gap-2">
              <Trash2 className="h-5 w-5" />
              {t("deleteAccountDangerZone")}
            </CardTitle>
            <CardDescription>
              {t("deleteAccountDangerZoneDescription")}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AlertDialog
              open={deleteDialogOpen}
              onOpenChange={(open) => {
                setDeleteDialogOpen(open);
                if (!open) {
                  setDeleteConfirmText("");
                  setDeletePassword("");
                }
              }}
            >
              <AlertDialogTrigger asChild>
                <Button variant="destructive">{t("deleteAccount")}</Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>
                    {t("deleteAccountConfirm")}
                  </AlertDialogTitle>
                  <AlertDialogDescription>
                    {t("deleteAccountDescription")}
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <div className="py-4 space-y-4">
                  {hasPassword && (
                    <div className="space-y-2">
                      <Label htmlFor="delete-password">
                        {t("deleteAccountPassword")}
                      </Label>
                      <Input
                        id="delete-password"
                        type="password"
                        value={deletePassword}
                        onChange={(e) => setDeletePassword(e.target.value)}
                        placeholder="********"
                      />
                      <p className="text-xs text-muted-foreground">
                        {t("deleteAccountPasswordDescription")}
                      </p>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>{t("typeDeleteConfirm", { word: confirmWord })}</Label>
                    <Input
                      value={deleteConfirmText}
                      onChange={(e) => setDeleteConfirmText(e.target.value)}
                      placeholder={confirmWord}
                    />
                  </div>
                </div>
                <AlertDialogFooter>
                  <AlertDialogCancel>
                    {tCommon("cancel")}
                  </AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDeleteAccount}
                    disabled={
                      deleteAccountMutation.isPending ||
                      deleteConfirmText !== confirmWord ||
                      (hasPassword && !deletePassword)
                    }
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    {deleteAccountMutation.isPending && (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    )}
                    {t("deleteAccount")}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

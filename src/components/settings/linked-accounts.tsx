"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Link2, Unlink, Loader2, Eye, EyeOff } from "lucide-react";
import { GoogleIcon, MicrosoftIcon } from "@/components/auth/provider-icons";

export function LinkedAccounts() {
  const t = useTranslations("settings");
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery(
    trpc.account.getLinkedAccounts.queryOptions()
  );
  const accounts = data?.accounts;
  const hasPassword = data?.hasPassword ?? true;

  const [unlinkId, setUnlinkId] = useState<string | null>(null);
  const [unlinkProvider, setUnlinkProvider] = useState("");

  // Set password dialog for OAuth-only accounts
  const [setPasswordOpen, setSetPasswordOpen] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: trpc.account.getLinkedAccounts.queryKey() });
  };

  const unlinkMutation = useMutation(
    trpc.account.unlinkOAuthAccount.mutationOptions({
      onSuccess: () => {
        toast.success(t("accountUnlinked"));
        setUnlinkId(null);
        invalidate();
      },
      onError: (err) => {
        if (err.message.includes("CANNOT_UNLINK_LAST")) {
          toast.error(t("cannotUnlinkLast"));
        } else {
          toast.error(err.message);
        }
        setUnlinkId(null);
      },
    })
  );

  const setPasswordMutation = useMutation(
    trpc.account.setPassword.mutationOptions({
      onSuccess: () => {
        toast.success(t("passwordSet"));
        setSetPasswordOpen(false);
        setNewPassword("");
        setConfirmPassword("");
        invalidate();
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const getProviderIcon = (provider: string) => {
    switch (provider) {
      case "GOOGLE":
        return <GoogleIcon className="h-5 w-5" />;
      case "MICROSOFT":
        return <MicrosoftIcon className="h-5 w-5" />;
      default:
        return <Link2 className="h-5 w-5" />;
    }
  };

  const getProviderName = (provider: string) => {
    switch (provider) {
      case "GOOGLE":
        return "Google";
      case "MICROSOFT":
        return "Microsoft";
      default:
        return provider;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  const hasGoogle = accounts?.some((a) => a.provider === "GOOGLE");
  const hasMicrosoft = accounts?.some((a) => a.provider === "MICROSOFT");

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Link2 className="h-5 w-5" />
            {t("linkedAccounts")}
          </CardTitle>
          <CardDescription>{t("linkedAccountsDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Connected accounts */}
          {accounts && accounts.length > 0 && (
            <div className="space-y-3">
              {accounts.map((account) => (
                <div
                  key={account.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    {getProviderIcon(account.provider)}
                    <div>
                      <p className="text-sm font-medium">
                        {getProviderName(account.provider)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {account.email}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setUnlinkId(account.id);
                      setUnlinkProvider(getProviderName(account.provider));
                    }}
                  >
                    <Unlink className="h-4 w-4 mr-1" />
                    {t("unlinkAccount")}
                  </Button>
                </div>
              ))}
            </div>
          )}

          {/* Link buttons for providers not yet connected */}
          <div className="flex flex-wrap gap-2">
            {!hasGoogle && (
              <a href="/api/auth/google?action=link">
                <Button variant="outline" size="sm" className="gap-2">
                  <GoogleIcon className="h-4 w-4" />
                  {t("linkGoogle")}
                </Button>
              </a>
            )}
            {!hasMicrosoft && (
              <a href="/api/auth/microsoft?action=link">
                <Button variant="outline" size="sm" className="gap-2">
                  <MicrosoftIcon className="h-4 w-4" />
                  {t("linkMicrosoft")}
                </Button>
              </a>
            )}
          </div>

          {(!accounts || accounts.length === 0) && (
            <p className="text-sm text-muted-foreground">{t("noLinkedAccounts")}</p>
          )}

          {/* Set password option for OAuth-only users (no password set yet) */}
          {accounts && accounts.length > 0 && !hasPassword && (
            <div className="border-t pt-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setNewPassword("");
                  setConfirmPassword("");
                  setShowNewPassword(false);
                  setSetPasswordOpen(true);
                }}
              >
                {t("setPassword")}
              </Button>
              <p className="text-xs text-muted-foreground mt-1">
                {t("setPasswordDescription")}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Unlink confirmation */}
      <AlertDialog open={!!unlinkId} onOpenChange={(open) => !open && setUnlinkId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("unlinkAccountConfirm", { provider: unlinkProvider })}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("unlinkAccountDescription", { provider: unlinkProvider })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => unlinkId && unlinkMutation.mutate({ accountId: unlinkId })}
              disabled={unlinkMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {unlinkMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t("unlinkAccount")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Set password dialog */}
      <Dialog open={setPasswordOpen} onOpenChange={setSetPasswordOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("setPassword")}</DialogTitle>
            <DialogDescription>{t("setPasswordDescription")}</DialogDescription>
          </DialogHeader>
          <div className="py-4 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-pw">{t("newPassword")}</Label>
              <div className="relative">
                <Input
                  id="new-pw"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  tabIndex={-1}
                >
                  {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-pw">{t("confirmPassword")}</Label>
              <Input
                id="confirm-pw"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            {newPassword && newPassword.length > 0 && newPassword.length < 8 && (
              <p className="text-sm text-destructive">{t("passwordTooShort")}</p>
            )}
            {newPassword && confirmPassword && newPassword !== confirmPassword && (
              <p className="text-sm text-destructive">{t("passwordMismatch")}</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSetPasswordOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              onClick={() => setPasswordMutation.mutate({ newPassword })}
              disabled={
                newPassword.length < 8 ||
                newPassword !== confirmPassword ||
                setPasswordMutation.isPending
              }
            >
              {setPasswordMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t("setPassword")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

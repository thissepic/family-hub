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
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { ShieldCheck, ShieldOff, Loader2, Download, Copy, AlertTriangle } from "lucide-react";
import { LinkedAccounts } from "@/components/settings/linked-accounts";
import { EmailPreferences } from "@/components/settings/email-preferences";

export function SecuritySettings() {
  const t = useTranslations("settings");
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: status, isLoading } = useQuery(
    trpc.account.getTwoFactorStatus.queryOptions()
  );

  // Setup dialog
  const [setupOpen, setSetupOpen] = useState(false);
  const [setupStep, setSetupStep] = useState(0);
  const [setupData, setSetupData] = useState<{
    secret: string;
    qrCodeDataUrl: string;
  } | null>(null);
  const [confirmCode, setConfirmCode] = useState("");
  const [recoveryCodes, setRecoveryCodes] = useState<string[]>([]);

  // Disable dialog
  const [disableOpen, setDisableOpen] = useState(false);
  const [disableCode, setDisableCode] = useState("");

  // Regenerate dialog
  const [regenOpen, setRegenOpen] = useState(false);
  const [regenCode, setRegenCode] = useState("");
  const [regenCodes, setRegenCodes] = useState<string[]>([]);
  const [regenStep, setRegenStep] = useState(0);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: trpc.account.getTwoFactorStatus.queryKey() });
  };

  // ─── Mutations ──────────────────────────────────────────────────────────────

  const setupMutation = useMutation(
    trpc.account.setupTwoFactor.mutationOptions({
      onSuccess: (data) => {
        setSetupData(data);
        setSetupStep(0);
        setConfirmCode("");
        setSetupOpen(true);
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const confirmMutation = useMutation(
    trpc.account.confirmTwoFactor.mutationOptions({
      onSuccess: (data) => {
        setRecoveryCodes(data.recoveryCodes);
        setSetupStep(2);
        invalidate();
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const disableMutation = useMutation(
    trpc.account.disableTwoFactor.mutationOptions({
      onSuccess: () => {
        toast.success(t("twoFactorDisabledSuccess"));
        setDisableOpen(false);
        setDisableCode("");
        invalidate();
      },
      onError: (err) => toast.error(err.message),
    })
  );

  const regenMutation = useMutation(
    trpc.account.regenerateRecoveryCodes.mutationOptions({
      onSuccess: (data) => {
        setRegenCodes(data.recoveryCodes);
        setRegenStep(1);
        invalidate();
      },
      onError: (err) => toast.error(err.message),
    })
  );

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const downloadCodes = (codes: string[]) => {
    const text = [
      "Family Hub - Recovery Codes",
      `Generated: ${new Date().toLocaleDateString()}`,
      "",
      "Each code can only be used once.",
      "Keep these codes in a safe place.",
      "",
      ...codes.map((code, i) => `${(i + 1).toString().padStart(2, " ")}. ${code}`),
    ].join("\n");

    const blob = new Blob([text], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "family-hub-recovery-codes.txt";
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(t("codeCopied"));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!status) return null;

  return (
    <div className="space-y-6">
      {/* 2FA Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" />
            {t("twoFactorAuth")}
          </CardTitle>
          <CardDescription>{t("twoFactorDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium">{t("status")}:</span>
            {status.enabled ? (
              <Badge variant="default" className="bg-green-600">
                {t("twoFactorEnabled")}
              </Badge>
            ) : (
              <Badge variant="secondary">{t("twoFactorDisabled")}</Badge>
            )}
          </div>

          {!status.enabled && !status.emailVerified && (
            <div className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-sm text-amber-800 dark:text-amber-200">
                {t("twoFactorRequiresVerification")}
              </p>
            </div>
          )}

          {!status.enabled && (
            <Button
              onClick={() => setupMutation.mutate()}
              disabled={setupMutation.isPending || !status.emailVerified}
            >
              {setupMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t("enableTwoFactor")}
            </Button>
          )}

          {status.enabled && (
            <>
              <div className="text-sm text-muted-foreground">
                {t("recoveryCodesRemaining", {
                  used: status.recoveryCodesTotal - status.recoveryCodesRemaining,
                  total: status.recoveryCodesTotal,
                })}
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setRegenCode("");
                    setRegenCodes([]);
                    setRegenStep(0);
                    setRegenOpen(true);
                  }}
                >
                  {t("regenerateRecoveryCodes")}
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => {
                    setDisableCode("");
                    setDisableOpen(true);
                  }}
                >
                  <ShieldOff className="mr-2 h-4 w-4" />
                  {t("disableTwoFactor")}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* ─── Setup Dialog ─────────────────────────────────────────────────────── */}
      <Dialog
        open={setupOpen}
        onOpenChange={(open) => {
          if (!open && setupStep < 2) {
            setSetupOpen(false);
            setSetupData(null);
          }
          if (!open && setupStep === 2) {
            setSetupOpen(false);
            setSetupData(null);
            setRecoveryCodes([]);
            toast.success(t("twoFactorEnabledSuccess"));
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          {setupStep === 0 && setupData && (
            <>
              <DialogHeader>
                <DialogTitle>{t("enableTwoFactor")}</DialogTitle>
                <DialogDescription>{t("scanQrCode")}</DialogDescription>
              </DialogHeader>
              <div className="flex flex-col items-center gap-4 py-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={setupData.qrCodeDataUrl}
                  alt="QR Code"
                  className="rounded-lg border"
                  width={256}
                  height={256}
                />
                <div className="space-y-1 text-center">
                  <p className="text-sm text-muted-foreground">
                    {t("manualEntry")}
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="rounded bg-muted px-2 py-1 text-sm font-mono select-all">
                      {setupData.secret}
                    </code>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => copyCode(setupData.secret)}
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button onClick={() => setSetupStep(1)}>{t("next")}</Button>
              </DialogFooter>
            </>
          )}

          {setupStep === 1 && (
            <>
              <DialogHeader>
                <DialogTitle>{t("enableTwoFactor")}</DialogTitle>
                <DialogDescription>{t("enterCodeToConfirm")}</DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="confirm-code">{t("enterAuthenticatorCode")}</Label>
                  <Input
                    id="confirm-code"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={6}
                    placeholder="000000"
                    value={confirmCode}
                    onChange={(e) => setConfirmCode(e.target.value.replace(/\D/g, ""))}
                    autoFocus
                    className="font-mono tracking-[0.5em] text-center text-lg"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSetupStep(0)}>
                  {t("back")}
                </Button>
                <Button
                  onClick={() => confirmMutation.mutate({ code: confirmCode })}
                  disabled={confirmCode.length !== 6 || confirmMutation.isPending}
                >
                  {confirmMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {t("verifyAndEnable")}
                </Button>
              </DialogFooter>
            </>
          )}

          {setupStep === 2 && (
            <>
              <DialogHeader>
                <DialogTitle>{t("recoveryCodes")}</DialogTitle>
                <DialogDescription>{t("recoveryCodesDescription")}</DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/50 p-4">
                  {recoveryCodes.map((code, i) => (
                    <code key={i} className="text-sm font-mono text-center py-1">
                      {code}
                    </code>
                  ))}
                </div>
              </div>
              <DialogFooter className="flex-col gap-2 sm:flex-col">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => downloadCodes(recoveryCodes)}
                >
                  <Download className="mr-2 h-4 w-4" />
                  {t("downloadCodes")}
                </Button>
                <Button
                  className="w-full"
                  onClick={() => {
                    setSetupOpen(false);
                    setSetupData(null);
                    setRecoveryCodes([]);
                    toast.success(t("twoFactorEnabledSuccess"));
                  }}
                >
                  {t("savedCodes")}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* ─── Disable Confirmation ──────────────────────────────────────────────── */}
      <AlertDialog open={disableOpen} onOpenChange={setDisableOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("disableTwoFactorConfirm")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("disableTwoFactorDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-4 space-y-2">
            <Label htmlFor="disable-code">{t("enterAuthenticatorCode")}</Label>
            <Input
              id="disable-code"
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              maxLength={6}
              placeholder="000000"
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, ""))}
              autoFocus
              className="font-mono tracking-[0.5em] text-center text-lg"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setDisableCode("")}>
              {t("cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={() => disableMutation.mutate({ code: disableCode })}
              disabled={disableCode.length !== 6 || disableMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {disableMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t("disableTwoFactor")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ─── Regenerate Recovery Codes ─────────────────────────────────────────── */}
      <Dialog
        open={regenOpen}
        onOpenChange={(open) => {
          if (!open) {
            setRegenOpen(false);
            setRegenCodes([]);
            setRegenCode("");
            setRegenStep(0);
          }
        }}
      >
        <DialogContent className="sm:max-w-md">
          {regenStep === 0 && (
            <>
              <DialogHeader>
                <DialogTitle>{t("regenerateRecoveryCodes")}</DialogTitle>
                <DialogDescription>{t("regenerateConfirm")}</DialogDescription>
              </DialogHeader>
              <div className="py-4 space-y-2">
                <Label htmlFor="regen-code">{t("enterAuthenticatorCode")}</Label>
                <Input
                  id="regen-code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder="000000"
                  value={regenCode}
                  onChange={(e) => setRegenCode(e.target.value.replace(/\D/g, ""))}
                  autoFocus
                  className="font-mono tracking-[0.5em] text-center text-lg"
                />
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setRegenOpen(false)}>
                  {t("cancel")}
                </Button>
                <Button
                  onClick={() => regenMutation.mutate({ code: regenCode })}
                  disabled={regenCode.length !== 6 || regenMutation.isPending}
                >
                  {regenMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {t("regenerateRecoveryCodes")}
                </Button>
              </DialogFooter>
            </>
          )}

          {regenStep === 1 && (
            <>
              <DialogHeader>
                <DialogTitle>{t("recoveryCodes")}</DialogTitle>
                <DialogDescription>{t("recoveryCodesDescription")}</DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/50 p-4">
                  {regenCodes.map((code, i) => (
                    <code key={i} className="text-sm font-mono text-center py-1">
                      {code}
                    </code>
                  ))}
                </div>
              </div>
              <DialogFooter className="flex-col gap-2 sm:flex-col">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => downloadCodes(regenCodes)}
                >
                  <Download className="mr-2 h-4 w-4" />
                  {t("downloadCodes")}
                </Button>
                <Button
                  className="w-full"
                  onClick={() => {
                    setRegenOpen(false);
                    setRegenCodes([]);
                    setRegenStep(0);
                  }}
                >
                  {t("savedCodes")}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* Linked OAuth Accounts */}
      <LinkedAccounts />

      {/* Email Notification Preferences */}
      <EmailPreferences />
    </div>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck, Loader2 } from "lucide-react";
import Link from "next/link";

export function TwoFactorVerifyScreen({ token }: { token: string }) {
  const t = useTranslations("auth");
  const router = useRouter();
  const trpc = useTRPC();

  const [code, setCode] = useState("");
  const [useRecovery, setUseRecovery] = useState(false);
  const [error, setError] = useState("");

  const verifyMutation = useMutation(
    trpc.account.verifyTwoFactor.mutationOptions({
      onSuccess: (data) => {
        if (data.usedRecoveryCode && data.remainingCodes !== undefined) {
          toast.warning(
            t("recoveryCodeWarning", { count: data.remainingCodes })
          );
        }
        router.push("/profiles");
        router.refresh();
      },
      onError: (err) => {
        if (err.message.includes("expired") || err.message.includes("log in again")) {
          setError(t("twoFactorExpired"));
        } else if (err.message.includes("Too many")) {
          setError(t("tooManyAttempts"));
        } else {
          setError(t("twoFactorInvalid"));
        }
        setCode("");
      },
    })
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    setError("");
    verifyMutation.mutate({ token, code: code.trim() });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-2">
            <ShieldCheck className="h-10 w-10 text-primary" />
          </div>
          <CardTitle className="text-xl">{t("twoFactorTitle")}</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {useRecovery ? t("recoveryCodeSubtitle") : t("twoFactorSubtitle")}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="2fa-code">
                {useRecovery ? t("recoveryCode") : t("twoFactorCode")}
              </Label>
              {useRecovery ? (
                <Input
                  id="2fa-code"
                  type="text"
                  placeholder={t("recoveryCodePlaceholder")}
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  autoComplete="off"
                  autoFocus
                  className="font-mono tracking-wider"
                />
              ) : (
                <Input
                  id="2fa-code"
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={6}
                  placeholder={t("twoFactorCodePlaceholder")}
                  value={code}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, "");
                    setCode(val);
                  }}
                  autoComplete="one-time-code"
                  autoFocus
                  className="font-mono tracking-[0.5em] text-center text-lg"
                />
              )}
            </div>

            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={!code.trim() || verifyMutation.isPending}
            >
              {verifyMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  {t("twoFactorVerifying")}
                </>
              ) : (
                t("twoFactorVerify")
              )}
            </Button>

            <button
              type="button"
              onClick={() => {
                setUseRecovery(!useRecovery);
                setCode("");
                setError("");
              }}
              className="w-full text-sm text-primary hover:underline text-center"
            >
              {useRecovery ? t("useAuthenticator") : t("useRecoveryCode")}
            </button>

            <p className="text-sm text-center text-muted-foreground">
              <Link href="/login" className="text-primary hover:underline">
                {t("backToLogin")}
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

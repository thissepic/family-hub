"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import Link from "next/link";

export function VerifyEmailPage() {
  const t = useTranslations("emailVerification");
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const trpc = useTRPC();
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");

  const verifyMutation = useMutation(
    trpc.account.verifyEmail.mutationOptions({
      onSuccess: () => setStatus("success"),
      onError: () => setStatus("error"),
    })
  );

  useEffect(() => {
    if (token && status === "loading") {
      verifyMutation.mutate({ token });
    } else if (!token) {
      setStatus("error");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-sm text-center">
        <CardHeader>
          <div className="text-4xl mb-2">
            {status === "loading" && <Loader2 className="h-10 w-10 mx-auto animate-spin text-primary" />}
            {status === "success" && <CheckCircle2 className="h-10 w-10 mx-auto text-green-500" />}
            {status === "error" && <XCircle className="h-10 w-10 mx-auto text-destructive" />}
          </div>
          <CardTitle className="text-xl">
            {status === "loading" && t("verifyingTitle")}
            {status === "success" && t("successTitle")}
            {status === "error" && t("errorTitle")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {status === "success" && t("successDescription")}
            {status === "error" && t("errorDescription")}
          </p>

          {status === "success" && (
            <Button asChild className="w-full">
              <Link href="/">{t("goToDashboard")}</Link>
            </Button>
          )}

          {status === "error" && (
            <Button asChild variant="outline" className="w-full">
              <Link href="/login">{t("goToLogin")}</Link>
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

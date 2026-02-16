"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Mail } from "lucide-react";
import Link from "next/link";

export function ForgotPasswordPage() {
  const t = useTranslations("passwordReset");
  const trpc = useTRPC();
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");

  const requestMutation = useMutation(
    trpc.account.requestPasswordReset.mutationOptions({
      onSuccess: () => setSent(true),
      onError: (err) => {
        if (err.message.includes("Too many")) {
          setError(t("tooManyRequests"));
        } else {
          setError(err.message);
        }
      },
    })
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setError("");
    requestMutation.mutate({ email });
  };

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-sm text-center">
          <CardHeader>
            <Mail className="h-10 w-10 mx-auto text-primary mb-2" />
            <CardTitle className="text-xl">{t("sentTitle")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">{t("sentDescription")}</p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/login">{t("backToLogin")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="text-4xl mb-2">🔑</div>
          <CardTitle className="text-xl">{t("forgotTitle")}</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {t("forgotDescription")}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">{t("emailLabel")}</Label>
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

            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={!email || requestMutation.isPending}
            >
              {requestMutation.isPending ? t("sending") : t("sendResetLink")}
            </Button>

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

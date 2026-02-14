"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useMutation } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from "next/link";

export function AccountLoginScreen() {
  const t = useTranslations("auth");
  const router = useRouter();
  const trpc = useTRPC();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");

  const loginMutation = useMutation(
    trpc.account.login.mutationOptions({
      onSuccess: () => {
        router.push("/profiles");
        router.refresh();
      },
      onError: (err) => {
        if (err.message.includes("Too many")) {
          setError(t("tooManyAttempts"));
        } else if (err.message.includes("locked")) {
          setError(t("accountLocked"));
        } else {
          setError(t("invalidCredentials"));
        }
        setPassword("");
      },
    })
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setError("");
    loginMutation.mutate({ email, password, rememberMe });
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="text-4xl mb-2">🏠</div>
          <CardTitle className="text-xl">Family Hub</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {t("accountLoginSubtitle")}
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
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
                autoComplete="current-password"
              />
            </div>

            <div className="flex items-center gap-2">
              <Checkbox
                id="rememberMe"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked === true)}
              />
              <Label htmlFor="rememberMe" className="text-sm font-normal cursor-pointer">
                {t("rememberMe")}
              </Label>
            </div>

            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={!email || !password || loginMutation.isPending}
            >
              {loginMutation.isPending ? t("loggingIn") : t("login")}
            </Button>

            <p className="text-sm text-center text-muted-foreground mt-4">
              {t("noAccount")}{" "}
              <Link href="/register" className="text-primary hover:underline">
                {t("createFamily")}
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

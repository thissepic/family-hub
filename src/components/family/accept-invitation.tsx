"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ColorPicker } from "@/components/setup/color-picker";
import { AlertTriangle } from "lucide-react";
import Link from "next/link";

export function AcceptInvitation({ token }: { token: string }) {
  const t = useTranslations("invitation");
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [memberName, setMemberName] = useState("");
  const [memberColor, setMemberColor] = useState("#3b82f6");
  const [error, setError] = useState("");

  const { data: session, isLoading: sessionLoading } = useQuery(
    trpc.auth.getSession.queryOptions()
  );

  const isAuthenticated = !!session?.userId;

  const { data: invitation, isLoading: invitationLoading } = useQuery(
    trpc.invitations.getByToken.queryOptions({ token })
  );

  const isProfileBound = !!invitation?.forMember;

  const acceptMutation = useMutation(
    trpc.invitations.accept.mutationOptions({
      onSuccess: (result) => {
        queryClient.clear();
        // Select the family after accepting
        selectFamilyMutation.mutate({ familyId: result.familyId });
      },
      onError: (err: { message: string }) => {
        setError(err.message);
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

  const declineMutation = useMutation(
    trpc.invitations.decline.mutationOptions({
      onSuccess: () => {
        router.push("/families");
        router.refresh();
      },
    })
  );

  const handleAccept = () => {
    setError("");
    if (isProfileBound) {
      // Profile-bound: no name/color needed
      acceptMutation.mutate({ token });
    } else {
      if (!memberName.trim()) return;
      acceptMutation.mutate({
        token,
        memberName: memberName.trim(),
        memberColor,
      });
    }
  };

  const isPending = acceptMutation.isPending || selectFamilyMutation.isPending;
  const isLoading = sessionLoading || invitationLoading;

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 text-center">
            <p className="text-muted-foreground">{t("loading")}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!invitation || invitation.isExpired) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8 text-center space-y-4">
            <h2 className="text-xl font-bold">{t("invalidTitle")}</h2>
            <p className="text-muted-foreground">{t("invalidDescription")}</p>
            <Button asChild className="w-full">
              <Link href="/families">{t("backToFamilies")}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Unauthenticated: show login/register options
  if (!isAuthenticated) {
    const redirectPath = `/invite/${token}`;
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <div className="w-full max-w-md">
          <Card>
            <CardHeader className="text-center">
              <div className="text-4xl mb-2">🎉</div>
              <CardTitle>{t("title")}</CardTitle>
              <CardDescription>
                {t("description", {
                  familyName: invitation.familyName,
                  invitedBy: invitation.invitedByName,
                })}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {invitation.email && (
                <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-800 dark:text-amber-200">
                    {t("emailWarning", { email: invitation.email })}
                  </p>
                </div>
              )}

              <p className="text-sm text-center text-muted-foreground">
                {t("loginRequired")}
              </p>

              <div className="flex flex-col gap-2">
                <Button asChild className="w-full">
                  <Link href={`/login?redirect=${encodeURIComponent(redirectPath)}`}>
                    {t("loginToAccept")}
                  </Link>
                </Button>
                <Button asChild variant="outline" className="w-full">
                  <Link href={`/register?redirect=${encodeURIComponent(redirectPath)}`}>
                    {t("createAccountToAccept")}
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            <div className="text-4xl mb-2">🎉</div>
            <CardTitle>{t("title")}</CardTitle>
            <CardDescription>
              {t("description", {
                familyName: invitation.familyName,
                invitedBy: invitation.invitedByName,
              })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {isProfileBound && invitation.forMember ? (
              /* Profile-bound invitation: show existing profile info */
              <div className="flex flex-col items-center gap-3 rounded-lg border bg-muted/50 p-4">
                <div
                  className="flex h-14 w-14 items-center justify-center rounded-full text-white font-semibold text-lg"
                  style={{ backgroundColor: invitation.forMember.color }}
                >
                  {invitation.forMember.avatar ??
                    invitation.forMember.name.charAt(0).toUpperCase()}
                </div>
                <div className="text-center">
                  <p className="font-medium">{invitation.forMember.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("joinAsProfile", { name: invitation.forMember.name })}
                  </p>
                </div>
              </div>
            ) : (
              /* Regular invitation: show name/color form */
              <>
                <div className="space-y-2">
                  <Label htmlFor="memberName">{t("yourName")}</Label>
                  <Input
                    id="memberName"
                    placeholder={t("yourNamePlaceholder")}
                    value={memberName}
                    onChange={(e) => setMemberName(e.target.value)}
                    autoFocus
                  />
                </div>

                <div className="space-y-2">
                  <Label>{t("yourColor")}</Label>
                  <ColorPicker value={memberColor} onChange={setMemberColor} />
                </div>
              </>
            )}

            {error && (
              <p className="text-sm text-destructive text-center">{error}</p>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => declineMutation.mutate({ token })}
                disabled={declineMutation.isPending || isPending}
              >
                {t("decline")}
              </Button>
              <Button
                onClick={handleAccept}
                disabled={(!isProfileBound && !memberName.trim()) || isPending}
                className="flex-1"
              >
                {isPending ? t("joining") : t("acceptAndJoin")}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

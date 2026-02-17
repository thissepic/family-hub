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
import { Loader2, Mail, Link2, Copy, Check, UserPlus, X } from "lucide-react";

export function InvitationsPanel() {
  const t = useTranslations("invitationsPanel");
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  // Create invitation form state
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"MEMBER" | "ADMIN">("MEMBER");
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [createdEmail, setCreatedEmail] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // Fetch existing invitations
  const { data: invitations = [], isLoading } = useQuery(
    trpc.invitations.list.queryOptions()
  );

  const createMutation = useMutation(
    trpc.invitations.create.mutationOptions({
      onSuccess: (data) => {
        setCreatedToken(data.token);
        setCreatedEmail(email || null);
        setEmail("");
        queryClient.invalidateQueries({ queryKey: [["invitations"]] });
      },
      onError: (err) => {
        toast.error(err.message);
      },
    })
  );

  const revokeMutation = useMutation(
    trpc.invitations.revoke.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [["invitations"]] });
        toast.success("Invitation revoked");
      },
      onError: (err) => {
        toast.error(err.message);
      },
    })
  );

  const handleCreate = () => {
    setCreatedToken(null);
    setCreatedEmail(null);
    createMutation.mutate({
      email: email.trim() || undefined,
      role,
    });
  };

  const handleCopyLink = async (token: string) => {
    const appUrl = window.location.origin;
    const url = `${appUrl}/invite/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      // Fallback: select text
      toast.error("Failed to copy link");
    }
  };

  const inviteUrl = createdToken
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/invite/${createdToken}`
    : "";

  const pendingInvitations = invitations.filter(
    (inv: { status: string; expiresAt: string | Date }) =>
      inv.status === "PENDING" && new Date(inv.expiresAt) > new Date()
  );

  const statusBadgeVariant = (status: string) => {
    switch (status) {
      case "PENDING":
        return "outline" as const;
      case "ACCEPTED":
        return "default" as const;
      case "DECLINED":
        return "secondary" as const;
      default:
        return "secondary" as const;
    }
  };

  const statusLabel = (status: string) => {
    switch (status) {
      case "PENDING":
        return t("statusPending");
      case "ACCEPTED":
        return t("statusAccepted");
      case "DECLINED":
        return t("statusDeclined");
      case "EXPIRED":
        return t("statusExpired");
      default:
        return status;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5" />
          {t("title")}
        </CardTitle>
        <CardDescription>{t("description")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Create Invitation */}
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="invite-email">{t("emailLabel")}</Label>
            <Input
              id="invite-email"
              type="email"
              placeholder={t("emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="max-w-sm"
            />
          </div>

          <div className="space-y-2">
            <Label>{t("roleLabel")}</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={role === "MEMBER" ? "default" : "outline"}
                size="sm"
                onClick={() => setRole("MEMBER")}
              >
                {t("roleMember")}
              </Button>
              <Button
                type="button"
                variant={role === "ADMIN" ? "default" : "outline"}
                size="sm"
                onClick={() => setRole("ADMIN")}
              >
                {t("roleAdmin")}
              </Button>
            </div>
          </div>

          <Button
            onClick={handleCreate}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t("sending")}
              </>
            ) : email.trim() ? (
              <>
                <Mail className="mr-2 h-4 w-4" />
                {t("sendInvite")}
              </>
            ) : (
              <>
                <Link2 className="mr-2 h-4 w-4" />
                {t("createLink")}
              </>
            )}
          </Button>

          {/* Success message after creating invitation */}
          {createdToken && (
            <div className="rounded-lg border bg-muted/50 p-3 space-y-2">
              {createdEmail && (
                <p className="text-sm text-muted-foreground">
                  <Mail className="inline h-4 w-4 mr-1" />
                  {t("emailSent", { email: createdEmail })}
                </p>
              )}
              <p className="text-sm text-muted-foreground">
                {t("linkGenerated")}
              </p>
              <div className="flex items-center gap-2">
                <Input
                  readOnly
                  value={inviteUrl}
                  className="text-xs font-mono"
                />
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCopyLink(createdToken)}
                  className="shrink-0"
                >
                  {linkCopied ? (
                    <>
                      <Check className="mr-1 h-3 w-3" />
                      {t("linkCopied")}
                    </>
                  ) : (
                    <>
                      <Copy className="mr-1 h-3 w-3" />
                      {t("copyLink")}
                    </>
                  )}
                </Button>
              </div>
              <Button
                size="sm"
                variant="ghost"
                className="text-xs"
                onClick={() => {
                  setCreatedToken(null);
                  setCreatedEmail(null);
                }}
              >
                <X className="mr-1 h-3 w-3" />
                Dismiss
              </Button>
            </div>
          )}
        </div>

        {/* Active Invitations List */}
        {!isLoading && invitations.length > 0 && (
          <div className="space-y-3">
            <div className="border-t pt-4">
              <h3 className="text-sm font-medium mb-3">
                {t("activeInvitations")}
              </h3>
            </div>
            <div className="space-y-2">
              {invitations.map((invitation: {
                id: string;
                email: string | null;
                role: string;
                status: string;
                token: string;
                expiresAt: string | Date;
                invitedBy: { name: string };
              }) => {
                const isExpired =
                  invitation.status !== "PENDING" ||
                  new Date(invitation.expiresAt) <= new Date();

                return (
                  <div
                    key={invitation.id}
                    className="flex items-center gap-3 rounded-lg border p-3"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {invitation.email || (
                          <span className="text-muted-foreground italic">
                            {t("linkInvite")}
                          </span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t("expires", {
                          date: new Date(invitation.expiresAt).toLocaleDateString(),
                        })}
                      </p>
                    </div>
                    <Badge variant={statusBadgeVariant(invitation.status)}>
                      {statusLabel(
                        isExpired && invitation.status === "PENDING"
                          ? "EXPIRED"
                          : invitation.status
                      )}
                    </Badge>
                    <Badge variant="secondary">{invitation.role}</Badge>
                    {invitation.status === "PENDING" && !isExpired && (
                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => handleCopyLink(invitation.token)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                          onClick={() =>
                            revokeMutation.mutate({
                              invitationId: invitation.id,
                            })
                          }
                          disabled={revokeMutation.isPending}
                        >
                          {t("revoke")}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!isLoading && pendingInvitations.length === 0 && !createdToken && (
          <p className="text-sm text-muted-foreground text-center py-2">
            {t("noInvitations")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

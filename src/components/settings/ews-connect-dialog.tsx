"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface EwsConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EwsConnectDialog({
  open,
  onOpenChange,
}: EwsConnectDialogProps) {
  const t = useTranslations("settings");
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [ewsUrl, setEwsUrl] = useState("");
  const [domain, setDomain] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [accountLabel, setAccountLabel] = useState("");

  const connectMutation = useMutation(
    trpc.calendarSync.connectEws.mutationOptions({
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: [["calendarSync"]] });
        toast.success(t("connectedSuccessfully"));
        onOpenChange(false);
        resetForm();
      },
      onError: (err) => {
        toast.error(err.message || t("connectionFailed"));
      },
    })
  );

  const resetForm = () => {
    setEwsUrl("");
    setDomain("");
    setUsername("");
    setPassword("");
    setEmail("");
    setAccountLabel("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    connectMutation.mutate({
      ewsUrl,
      domain,
      username,
      password,
      email,
      accountLabel: accountLabel || "Exchange",
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t("connectExchange")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Server URL */}
          <div className="space-y-1.5">
            <Label htmlFor="ews-url">{t("exchangeServerUrl")}</Label>
            <Input
              id="ews-url"
              type="url"
              value={ewsUrl}
              onChange={(e) => setEwsUrl(e.target.value)}
              placeholder="https://mail.example.com/EWS/Exchange.asmx"
              required
            />
            <p className="text-xs text-muted-foreground">
              {t("exchangeServerUrlHint")}
            </p>
          </div>

          {/* Domain */}
          <div className="space-y-1.5">
            <Label htmlFor="ews-domain">{t("domain")}</Label>
            <Input
              id="ews-domain"
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="CORP"
              required
            />
            <p className="text-xs text-muted-foreground">
              {t("domainHint")}
            </p>
          </div>

          {/* Username */}
          <div className="space-y-1.5">
            <Label htmlFor="ews-username">{t("username")}</Label>
            <Input
              id="ews-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="jdoe"
              required
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <Label htmlFor="ews-password">{t("password")}</Label>
            <Input
              id="ews-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="ews-email">{t("email")}</Label>
            <Input
              id="ews-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jdoe@example.com"
              required
            />
          </div>

          {/* Account Label */}
          <div className="space-y-1.5">
            <Label htmlFor="ews-label">{t("accountLabel")}</Label>
            <Input
              id="ews-label"
              value={accountLabel}
              onChange={(e) => setAccountLabel(e.target.value)}
              placeholder="Exchange (Work)"
            />
          </div>

          <Button
            type="submit"
            className="w-full"
            disabled={connectMutation.isPending}
          >
            {connectMutation.isPending ? t("testingConnection") : t("connect")}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

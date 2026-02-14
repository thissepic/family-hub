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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface CaldavConnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultProvider?: "APPLE" | "CALDAV";
}

export function CaldavConnectDialog({
  open,
  onOpenChange,
  defaultProvider = "APPLE",
}: CaldavConnectDialogProps) {
  const t = useTranslations("settings");
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [provider, setProvider] = useState<"APPLE" | "CALDAV">(defaultProvider);
  const [caldavUrl, setCaldavUrl] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [accountLabel, setAccountLabel] = useState("");

  const connectMutation = useMutation(
    trpc.calendarSync.connectCaldav.mutationOptions({
      onSuccess: (data) => {
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
    setCaldavUrl("");
    setUsername("");
    setPassword("");
    setAccountLabel("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    connectMutation.mutate({
      provider,
      caldavUrl: provider === "CALDAV" ? caldavUrl : undefined,
      username,
      password,
      accountLabel: accountLabel || (provider === "APPLE" ? "Apple iCloud" : "CalDAV"),
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {provider === "APPLE" ? t("connectApple") : t("connectCaldav")}
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Provider type */}
          <div className="space-y-1.5">
            <Label>{t("providerType")}</Label>
            <Select
              value={provider}
              onValueChange={(v) => setProvider(v as "APPLE" | "CALDAV")}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="APPLE">Apple iCloud</SelectItem>
                <SelectItem value="CALDAV">CalDAV</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* CalDAV URL (only for generic CalDAV) */}
          {provider === "CALDAV" && (
            <div className="space-y-1.5">
              <Label htmlFor="caldav-url">{t("caldavUrl")}</Label>
              <Input
                id="caldav-url"
                type="url"
                value={caldavUrl}
                onChange={(e) => setCaldavUrl(e.target.value)}
                placeholder="https://example.com/dav"
                required
              />
            </div>
          )}

          {provider === "APPLE" && (
            <p className="text-xs text-muted-foreground">
              {t("appSpecificPasswordHint")}
            </p>
          )}

          {/* Username / Email */}
          <div className="space-y-1.5">
            <Label htmlFor="caldav-username">
              {provider === "APPLE" ? "Apple ID (Email)" : t("username")}
            </Label>
            <Input
              id="caldav-username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder={
                provider === "APPLE"
                  ? "name@icloud.com"
                  : t("username")
              }
              required
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <Label htmlFor="caldav-password">
              {provider === "APPLE" ? t("appSpecificPassword") : t("password")}
            </Label>
            <Input
              id="caldav-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          {/* Account label */}
          <div className="space-y-1.5">
            <Label htmlFor="caldav-label">{t("accountLabel")}</Label>
            <Input
              id="caldav-label"
              value={accountLabel}
              onChange={(e) => setAccountLabel(e.target.value)}
              placeholder={
                provider === "APPLE" ? "Apple iCloud" : "CalDAV Calendar"
              }
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

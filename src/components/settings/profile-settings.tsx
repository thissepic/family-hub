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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Save, User, KeyRound, Globe } from "lucide-react";

export function ProfileSettings() {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: family, isLoading } = useQuery(trpc.family.get.queryOptions());
  const { data: session } = useQuery(trpc.auth.getSession.queryOptions());

  const currentMember = family?.members.find(
    (m) => m.id === session?.memberId
  );

  // Profile state
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const [profileInitialized, setProfileInitialized] = useState(false);

  // PIN change state
  const [currentPin, setCurrentPin] = useState("");
  const [newPin, setNewPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");

  // Initialize form state from query data
  if (currentMember && !profileInitialized) {
    setName(currentMember.name);
    setAvatar(currentMember.avatar ?? "");
    setColor(currentMember.color);
    setProfileInitialized(true);
  }

  const updateMember = useMutation(
    trpc.members.update.mutationOptions({
      onError: (err) => {
        toast.error(err.message);
      },
    })
  );

  const changePin = useMutation(
    trpc.members.changePin.mutationOptions({
      onSuccess: () => {
        toast.success(t("pinChanged"));
        setCurrentPin("");
        setNewPin("");
        setConfirmPin("");
      },
      onError: (err) => {
        toast.error(err.message);
      },
    })
  );

  const handleChangeLocale = (value: string) => {
    if (!session?.memberId) return;
    const isDefault = value === "default";
    const newLocale = isDefault ? null : (value as "en" | "de");
    // Resolve the effective locale for the cookie
    const effectiveLocale = isDefault ? family?.defaultLocale ?? "en" : value;
    document.cookie = `locale=${effectiveLocale}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    updateMember.mutate(
      { memberId: session.memberId, locale: newLocale },
      {
        onSuccess: () => {
          const url = new URL(window.location.href);
          url.searchParams.set("_l", Date.now().toString());
          window.location.replace(url.toString());
        },
      }
    );
  };

  const handleSaveProfile = () => {
    if (!session?.memberId || !name.trim()) return;
    updateMember.mutate(
      {
        memberId: session.memberId,
        name: name.trim(),
        avatar: avatar.trim() || undefined,
        color,
      },
      {
        onSuccess: () => {
          toast.success(t("profileUpdated"));
          queryClient.invalidateQueries({ queryKey: [["family"]] });
          queryClient.invalidateQueries({ queryKey: [["members"]] });
          queryClient.invalidateQueries({ queryKey: [["auth", "listMembers"]] });
        },
      }
    );
  };

  const handleChangePin = () => {
    if (newPin !== confirmPin) {
      toast.error(t("pinMismatch"));
      return;
    }
    if (!session?.memberId) return;
    changePin.mutate({
      memberId: session.memberId,
      currentPin,
      newPin,
    });
  };

  const profileChanged =
    currentMember &&
    (name.trim() !== currentMember.name ||
      (avatar.trim() || "") !== (currentMember.avatar ?? "") ||
      color !== currentMember.color);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!currentMember) return null;

  return (
    <div className="space-y-6">
      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            {t("profileInfo")}
          </CardTitle>
          <CardDescription>{t("profileInfoDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="member-name">{t("memberName")}</Label>
            <Input
              id="member-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="max-w-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="member-avatar">{t("memberAvatar")}</Label>
            <Input
              id="member-avatar"
              value={avatar}
              onChange={(e) => setAvatar(e.target.value)}
              placeholder="🙂"
              className="max-w-xs"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="member-color">{t("memberColor")}</Label>
            <div className="flex items-center gap-3">
              <Input
                id="member-color"
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="h-10 w-16 cursor-pointer p-1"
              />
              <div
                className="flex h-10 w-10 items-center justify-center rounded-full text-white font-semibold text-sm"
                style={{ backgroundColor: color }}
              >
                {avatar || name.charAt(0).toUpperCase()}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="member-locale">
              <Globe className="mr-1.5 inline h-4 w-4" />
              {t("memberLocale")}
            </Label>
            <Select
              value={currentMember.locale ?? "default"}
              onValueChange={handleChangeLocale}
            >
              <SelectTrigger className="max-w-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="default">
                  {t("localeDefault")}
                </SelectItem>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="de">Deutsch</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              {t("memberLocaleDescription")}
            </p>
          </div>

          <Button
            onClick={handleSaveProfile}
            disabled={updateMember.isPending || !profileChanged}
            size="sm"
          >
            {updateMember.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Save className="mr-2 h-4 w-4" />
            )}
            {tCommon("save")}
          </Button>
        </CardContent>
      </Card>

      {/* Change PIN */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyRound className="h-5 w-5" />
            {t("changePin")}
          </CardTitle>
          <CardDescription>{t("changePinDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-pin">{t("currentPin")}</Label>
            <Input
              id="current-pin"
              type="password"
              value={currentPin}
              onChange={(e) => setCurrentPin(e.target.value)}
              placeholder="****"
              className="max-w-xs"
              maxLength={8}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-pin">{t("newPin")}</Label>
            <Input
              id="new-pin"
              type="password"
              value={newPin}
              onChange={(e) => setNewPin(e.target.value)}
              placeholder="****"
              className="max-w-xs"
              maxLength={8}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-pin">{t("confirmNewPin")}</Label>
            <Input
              id="confirm-pin"
              type="password"
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value)}
              placeholder="****"
              className="max-w-xs"
              maxLength={8}
            />
          </div>
          <Button
            onClick={handleChangePin}
            disabled={
              changePin.isPending ||
              !currentPin ||
              !newPin ||
              newPin.length < 4 ||
              !confirmPin
            }
          >
            {changePin.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {t("changePin")}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

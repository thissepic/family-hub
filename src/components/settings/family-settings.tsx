"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Loader2, Save, Trash2, Users, Settings, Plus, Pencil, Shield, Mail } from "lucide-react";
import { MemberDialog } from "./member-dialog";

export function FamilySettings() {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: family, isLoading } = useQuery(trpc.family.get.queryOptions());
  const { data: session } = useQuery(trpc.auth.getSession.queryOptions());

  const currentMember = family?.members.find(
    (m) => m.id === session?.memberId
  );

  // Family info state
  const [familyName, setFamilyName] = useState("");
  const [nameInitialized, setNameInitialized] = useState(false);
  const [locale, setLocale] = useState("");
  const [localeInitialized, setLocaleInitialized] = useState(false);

  // Member dialog state
  const [memberDialogOpen, setMemberDialogOpen] = useState(false);
  const [editingMemberId, setEditingMemberId] = useState<string | null>(null);

  // Change Password state
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Change Email state
  const [newEmail, setNewEmail] = useState("");
  const [emailPassword, setEmailPassword] = useState("");

  // Delete state
  const [deleteConfirmName, setDeleteConfirmName] = useState("");
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  // Initialize form state from query data
  if (family && !nameInitialized) {
    setFamilyName(family.name);
    setNameInitialized(true);
  }
  if (family && !localeInitialized) {
    setLocale(family.defaultLocale);
    setLocaleInitialized(true);
  }

  const updateFamily = useMutation(
    trpc.family.update.mutationOptions({
      onError: (err) => {
        toast.error(err.message);
      },
    })
  );

  const changePasswordMutation = useMutation(
    trpc.account.changePassword.mutationOptions({
      onSuccess: () => {
        toast.success(t("passwordChanged"));
        setCurrentPassword("");
        setNewPassword("");
        setConfirmPassword("");
      },
      onError: (err) => {
        toast.error(err.message);
      },
    })
  );

  const changeEmailMutation = useMutation(
    trpc.account.changeEmail.mutationOptions({
      onSuccess: () => {
        toast.success(t("emailChanged"));
        setNewEmail("");
        setEmailPassword("");
        queryClient.invalidateQueries({ queryKey: [["family"]] });
      },
      onError: (err) => {
        toast.error(err.message);
      },
    })
  );

  const deleteFamilyMutation = useMutation(
    trpc.family.deleteFamily.mutationOptions({
      onSuccess: () => {
        toast.success(t("familyDeleted"));
        router.push("/login");
      },
      onError: (err) => {
        toast.error(err.message);
      },
    })
  );

  const handleSaveName = () => {
    if (!familyName.trim()) return;
    updateFamily.mutate(
      { name: familyName.trim() },
      {
        onSuccess: () => {
          toast.success(t("familyUpdated"));
          queryClient.invalidateQueries({ queryKey: [["family"]] });
        },
      }
    );
  };

  const handleSaveLocale = (value: string) => {
    setLocale(value);
    // Only update the cookie if the admin uses the family default (locale === null).
    // If they have a personal language override, keep it.
    const adminUsesDefault = !currentMember?.locale;
    if (adminUsesDefault) {
      document.cookie = `locale=${value}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
    }
    updateFamily.mutate(
      { defaultLocale: value as "en" | "de" },
      {
        onSuccess: () => {
          if (adminUsesDefault) {
            const url = new URL(window.location.href);
            url.searchParams.set("_l", Date.now().toString());
            window.location.replace(url.toString());
          } else {
            toast.success(t("familyUpdated"));
            queryClient.invalidateQueries({ queryKey: [["family"]] });
          }
        },
      }
    );
  };

  const handleChangePassword = () => {
    if (newPassword !== confirmPassword) {
      toast.error(t("passwordMismatch"));
      return;
    }
    if (newPassword.length < 8) {
      toast.error(t("passwordTooShort"));
      return;
    }
    changePasswordMutation.mutate({
      currentPassword,
      newPassword,
    });
  };

  const handleChangeEmail = () => {
    if (!newEmail.trim() || !emailPassword) return;
    changeEmailMutation.mutate({
      newEmail: newEmail.trim(),
      password: emailPassword,
    });
  };

  const handleDeleteFamily = () => {
    if (!family || deleteConfirmName !== family.name) return;
    deleteFamilyMutation.mutate({ confirmName: deleteConfirmName });
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!family) return null;

  return (
    <div className="space-y-6">
      {/* Family Info */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            {t("familyInfo")}
          </CardTitle>
          <CardDescription>{t("familyInfoDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="family-name">{t("familyName")}</Label>
            <div className="flex gap-2">
              <Input
                id="family-name"
                value={familyName}
                onChange={(e) => setFamilyName(e.target.value)}
                placeholder={t("familyName")}
                className="max-w-sm"
              />
              <Button
                onClick={handleSaveName}
                disabled={updateFamily.isPending || familyName === family.name}
                size="sm"
              >
                {updateFamily.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {tCommon("save")}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="default-locale">{t("defaultLocale")}</Label>
            <Select value={locale} onValueChange={handleSaveLocale}>
              <SelectTrigger className="max-w-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="en">English</SelectItem>
                <SelectItem value="de">Deutsch</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Members Overview */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {t("members")}
              </CardTitle>
              <CardDescription>
                {t("memberCount", { count: family.members.length })}
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={() => {
                setEditingMemberId(null);
                setMemberDialogOpen(true);
              }}
            >
              <Plus className="mr-1.5 h-4 w-4" />
              {t("addMember")}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {family.members.map((member) => (
              <div
                key={member.id}
                className="flex items-center gap-3 rounded-lg border p-3 cursor-pointer hover:bg-accent/50 transition-colors"
                onClick={() => {
                  setEditingMemberId(member.id);
                  setMemberDialogOpen(true);
                }}
              >
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full text-white font-semibold text-sm"
                  style={{ backgroundColor: member.color }}
                >
                  {member.avatar ?? member.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {member.name}
                    {member.id === session?.memberId && (
                      <span className="ml-1.5 text-xs text-muted-foreground">
                        ({t("you")})
                      </span>
                    )}
                  </p>
                </div>
                <Badge
                  variant={member.role === "ADMIN" ? "default" : "secondary"}
                >
                  {member.role}
                </Badge>
                <Pencil className="h-4 w-4 text-muted-foreground" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <MemberDialog
        open={memberDialogOpen}
        onOpenChange={setMemberDialogOpen}
        memberId={editingMemberId}
        currentMemberId={session?.memberId}
      />

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            {t("changePassword")}
          </CardTitle>
          <CardDescription>{t("changePasswordDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="current-password">{t("currentPassword")}</Label>
            <Input
              id="current-password"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              placeholder="********"
              className="max-w-sm"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-password">{t("newPassword")}</Label>
            <Input
              id="new-password"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="********"
              className="max-w-sm"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="confirm-password">{t("confirmNewPassword")}</Label>
            <Input
              id="confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="********"
              className="max-w-sm"
            />
          </div>
          <Button
            onClick={handleChangePassword}
            disabled={
              changePasswordMutation.isPending ||
              !currentPassword ||
              !newPassword ||
              newPassword.length < 8 ||
              !confirmPassword
            }
          >
            {changePasswordMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {t("changePassword")}
          </Button>
        </CardContent>
      </Card>

      {/* Change Email */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            {t("changeEmail")}
          </CardTitle>
          <CardDescription>{t("changeEmailDescription")}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>{t("currentEmail")}</Label>
            <p className="text-sm text-muted-foreground">{family.email}</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="new-email">{t("newEmail")}</Label>
            <Input
              id="new-email"
              type="email"
              value={newEmail}
              onChange={(e) => setNewEmail(e.target.value)}
              placeholder="new@email.com"
              className="max-w-sm"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email-password">{t("verifyPassword")}</Label>
            <Input
              id="email-password"
              type="password"
              value={emailPassword}
              onChange={(e) => setEmailPassword(e.target.value)}
              placeholder="********"
              className="max-w-sm"
            />
            <p className="text-xs text-muted-foreground">
              {t("verifyPasswordDescription")}
            </p>
          </div>
          <Button
            onClick={handleChangeEmail}
            disabled={
              changeEmailMutation.isPending ||
              !newEmail.trim() ||
              !emailPassword
            }
          >
            {changeEmailMutation.isPending && (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            )}
            {t("changeEmail")}
          </Button>
          <p className="text-xs text-muted-foreground">
            {t("emailChangedNote")}
          </p>
        </CardContent>
      </Card>

      {/* Danger Zone */}
      <Card className="border-destructive/50">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">
            <Trash2 className="h-5 w-5" />
            {t("dangerZone")}
          </CardTitle>
          <CardDescription>{t("dangerZoneDescription")}</CardDescription>
        </CardHeader>
        <CardContent>
          <AlertDialog
            open={deleteDialogOpen}
            onOpenChange={setDeleteDialogOpen}
          >
            <AlertDialogTrigger asChild>
              <Button variant="destructive">{t("deleteFamily")}</Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  {t("deleteFamilyConfirm")}
                </AlertDialogTitle>
                <AlertDialogDescription>
                  {t("deleteFamilyDescription")}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="py-4 space-y-2">
                <Label>{t("typeFamilyName", { name: family.name })}</Label>
                <Input
                  value={deleteConfirmName}
                  onChange={(e) => setDeleteConfirmName(e.target.value)}
                  placeholder={family.name}
                />
              </div>
              <AlertDialogFooter>
                <AlertDialogCancel
                  onClick={() => setDeleteConfirmName("")}
                >
                  {tCommon("cancel")}
                </AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDeleteFamily}
                  disabled={
                    deleteFamilyMutation.isPending ||
                    deleteConfirmName !== family.name
                  }
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {deleteFamilyMutation.isPending && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  {t("deleteFamily")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </CardContent>
      </Card>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { ColorPicker } from "@/components/setup/color-picker";
import {
  Loader2,
  Trash2,
  KeyRound,
  UserCheck,
  UserX,
  Mail,
  Copy,
  Check,
} from "lucide-react";

interface MemberDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  memberId?: string | null;
  currentMemberId?: string;
}

export function MemberDialog({
  open,
  onOpenChange,
  memberId,
  currentMemberId,
}: MemberDialogProps) {
  const t = useTranslations("settings");
  const tCommon = useTranslations("common");
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const isEditing = !!memberId;
  const isSelf = memberId === currentMemberId;

  // Form state
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("");
  const [color, setColor] = useState("#3b82f6");
  const [role, setRole] = useState<"ADMIN" | "MEMBER">("MEMBER");
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [email, setEmail] = useState("");

  // Dialog states
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showResetPin, setShowResetPin] = useState(false);
  const [resetPinValue, setResetPinValue] = useState("");
  const [resetPinConfirm, setResetPinConfirm] = useState("");

  // Invite state
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteSent, setInviteSent] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);

  // Fetch member data for editing
  const { data: members } = useQuery(
    trpc.members.list.queryOptions(undefined, { enabled: open })
  );

  // Fetch invitations to check for pending profile invites
  const { data: invitations } = useQuery(
    trpc.invitations.list.queryOptions(undefined, { enabled: open && isEditing })
  );

  const member = members?.find((m) => m.id === memberId);
  const isLinked = member?.userId !== null && member?.userId !== undefined;

  // Check if there's already a pending invitation for this profile
  const pendingInvite = invitations?.find(
    (inv: { forMember?: { id: string } | null; status: string; expiresAt: string | Date; email?: string | null }) =>
      inv.forMember?.id === memberId &&
      inv.status === "PENDING" &&
      new Date(inv.expiresAt) > new Date()
  );

  // Initialize form when member data loads
  useEffect(() => {
    if (member && isEditing) {
      setName(member.name);
      setAvatar(member.avatar ?? "");
      setColor(member.color);
      setRole(member.role as "ADMIN" | "MEMBER");
    } else if (!isEditing && open) {
      setName("");
      setAvatar("");
      setColor("#3b82f6");
      setRole("MEMBER");
      setPin("");
      setConfirmPin("");
      setEmail("");
    }
    // Reset invite state when opening/closing
    setInviteEmail("");
    setInviteSent(false);
    setInviteToken(null);
    setLinkCopied(false);
  }, [member, isEditing, open]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [["family"]] });
    queryClient.invalidateQueries({ queryKey: [["members"]] });
    queryClient.invalidateQueries({ queryKey: [["auth", "listMembers"]] });
    queryClient.invalidateQueries({ queryKey: [["invitations"]] });
  };

  const createMutation = useMutation(
    trpc.members.adminCreate.mutationOptions({
      onSuccess: () => {
        toast.success(t("memberCreated"));
        invalidate();
        onOpenChange(false);
      },
      onError: (err) => {
        toast.error(err.message);
      },
    })
  );

  const updateMutation = useMutation(
    trpc.members.update.mutationOptions({
      onSuccess: () => {
        toast.success(t("memberUpdated"));
        invalidate();
        onOpenChange(false);
      },
      onError: (err) => {
        toast.error(err.message);
      },
    })
  );

  const updateRoleMutation = useMutation(
    trpc.members.updateRole.mutationOptions({
      onSuccess: () => {
        toast.success(t("roleUpdated"));
        invalidate();
      },
      onError: (err) => {
        toast.error(err.message);
      },
    })
  );

  const deleteMutation = useMutation(
    trpc.members.delete.mutationOptions({
      onSuccess: () => {
        toast.success(t("memberDeleted"));
        invalidate();
        onOpenChange(false);
        setShowDeleteConfirm(false);
      },
      onError: (err) => {
        toast.error(err.message);
      },
    })
  );

  const resetPinMutation = useMutation(
    trpc.members.adminResetPin.mutationOptions({
      onSuccess: () => {
        toast.success(t("pinResetSuccess"));
        setShowResetPin(false);
        setResetPinValue("");
        setResetPinConfirm("");
      },
      onError: (err) => {
        toast.error(err.message);
      },
    })
  );

  const sendInviteMutation = useMutation(
    trpc.invitations.create.mutationOptions({
      onSuccess: (data) => {
        setInviteSent(true);
        setInviteToken(data.token);
        toast.success(t("profileInviteSent", { email: inviteEmail }));
        queryClient.invalidateQueries({ queryKey: [["invitations"]] });
      },
      onError: (err) => {
        toast.error(err.message);
      },
    })
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (isEditing && memberId) {
      updateMutation.mutate({
        memberId,
        name: name.trim(),
        avatar: avatar.trim() || undefined,
        color,
      });
    } else {
      if (pin !== confirmPin) {
        toast.error(t("pinMismatch"));
        return;
      }
      createMutation.mutate({
        name: name.trim(),
        avatar: avatar.trim() || undefined,
        color,
        pin: pin || undefined,
        role,
        email: email.trim() || undefined,
      });
    }
  };

  const handleRoleChange = (newRole: "ADMIN" | "MEMBER") => {
    setRole(newRole);
    if (isEditing && memberId) {
      updateRoleMutation.mutate({ memberId, role: newRole });
    }
  };

  const handleDelete = () => {
    if (!memberId) return;
    deleteMutation.mutate({ memberId });
  };

  const handleResetPin = () => {
    if (!memberId) return;
    if (resetPinValue !== resetPinConfirm) {
      toast.error(t("pinMismatch"));
      return;
    }
    resetPinMutation.mutate({ memberId, newPin: resetPinValue });
  };

  const handleSendInvite = () => {
    if (!memberId || !inviteEmail.trim()) return;
    sendInviteMutation.mutate({
      email: inviteEmail.trim(),
      forMemberId: memberId,
    });
  };

  const handleCopyInviteLink = async () => {
    if (!inviteToken) return;
    const url = `${window.location.origin}/invite/${inviteToken}`;
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {isEditing ? t("editMember") : t("addMember")}
            </DialogTitle>
          </DialogHeader>

          {/* Linked/Unlinked Status Badge (edit mode only) */}
          {isEditing && member && !isSelf && (
            <div className="flex items-center gap-2">
              {isLinked ? (
                <Badge variant="default" className="gap-1">
                  <UserCheck className="h-3 w-3" />
                  {t("accountLinked")}
                </Badge>
              ) : (
                <Badge variant="outline" className="gap-1 border-amber-500 text-amber-600 dark:text-amber-400">
                  <UserX className="h-3 w-3" />
                  {t("noAccountLinked")}
                </Badge>
              )}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="member-name">{t("memberName")}</Label>
              <Input
                id="member-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t("memberName")}
                maxLength={50}
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="member-avatar">{t("memberAvatar")}</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="member-avatar"
                  value={avatar}
                  onChange={(e) => setAvatar(e.target.value)}
                  placeholder="🙂"
                  className="max-w-24"
                />
                <div
                  className="flex h-10 w-10 items-center justify-center rounded-full text-white font-semibold text-sm"
                  style={{ backgroundColor: color }}
                >
                  {avatar || name.charAt(0).toUpperCase() || "?"}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{t("memberColor")}</Label>
              <ColorPicker value={color} onChange={setColor} />
            </div>

            {!isSelf && (
              <div className="space-y-1.5">
                <Label>{t("memberRole")}</Label>
                <Select
                  value={role}
                  onValueChange={(v) =>
                    handleRoleChange(v as "ADMIN" | "MEMBER")
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ADMIN">Admin</SelectItem>
                    <SelectItem value="MEMBER">Member</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* PIN fields only when creating */}
            {!isEditing && (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="member-pin">{t("memberPin")}</Label>
                  <Input
                    id="member-pin"
                    type="password"
                    value={pin}
                    onChange={(e) => setPin(e.target.value)}
                    placeholder="****"
                    minLength={4}
                    maxLength={8}
                  />
                </div>

                {pin && (
                  <div className="space-y-1.5">
                    <Label htmlFor="member-confirm-pin">{t("confirmPin")}</Label>
                    <Input
                      id="member-confirm-pin"
                      type="password"
                      value={confirmPin}
                      onChange={(e) => setConfirmPin(e.target.value)}
                      placeholder="****"
                      minLength={4}
                      maxLength={8}
                    />
                  </div>
                )}

                {/* Email field for pre-linking when creating */}
                <div className="space-y-1.5">
                  <Label htmlFor="member-email">{t("inviteEmailLabel")}</Label>
                  <Input
                    id="member-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="email@example.com"
                  />
                  <p className="text-xs text-muted-foreground">{t("emailHint")}</p>
                </div>
              </>
            )}

            <Button
              type="submit"
              disabled={
                isSubmitting ||
                !name.trim() ||
                (!isEditing && pin.length > 0 && (pin.length < 4 || !confirmPin))
              }
              className="w-full"
            >
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {isEditing ? tCommon("save") : t("addMember")}
            </Button>
          </form>

          {/* Actions section (edit mode, not self) */}
          {isEditing && member && !isSelf && (
            <div className="space-y-2 border-t pt-3">
              {/* Invite action for unlinked profiles */}
              {!isLinked && !pendingInvite && (
                <div className="space-y-2 rounded-lg border bg-muted/30 p-3">
                  <p className="text-sm font-medium">{t("sendInviteToMember")}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("profileInviteDescription")}
                  </p>
                  {!inviteSent ? (
                    <div className="flex gap-2">
                      <Input
                        type="email"
                        placeholder="email@example.com"
                        value={inviteEmail}
                        onChange={(e) => setInviteEmail(e.target.value)}
                        className="text-sm"
                      />
                      <Button
                        type="button"
                        size="sm"
                        onClick={handleSendInvite}
                        disabled={
                          sendInviteMutation.isPending || !inviteEmail.trim()
                        }
                      >
                        {sendInviteMutation.isPending ? (
                          <>
                            <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                            {t("profileInviteSending")}
                          </>
                        ) : (
                          <>
                            <Mail className="mr-1 h-3 w-3" />
                            {t("sendProfileInvite")}
                          </>
                        )}
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm text-green-600 dark:text-green-400">
                        ✓ {t("profileInviteSent", { email: inviteEmail })}
                      </p>
                      {inviteToken && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={handleCopyInviteLink}
                          className="w-full"
                        >
                          {linkCopied ? (
                            <>
                              <Check className="mr-1 h-3 w-3" />
                              Link copied!
                            </>
                          ) : (
                            <>
                              <Copy className="mr-1 h-3 w-3" />
                              Copy invite link
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Show pending invitation if one exists */}
              {!isLinked && pendingInvite && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-3">
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    <Mail className="inline h-3 w-3 mr-1" />
                    {t("pendingProfileInvite", {
                      email: (pendingInvite as { email?: string | null }).email ?? "link",
                    })}
                  </p>
                </div>
              )}

              <Button
                type="button"
                variant="outline"
                onClick={() => setShowResetPin(true)}
                className="w-full"
              >
                <KeyRound className="mr-2 h-4 w-4" />
                {t("resetPin")}
              </Button>
              <Button
                type="button"
                variant="destructive"
                onClick={() => setShowDeleteConfirm(true)}
                disabled={deleteMutation.isPending}
                className="w-full"
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t("deleteMember")}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("confirmDeleteMember")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("confirmDeleteMemberDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t("deleteMember")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset PIN Dialog */}
      <AlertDialog
        open={showResetPin}
        onOpenChange={(open) => {
          setShowResetPin(open);
          if (!open) {
            setResetPinValue("");
            setResetPinConfirm("");
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("resetPin")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("resetPinDescription", { name: member?.name ?? "" })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-3 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="reset-pin">{t("newPin")}</Label>
              <Input
                id="reset-pin"
                type="password"
                value={resetPinValue}
                onChange={(e) => setResetPinValue(e.target.value)}
                placeholder="****"
                minLength={4}
                maxLength={8}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="reset-pin-confirm">{t("confirmPin")}</Label>
              <Input
                id="reset-pin-confirm"
                type="password"
                value={resetPinConfirm}
                onChange={(e) => setResetPinConfirm(e.target.value)}
                placeholder="****"
                minLength={4}
                maxLength={8}
              />
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{tCommon("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleResetPin}
              disabled={
                resetPinMutation.isPending ||
                resetPinValue.length < 4 ||
                !resetPinConfirm
              }
            >
              {resetPinMutation.isPending && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {t("resetPin")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

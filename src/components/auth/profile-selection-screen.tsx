"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function ProfileSelectionScreen() {
  const t = useTranslations("auth");
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [selectedMember, setSelectedMember] = useState<string | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  // Use the profile-selection endpoint (works at Layer 2)
  const { data: members = [] } = useQuery(trpc.members.listForProfileSelection.queryOptions());

  // Fetch family info
  const { data: family } = useQuery(trpc.family.get.queryOptions());

  const selectProfileMutation = useMutation(
    trpc.auth.selectProfile.mutationOptions({
      onSuccess: () => {
        queryClient.clear();
        router.push("/");
        router.refresh();
      },
      onError: () => {
        setError(t("wrongPin"));
        setPin("");
      },
    })
  );

  const switchFamilyMutation = useMutation(
    trpc.auth.switchFamily.mutationOptions({
      onSuccess: () => {
        queryClient.clear();
        router.push("/families");
        router.refresh();
      },
    })
  );

  const logoutMutation = useMutation(
    trpc.auth.logout.mutationOptions({
      onSuccess: () => {
        queryClient.clear();
        router.push("/login");
        router.refresh();
      },
    })
  );

  const selectedMemberData = members.find((m) => m.id === selectedMember);

  // Auto-submit when selecting a profile that skips PIN
  useEffect(() => {
    if (selectedMember && selectedMemberData?.skipPin) {
      selectProfileMutation.mutate({ memberId: selectedMember });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMember]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMember) return;
    setError("");
    selectProfileMutation.mutate({
      memberId: selectedMember,
      pin: pin || undefined,
    });
  };

  const getInitials = (name: string) =>
    name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);

  // Show PIN form only for profiles that need PIN
  const showPinForm = selectedMember && selectedMemberData && !selectedMemberData.skipPin;

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="text-4xl mb-2">🏠</div>
          <CardTitle className="text-xl">
            {family?.name || "Family Hub"}
          </CardTitle>
          <p className="text-sm text-muted-foreground mt-1">
            {t("selectProfile")}
          </p>
        </CardHeader>
        <CardContent>
          {!showPinForm ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                {members.map((member) => (
                  <button
                    key={member.id}
                    onClick={() => member.canSelect ? setSelectedMember(member.id) : undefined}
                    disabled={!member.canSelect}
                    className={`flex flex-col items-center gap-2 p-3 rounded-lg transition-colors ${
                      member.canSelect
                        ? "hover:bg-accent cursor-pointer"
                        : "opacity-40 cursor-not-allowed"
                    }`}
                  >
                    <Avatar className="h-14 w-14">
                      <AvatarFallback
                        style={{ backgroundColor: member.color }}
                        className="text-white text-lg"
                      >
                        {member.avatar || getInitials(member.name)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm font-medium">{member.name}</span>
                    {member.isOwnProfile && (
                      <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                        {t("you")}
                      </Badge>
                    )}
                    {!member.isLinked && member.canSelect && (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                        {t("unlinkedProfile")}
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
              <div className="pt-2 border-t space-y-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground"
                  onClick={() => switchFamilyMutation.mutate()}
                  disabled={switchFamilyMutation.isPending}
                >
                  {t("switchFamily")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground"
                  onClick={() => logoutMutation.mutate()}
                  disabled={logoutMutation.isPending}
                >
                  {t("switchAccount")}
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="flex flex-col items-center gap-2 mb-4">
                <Avatar className="h-16 w-16">
                  <AvatarFallback
                    style={{
                      backgroundColor: selectedMemberData?.color || "#3b82f6",
                    }}
                    className="text-white text-xl"
                  >
                    {selectedMemberData?.avatar ||
                      getInitials(selectedMemberData?.name || "")}
                  </AvatarFallback>
                </Avatar>
                <span className="font-medium">{selectedMemberData?.name}</span>
              </div>

              <div>
                <Input
                  type="password"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  placeholder={t("enterPinOptional")}
                  value={pin}
                  onChange={(e) => setPin(e.target.value)}
                  className="text-center text-lg tracking-widest"
                  autoFocus
                />
                {error && (
                  <p className="text-sm text-destructive mt-2 text-center">
                    {error}
                  </p>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setSelectedMember(null);
                    setPin("");
                    setError("");
                  }}
                >
                  {t("back")}
                </Button>
                <Button
                  type="submit"
                  className="flex-1"
                  disabled={selectProfileMutation.isPending}
                >
                  {t("continue")}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

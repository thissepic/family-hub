"use client";

import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Plus } from "lucide-react";

export function FamilySelectorScreen() {
  const t = useTranslations("auth");
  const router = useRouter();
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const { data: families = [], isLoading } = useQuery(
    trpc.family.listFamilies.queryOptions()
  );

  const { data: pendingInvitations = [] } = useQuery(
    trpc.invitations.myPendingInvitations.queryOptions()
  );

  const selectFamilyMutation = useMutation(
    trpc.auth.selectFamily.mutationOptions({
      onSuccess: (result) => {
        queryClient.clear();
        if (result.autoResolved) {
          // Member auto-resolved → go straight to dashboard
          router.push("/");
        } else {
          // Need to select a profile
          router.push("/profiles");
        }
        router.refresh();
      },
    })
  );

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader className="text-center">
            <div className="text-4xl mb-2">🏠</div>
            <CardTitle className="text-xl">{t("selectFamily")}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">
              {t("selectFamilyDescription")}
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">
                {t("loading")}
              </div>
            ) : families.length === 0 ? (
              <div className="text-center py-4 text-muted-foreground">
                <p>{t("noFamilies")}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {families.map((family: {
                  familyId: string;
                  familyName: string;
                  memberName: string;
                  memberColor: string;
                  memberRole: string;
                  memberAvatar: string | null;
                }) => (
                  <button
                    key={family.familyId}
                    onClick={() => selectFamilyMutation.mutate({ familyId: family.familyId })}
                    disabled={selectFamilyMutation.isPending}
                    className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-accent transition-colors text-left"
                  >
                    <Avatar className="h-10 w-10">
                      <AvatarFallback
                        style={{ backgroundColor: family.memberColor }}
                        className="text-white"
                      >
                        {family.memberAvatar ||
                          family.memberName
                            .split(" ")
                            .map((n: string) => n[0])
                            .join("")
                            .toUpperCase()
                            .slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{family.familyName}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {family.memberName} ({family.memberRole === "ADMIN" ? t("admin") : t("member")})
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            {/* Pending invitations */}
            {pendingInvitations.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">
                  {t("pendingInvitations")}
                </p>
                {pendingInvitations.map((inv: {
                  id: string;
                  family: { id: string; name: string };
                  invitedBy: { name: string };
                  token?: string;
                }) => (
                  <button
                    key={inv.id}
                    onClick={() => router.push(`/invite/${(inv as unknown as { token: string }).token || inv.id}`)}
                    className="w-full flex items-center gap-3 p-3 rounded-lg border border-dashed hover:bg-accent transition-colors text-left"
                  >
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <Plus className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{inv.family.name}</p>
                      <p className="text-sm text-muted-foreground truncate">
                        {t("invitedBy", { name: inv.invitedBy.name })}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => router.push("/create-family")}
              >
                <Plus className="h-4 w-4 mr-2" />
                {t("createNewFamily")}
              </Button>
            </div>

          </CardContent>
        </Card>
      </div>
    </div>
  );
}

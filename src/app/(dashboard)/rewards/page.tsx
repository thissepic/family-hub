"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { XpProfileCard } from "@/components/rewards/xp-profile-card";
import { XpHistory } from "@/components/rewards/xp-history";
import { AchievementGallery } from "@/components/rewards/achievement-gallery";
import { RewardsShop } from "@/components/rewards/rewards-shop";
import { RedemptionList } from "@/components/rewards/redemption-list";
import { Leaderboard } from "@/components/rewards/leaderboard";
import { GoalsList } from "@/components/rewards/goals-list";
import { XpSettingsPanel } from "@/components/rewards/xp-settings-panel";
import { AchievementDialog } from "@/components/rewards/achievement-dialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function RewardsPage() {
  const t = useTranslations("rewards");
  const trpc = useTRPC();

  const { data: session } = useQuery(trpc.auth.getSession.queryOptions());
  const isAdmin = session?.role === "ADMIN";
  const currentMemberId = session?.memberId ?? "";

  const [achievementDialogOpen, setAchievementDialogOpen] = useState(false);
  const [editingAchievement, setEditingAchievement] = useState<Record<string, unknown> | null>(null);

  // Read tab from URL search params if present
  const defaultTab = typeof window !== "undefined"
    ? new URLSearchParams(window.location.search).get("tab") || "progress"
    : "progress";

  const handleEditAchievement = (achievement: Record<string, unknown>) => {
    setEditingAchievement(achievement);
    setAchievementDialogOpen(true);
  };

  const handleCreateAchievement = () => {
    setEditingAchievement(null);
    setAchievementDialogOpen(true);
  };

  const handleAchievementDialogChange = (open: boolean) => {
    setAchievementDialogOpen(open);
    if (!open) setEditingAchievement(null);
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>

      <Tabs defaultValue={defaultTab}>
        <TabsList className="w-full justify-start overflow-x-auto overflow-y-hidden">
          <TabsTrigger value="progress">{t("tabProgress")}</TabsTrigger>
          <TabsTrigger value="achievements">{t("tabAchievements")}</TabsTrigger>
          <TabsTrigger value="shop">{t("tabShop")}</TabsTrigger>
          <TabsTrigger value="leaderboard">{t("tabLeaderboard")}</TabsTrigger>
          <TabsTrigger value="goals">{t("tabGoals")}</TabsTrigger>
          {isAdmin && (
            <TabsTrigger value="manage">{t("tabManage")}</TabsTrigger>
          )}
        </TabsList>

        {/* My Progress */}
        <TabsContent value="progress" className="space-y-4 mt-4">
          <XpProfileCard />
          <XpHistory />
        </TabsContent>

        {/* Achievements */}
        <TabsContent value="achievements" className="mt-4">
          <AchievementGallery />
        </TabsContent>

        {/* Shop */}
        <TabsContent value="shop" className="space-y-6 mt-4">
          <RewardsShop isAdmin={isAdmin} />
          <RedemptionList isAdmin={isAdmin} />
        </TabsContent>

        {/* Leaderboard */}
        <TabsContent value="leaderboard" className="mt-4">
          <Leaderboard currentMemberId={currentMemberId} />
        </TabsContent>

        {/* Family Goals */}
        <TabsContent value="goals" className="mt-4">
          <GoalsList isAdmin={isAdmin} />
        </TabsContent>

        {/* Admin Manage */}
        {isAdmin && (
          <TabsContent value="manage" className="space-y-6 mt-4">
            <XpSettingsPanel />

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold">
                  {t("achievements")}
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleCreateAchievement}
                >
                  <Plus className="mr-1.5 h-4 w-4" />
                  {t("createAchievement")}
                </Button>
              </div>
              <AchievementGallery
                isAdmin
                onEdit={handleEditAchievement}
              />
            </div>

            <AchievementDialog
              open={achievementDialogOpen}
              onOpenChange={handleAchievementDialogChange}
              achievement={editingAchievement as any}
              onSuccess={() => {
                setAchievementDialogOpen(false);
                setEditingAchievement(null);
              }}
            />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}

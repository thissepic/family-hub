"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MemberFilter } from "@/components/shared/member-filter";
import { MyChoresView } from "@/components/chores/my-chores-view";
import { AllChoresView } from "@/components/chores/all-chores-view";
import { FairnessView } from "@/components/chores/fairness-view";
import { ChoreDialog } from "@/components/chores/chore-dialog";
import { useTRPC } from "@/lib/trpc/client";

export default function ChoresPage() {
  const t = useTranslations("chores");
  const trpc = useTRPC();

  const { data: session } = useQuery(trpc.auth.getSession.queryOptions());

  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedChoreId, setSelectedChoreId] = useState<string | null>(null);

  const isAdmin = session?.role === "ADMIN";
  const currentMemberId = session?.memberId ?? "";

  const handleNewChore = () => {
    setSelectedChoreId(null);
    setDialogOpen(true);
  };

  const handleEditChore = (choreId: string) => {
    setSelectedChoreId(choreId);
    setDialogOpen(true);
  };

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setSelectedChoreId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <Button onClick={handleNewChore} size="sm">
          <Plus className="mr-1.5 h-4 w-4" />
          {t("newChore")}
        </Button>
      </div>

      {/* Member Filter */}
      <MemberFilter
        selectedMemberIds={selectedMemberIds}
        onChange={setSelectedMemberIds}
        translationNamespace="chores"
      />

      {/* Tabs */}
      <Tabs defaultValue="myChores">
        <TabsList>
          <TabsTrigger value="myChores">{t("myChores")}</TabsTrigger>
          <TabsTrigger value="allChores">{t("allChores")}</TabsTrigger>
          <TabsTrigger value="fairness">{t("fairness")}</TabsTrigger>
        </TabsList>

        <TabsContent value="myChores" className="mt-4">
          <MyChoresView
            selectedMemberIds={selectedMemberIds}
            isAdmin={isAdmin}
            currentMemberId={currentMemberId}
            onEditChore={handleEditChore}
            onNewChore={handleNewChore}
          />
        </TabsContent>

        <TabsContent value="allChores" className="mt-4">
          <AllChoresView
            selectedMemberIds={selectedMemberIds}
            onEditChore={handleEditChore}
            onNewChore={handleNewChore}
          />
        </TabsContent>

        <TabsContent value="fairness" className="mt-4">
          <FairnessView />
        </TabsContent>
      </Tabs>

      {/* Chore Dialog */}
      <ChoreDialog
        open={dialogOpen}
        onOpenChange={handleDialogChange}
        choreId={selectedChoreId}
      />
    </div>
  );
}

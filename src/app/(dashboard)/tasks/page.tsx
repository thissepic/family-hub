"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MemberFilter } from "@/components/shared/member-filter";
import { TodayBoard } from "@/components/tasks/today-board";
import { AllTasksView } from "@/components/tasks/all-tasks-view";
import { TaskDialog } from "@/components/tasks/task-dialog";
import { TemplateManager } from "@/components/tasks/template-manager";

export default function TasksPage() {
  const t = useTranslations("tasks");

  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Auto-open new task dialog from command palette (?new=1)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("new") === "1") {
      setSelectedTaskId(null);
      setDialogOpen(true);
      window.history.replaceState({}, "", "/tasks");
    }
  }, []);

  const handleNewTask = () => {
    setSelectedTaskId(null);
    setDialogOpen(true);
  };

  const handleEditTask = (taskId: string) => {
    setSelectedTaskId(taskId);
    setDialogOpen(true);
  };

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setSelectedTaskId(null);
    }
  };

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <div className="flex items-center gap-2">
          <TemplateManager />
          <Button onClick={handleNewTask} size="sm">
            <Plus className="mr-1.5 h-4 w-4" />
            {t("newTask")}
          </Button>
        </div>
      </div>

      {/* Member Filter */}
      <MemberFilter
        selectedMemberIds={selectedMemberIds}
        onChange={setSelectedMemberIds}
      />

      {/* Tabs */}
      <Tabs defaultValue="today">
        <TabsList>
          <TabsTrigger value="today">{t("todayBoard")}</TabsTrigger>
          <TabsTrigger value="all">{t("allTasks")}</TabsTrigger>
        </TabsList>

        <TabsContent value="today" className="mt-4">
          <TodayBoard
            selectedMemberIds={selectedMemberIds}
            onEditTask={handleEditTask}
            onNewTask={handleNewTask}
          />
        </TabsContent>

        <TabsContent value="all" className="mt-4">
          <AllTasksView
            selectedMemberIds={selectedMemberIds}
            onEditTask={handleEditTask}
            onNewTask={handleNewTask}
          />
        </TabsContent>
      </Tabs>

      {/* Task Dialog */}
      <TaskDialog
        open={dialogOpen}
        onOpenChange={handleDialogChange}
        taskId={selectedTaskId}
      />
    </div>
  );
}

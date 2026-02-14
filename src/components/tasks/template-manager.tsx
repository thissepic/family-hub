"use client";

import { useState, useEffect, useCallback } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { BookTemplate, Download, Upload, Trash2 } from "lucide-react";

interface TemplateTask {
  title: string;
  description?: string;
  priority: "LOW" | "MEDIUM" | "HIGH";
  recurrenceRule?: string;
}

interface Template {
  id: string;
  name: string;
  tasks: TemplateTask[];
  createdAt: string;
}

const STORAGE_KEY = "family-hub-task-templates";

function loadTemplates(): Template[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveTemplates(templates: Template[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(templates));
}

export function TemplateManager() {
  const t = useTranslations("tasks");
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [templates, setTemplates] = useState<Template[]>([]);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [selectedAssigneeIds, setSelectedAssigneeIds] = useState<string[]>([]);

  useEffect(() => {
    setTemplates(loadTemplates());
  }, []);

  const { data: members } = useQuery(trpc.members.list.queryOptions());
  const { data: allTasks } = useQuery(trpc.tasks.list.queryOptions({}));

  const bulkCreateMutation = useMutation(
    trpc.tasks.bulkCreate.mutationOptions({
      onSuccess: (data) => {
        toast.success(
          t("templateLoaded", { count: String(data.count) })
        );
        queryClient.invalidateQueries({ queryKey: [["tasks"]] });
        setShowLoadDialog(false);
        setSelectedTemplate(null);
        setSelectedAssigneeIds([]);
      },
    })
  );

  const handleSaveTemplate = useCallback(() => {
    if (!templateName.trim() || !allTasks?.length) return;

    const templateTasks: TemplateTask[] = allTasks.map((task) => ({
      title: task.title,
      description: task.description ?? undefined,
      priority: task.priority as "LOW" | "MEDIUM" | "HIGH",
      recurrenceRule: task.recurrenceRule ?? undefined,
    }));

    const newTemplate: Template = {
      id: crypto.randomUUID(),
      name: templateName.trim(),
      tasks: templateTasks,
      createdAt: new Date().toISOString(),
    };

    const updated = [...templates, newTemplate];
    setTemplates(updated);
    saveTemplates(updated);
    toast.success(t("templateSaved"));
    setShowSaveDialog(false);
    setTemplateName("");
  }, [templateName, allTasks, templates, t]);

  const handleLoadTemplate = useCallback(() => {
    if (!selectedTemplate || selectedAssigneeIds.length === 0) return;

    bulkCreateMutation.mutate({
      tasks: selectedTemplate.tasks.map((task) => ({
        title: task.title,
        description: task.description,
        priority: task.priority,
        recurrenceRule: task.recurrenceRule,
        assigneeIds: selectedAssigneeIds,
      })),
    });
  }, [selectedTemplate, selectedAssigneeIds, bulkCreateMutation]);

  const handleDeleteTemplate = useCallback(
    (templateId: string) => {
      const updated = templates.filter((t) => t.id !== templateId);
      setTemplates(updated);
      saveTemplates(updated);
    },
    [templates]
  );

  const toggleAssignee = (memberId: string) => {
    setSelectedAssigneeIds((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm">
            <BookTemplate className="mr-1.5 h-4 w-4" />
            {t("templates")}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => {
              setTemplateName("");
              setShowSaveDialog(true);
            }}
            disabled={!allTasks?.length}
          >
            <Upload className="mr-2 h-4 w-4" />
            {t("saveTemplate")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          {templates.length === 0 ? (
            <DropdownMenuItem disabled>
              {t("noTemplates")}
            </DropdownMenuItem>
          ) : (
            templates.map((tmpl) => (
              <DropdownMenuItem
                key={tmpl.id}
                onClick={() => {
                  setSelectedTemplate(tmpl);
                  setSelectedAssigneeIds([]);
                  setShowLoadDialog(true);
                }}
              >
                <Download className="mr-2 h-4 w-4" />
                {tmpl.name}
                <span className="ml-auto text-xs text-muted-foreground">
                  ({tmpl.tasks.length})
                </span>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Save Template Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("saveTemplate")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="template-name">{t("templateName")}</Label>
              <Input
                id="template-name"
                placeholder={t("templateNamePlaceholder")}
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                autoFocus
              />
            </div>
            {allTasks && (
              <p className="text-xs text-muted-foreground">
                {allTasks.length} tasks will be saved to this template.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowSaveDialog(false)}
            >
              {t("cancel")}
            </Button>
            <Button
              onClick={handleSaveTemplate}
              disabled={!templateName.trim()}
            >
              {t("saveTemplate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Load Template Dialog */}
      <Dialog open={showLoadDialog} onOpenChange={setShowLoadDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("loadTemplate")}</DialogTitle>
          </DialogHeader>
          {selectedTemplate && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium">{selectedTemplate.name}</p>
                <p className="text-xs text-muted-foreground">
                  {selectedTemplate.tasks.length} tasks
                </p>
              </div>

              {/* Task preview */}
              <div className="max-h-40 overflow-y-auto space-y-1 rounded-md border p-2">
                {selectedTemplate.tasks.map((task, i) => (
                  <p key={i} className="text-xs truncate">
                    • {task.title}{" "}
                    <span className="text-muted-foreground">
                      ({task.priority.toLowerCase()})
                    </span>
                  </p>
                ))}
              </div>

              {/* Assignee selection */}
              <div className="space-y-1.5">
                <Label>{t("selectAssigneesForTemplate")}</Label>
                <div className="space-y-2">
                  {members?.map((member) => (
                    <label
                      key={member.id}
                      className="flex items-center gap-2 cursor-pointer"
                    >
                      <Checkbox
                        checked={selectedAssigneeIds.includes(member.id)}
                        onCheckedChange={() => toggleAssignee(member.id)}
                      />
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: member.color }}
                      />
                      <span className="text-sm">{member.name}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Delete template */}
              <Button
                variant="ghost"
                size="sm"
                className="text-destructive"
                onClick={() => {
                  handleDeleteTemplate(selectedTemplate.id);
                  setShowLoadDialog(false);
                  setSelectedTemplate(null);
                }}
              >
                <Trash2 className="mr-1.5 h-3.5 w-3.5" />
                {t("deleteTemplate")}
              </Button>
            </div>
          )}
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowLoadDialog(false)}
            >
              {t("cancel")}
            </Button>
            <Button
              onClick={handleLoadTemplate}
              disabled={
                selectedAssigneeIds.length === 0 ||
                bulkCreateMutation.isPending
              }
            >
              {t("loadTemplate")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

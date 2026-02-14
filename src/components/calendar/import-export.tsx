"use client";

import { useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";
import { Upload, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export function ImportExport() {
  const t = useTranslations("calendar");
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [importOpen, setImportOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const importMutation = useMutation(
    trpc.calendar.importIcal.mutationOptions({
      onSuccess: (result) => {
        toast.success(t("importSuccess", { count: String(result.count) }));
        queryClient.invalidateQueries({ queryKey: [["calendar"]] });
        setImportOpen(false);
      },
      onError: () => {
        toast.error(t("importError"));
      },
    })
  );

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    importMutation.mutate({ icalString: text });
  };

  const handleExport = async () => {
    try {
      const result = await queryClient.fetchQuery(
        trpc.calendar.exportIcal.queryOptions({})
      );

      const blob = new Blob([result.icalString], {
        type: "text/calendar;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "family-hub-calendar.ics";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      toast.success(t("exportSuccess"));
    } catch {
      toast.error(t("importError"));
    }
  };

  return (
    <>
      <div className="flex gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setImportOpen(true)}
        >
          <Upload className="mr-1.5 h-4 w-4" />
          <span className="hidden sm:inline">{t("import")}</span>
        </Button>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="mr-1.5 h-4 w-4" />
          <span className="hidden sm:inline">{t("export")}</span>
        </Button>
      </div>

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("importTitle")}</DialogTitle>
            <DialogDescription>{t("importDescription")}</DialogDescription>
          </DialogHeader>
          <div
            className="flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 transition-colors hover:border-primary"
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload className="mb-3 h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">{t("selectFile")}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {t("dragOrClick")}
            </p>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".ics,.ical"
            className="hidden"
            onChange={handleFileChange}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

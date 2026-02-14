"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { StickyNote } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTRPC } from "@/lib/trpc/client";
import Link from "next/link";

export function PinnedNotesWidget() {
  const t = useTranslations("dashboard");
  const trpc = useTRPC();

  const { data: notes, isLoading } = useQuery(
    trpc.notes.list.queryOptions({ pinnedOnly: true })
  );

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{t("pinnedNotes")}</CardTitle>
        <StickyNote className="h-4 w-4 text-yellow-500" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : !notes?.length ? (
          <p className="text-sm text-muted-foreground">{t("noNotes")}</p>
        ) : (
          <div className="space-y-2">
            {notes.slice(0, 4).map((note) => (
              <div key={note.id} className="flex items-center gap-2 text-sm">
                {note.color && (
                  <span
                    className="h-2 w-2 rounded-full shrink-0"
                    style={{ backgroundColor: note.color }}
                  />
                )}
                <span className="truncate">{note.title}</span>
              </div>
            ))}
            {notes.length > 4 && (
              <Link href="/notes" className="block text-xs text-muted-foreground hover:underline">
                {t("viewAll")} ({notes.length})
              </Link>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

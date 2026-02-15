"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Dashboard Error Boundary]", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <AlertTriangle className="h-10 w-10 text-destructive" />
      <div className="space-y-1">
        <h2 className="text-lg font-semibold">Etwas ist schiefgelaufen</h2>
        <p className="text-sm text-muted-foreground max-w-md">
          Die Seite konnte nicht geladen werden. Das kann nach einem Update oder
          bei Verbindungsproblemen passieren.
        </p>
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={reset}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Nochmal versuchen
        </Button>
        <Button
          variant="default"
          onClick={() => window.location.reload()}
        >
          Seite neu laden
        </Button>
      </div>
    </div>
  );
}

"use client";

import { WifiOff, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 text-center">
      <WifiOff className="h-16 w-16 text-muted-foreground mb-6" />
      <h1 className="text-2xl font-bold mb-2">You&apos;re offline</h1>
      <p className="text-muted-foreground max-w-sm mb-6">
        It looks like you&apos;ve lost your internet connection. Family Hub needs
        a connection to load. Your data will sync automatically when you&apos;re
        back online.
      </p>
      <Button onClick={() => window.location.reload()} variant="outline">
        <RefreshCw className="mr-2 h-4 w-4" />
        Try again
      </Button>
    </div>
  );
}

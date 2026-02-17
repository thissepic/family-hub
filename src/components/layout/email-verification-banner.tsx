"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { Button } from "@/components/ui/button";
import { X, Mail, AlertCircle } from "lucide-react";

export function EmailVerificationBanner() {
  const t = useTranslations("emailVerification");
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const [dismissed, setDismissed] = useState(false);
  const [resent, setResent] = useState(false);

  const statusQuery = useQuery(trpc.account.getTwoFactorStatus.queryOptions());

  const resendMutation = useMutation(
    trpc.account.resendVerification.mutationOptions({
      onSuccess: () => {
        setResent(true);
        setTimeout(() => setResent(false), 5000);
      },
    })
  );

  // Don't show if dismissed, loading, error, or already verified
  if (dismissed || !statusQuery.data || statusQuery.data.emailVerified) {
    return null;
  }

  return (
    <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-800 px-4 py-3">
      <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Mail className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <p className="text-sm text-amber-800 dark:text-amber-200 truncate">
            {resendMutation.isError ? t("bannerError") : t("bannerText")}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              resendMutation.reset();
              resendMutation.mutate();
            }}
            disabled={resendMutation.isPending || resent}
            className="text-xs"
          >
            {resent ? t("bannerResent") : t("bannerResend")}
          </Button>
          <button
            onClick={() => setDismissed(true)}
            className="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200 transition-colors"
            aria-label={t("bannerDismiss")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

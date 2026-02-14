"use client";

import { useTranslations } from "next-intl";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface DisconnectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accountLabel: string;
  onConfirm: () => void;
  isPending: boolean;
}

export function DisconnectDialog({
  open,
  onOpenChange,
  accountLabel,
  onConfirm,
  isPending,
}: DisconnectDialogProps) {
  const t = useTranslations("settings");

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("confirmDisconnect")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t("confirmDisconnectDescription", { account: accountLabel })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>
            {t("cancel")}
          </AlertDialogCancel>
          <AlertDialogAction onClick={onConfirm} disabled={isPending}>
            {isPending ? t("disconnecting") : t("disconnect")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

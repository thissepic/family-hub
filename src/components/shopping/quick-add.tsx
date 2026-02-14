"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface QuickAddProps {
  listId: string;
}

export function QuickAdd({ listId }: QuickAddProps) {
  const t = useTranslations("shopping");
  const trpc = useTRPC();
  const queryClient = useQueryClient();

  const [name, setName] = useState("");

  const addMutation = useMutation(
    trpc.shopping.addItem.mutationOptions({
      onSuccess: () => {
        toast.success(t("itemAdded"));
        queryClient.invalidateQueries({ queryKey: [["shopping"]] });
        setName("");
      },
    })
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;

    addMutation.mutate({
      listId,
      name: trimmed,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-2">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        placeholder={t("addItemPlaceholder")}
        className="flex-1"
        autoComplete="off"
        disabled={addMutation.isPending}
      />
      <Button
        type="submit"
        size="icon"
        disabled={!name.trim() || addMutation.isPending}
      >
        <Plus className="h-4 w-4" />
      </Button>
    </form>
  );
}

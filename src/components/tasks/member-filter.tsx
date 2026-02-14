"use client";

import { useTranslations } from "next-intl";
import { useQuery } from "@tanstack/react-query";
import { useTRPC } from "@/lib/trpc/client";
import { cn } from "@/lib/utils";

interface MemberFilterProps {
  selectedMemberIds: string[];
  onChange: (memberIds: string[]) => void;
}

export function MemberFilter({ selectedMemberIds, onChange }: MemberFilterProps) {
  const t = useTranslations("tasks");
  const trpc = useTRPC();

  const { data: members } = useQuery(trpc.members.list.queryOptions());

  if (!members?.length) return null;

  const allSelected = selectedMemberIds.length === 0;

  const toggleMember = (memberId: string) => {
    if (selectedMemberIds.includes(memberId)) {
      onChange(selectedMemberIds.filter((id) => id !== memberId));
    } else {
      onChange([...selectedMemberIds, memberId]);
    }
  };

  const selectAll = () => {
    onChange([]);
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <button
        type="button"
        onClick={selectAll}
        className={cn(
          "inline-flex items-center rounded-full px-3 py-1 text-xs font-medium transition-colors",
          allSelected
            ? "bg-primary text-primary-foreground"
            : "bg-muted text-muted-foreground hover:bg-muted/80"
        )}
      >
        {t("allMembers")}
      </button>
      {members.map((member) => {
        const isSelected =
          allSelected || selectedMemberIds.includes(member.id);
        return (
          <button
            key={member.id}
            type="button"
            onClick={() => toggleMember(member.id)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition-colors",
              isSelected
                ? "text-white"
                : "bg-muted text-muted-foreground hover:bg-muted/80"
            )}
            style={
              isSelected
                ? { backgroundColor: member.color }
                : undefined
            }
          >
            <span
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: isSelected ? "white" : member.color }}
            />
            {member.name}
          </button>
        );
      })}
    </div>
  );
}

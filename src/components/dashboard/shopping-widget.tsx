"use client";

import { useQuery } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { ShoppingCart } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useTRPC } from "@/lib/trpc/client";
import Link from "next/link";

export function ShoppingWidget() {
  const t = useTranslations("dashboard");
  const trpc = useTRPC();

  const { data: lists, isLoading } = useQuery(
    trpc.shopping.lists.queryOptions({})
  );

  const totalItems = lists?.reduce((sum, l) => sum + (l._count?.items ?? 0), 0) ?? 0;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{t("shoppingList")}</CardTitle>
        <ShoppingCart className="h-4 w-4 text-purple-500" />
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        ) : !lists?.length ? (
          <p className="text-sm text-muted-foreground">{t("noLists")}</p>
        ) : (
          <div className="space-y-2">
            <p className="text-2xl font-bold">{totalItems}</p>
            <p className="text-xs text-muted-foreground">{t("itemsAcrossLists", { count: lists.length })}</p>
            {lists.slice(0, 3).map((list) => (
              <div key={list.id} className="flex items-center justify-between text-sm">
                <span className="truncate">{list.name}</span>
                <span className="text-muted-foreground">{list._count?.items ?? 0}</span>
              </div>
            ))}
            <Link href="/shopping" className="block text-xs text-muted-foreground hover:underline">
              {t("viewAll")}
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

import { z } from "zod/v4";

export const globalSearchInput = z.object({
  query: z.string().min(2).max(100),
  limit: z.number().int().min(1).max(10).default(5),
});

export type SearchResultItem = {
  id: string;
  module: string;
  title: string;
  snippet: string;
  url: string;
  createdAt: Date;
  score: number;
};

export type SearchModuleGroup = {
  module: string;
  labelKey: string;
  results: SearchResultItem[];
};

export type GlobalSearchOutput = {
  modules: SearchModuleGroup[];
  totalCount: number;
};

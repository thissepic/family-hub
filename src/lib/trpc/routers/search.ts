import { router, protectedProcedure } from "../init";
import { db } from "@/lib/db";
import { Prisma } from "@prisma/client";
import { globalSearchInput } from "./search.schemas";
import type {
  SearchModuleGroup,
  GlobalSearchOutput,
} from "./search.schemas";
import {
  sanitizeSearchQuery,
  MODULE_CONFIGS,
  buildTsvectorExpr,
  buildHeadlineExpr,
  buildScoreExpr,
} from "@/lib/search/utils";

interface RawSearchRow {
  id: string;
  title: string;
  snippet: string;
  score: number;
  createdAt: Date;
}

export const searchRouter = router({
  global: protectedProcedure
    .input(globalSearchInput)
    .query(async ({ ctx, input }) => {
      const { familyId } = ctx.session;
      const sanitized = sanitizeSearchQuery(input.query);

      if (!sanitized) {
        return { modules: [], totalCount: 0 } satisfies GlobalSearchOutput;
      }

      const limit = input.limit;

      // Standard modules: calendar, tasks, chores, members (direct familyId, simple fields)
      const standardQueries = MODULE_CONFIGS.map(async (config) => {
        const tsvector = buildTsvectorExpr(config.fields);
        const headline = buildHeadlineExpr(config.fields);
        const score = buildScoreExpr(config.fields, config.dateField);
        const titleSelect =
          config.titleField === "title"
            ? `"title"`
            : `"${config.titleField}" AS "title"`;

        const rows = await db.$queryRaw<RawSearchRow[]>(
          Prisma.sql`
            SELECT
              "id",
              ${Prisma.raw(titleSelect)},
              ${Prisma.raw(headline)} AS "snippet",
              ${Prisma.raw(score)} AS "score",
              ${Prisma.raw(config.dateField)} AS "createdAt"
            FROM ${Prisma.raw(config.table)}
            WHERE ${Prisma.raw(config.familyWhere)} = ${familyId}
              AND ${Prisma.raw(tsvector)} @@ plainto_tsquery('simple', ${sanitized})
            ORDER BY "score" DESC
            LIMIT ${limit}
          `
        );

        return {
          module: config.module,
          labelKey: config.labelKey,
          results: rows.map((row) => ({
            id: row.id,
            module: config.module,
            title: row.title,
            snippet: row.snippet,
            url: `${config.urlPrefix}${row.id}`,
            createdAt: row.createdAt,
            score: Number(row.score),
          })),
        } satisfies SearchModuleGroup;
      });

      // Recipe — special handling for tags (String[] array)
      const recipeQuery = async (): Promise<SearchModuleGroup> => {
        const rows = await db.$queryRaw<RawSearchRow[]>(
          Prisma.sql`
            SELECT
              "id",
              "title",
              ts_headline(
                'simple',
                COALESCE("title", '') || ' ' || COALESCE("instructions", '') || ' ' || array_to_string("tags", ' '),
                plainto_tsquery('simple', ${sanitized}),
                'StartSel=<mark>, StopSel=</mark>, MaxWords=25, MinWords=10'
              ) AS "snippet",
              ts_rank(
                to_tsvector('simple', COALESCE("title", '') || ' ' || COALESCE("instructions", '') || ' ' || array_to_string("tags", ' ')),
                plainto_tsquery('simple', ${sanitized})
              ) * (1.0 / (1.0 + EXTRACT(EPOCH FROM NOW() - "createdAt") / 2592000.0)) AS "score",
              "createdAt"
            FROM "Recipe"
            WHERE "familyId" = ${familyId}
              AND to_tsvector('simple', COALESCE("title", '') || ' ' || COALESCE("instructions", '') || ' ' || array_to_string("tags", ' '))
                  @@ plainto_tsquery('simple', ${sanitized})
            ORDER BY "score" DESC
            LIMIT ${limit}
          `
        );

        return {
          module: "recipes",
          labelKey: "moduleRecipes",
          results: rows.map((row) => ({
            id: row.id,
            module: "recipes",
            title: row.title,
            snippet: row.snippet,
            url: `/meals?recipeId=${row.id}`,
            createdAt: row.createdAt,
            score: Number(row.score),
          })),
        };
      };

      // Note — special handling for body (Json field) and category
      const noteQuery = async (): Promise<SearchModuleGroup> => {
        const rows = await db.$queryRaw<RawSearchRow[]>(
          Prisma.sql`
            SELECT
              "id",
              "title",
              ts_headline(
                'simple',
                COALESCE("title", '') || ' ' || COALESCE("body"::text, '') || ' ' || COALESCE("category", ''),
                plainto_tsquery('simple', ${sanitized}),
                'StartSel=<mark>, StopSel=</mark>, MaxWords=25, MinWords=10'
              ) AS "snippet",
              ts_rank(
                to_tsvector('simple', COALESCE("title", '') || ' ' || COALESCE("body"::text, '') || ' ' || COALESCE("category", '')),
                plainto_tsquery('simple', ${sanitized})
              ) * (1.0 / (1.0 + EXTRACT(EPOCH FROM NOW() - "createdAt") / 2592000.0)) AS "score",
              "createdAt"
            FROM "Note"
            WHERE "familyId" = ${familyId}
              AND to_tsvector('simple', COALESCE("title", '') || ' ' || COALESCE("body"::text, '') || ' ' || COALESCE("category", ''))
                  @@ plainto_tsquery('simple', ${sanitized})
            ORDER BY "score" DESC
            LIMIT ${limit}
          `
        );

        return {
          module: "notes",
          labelKey: "moduleNotes",
          results: rows.map((row) => ({
            id: row.id,
            module: "notes",
            title: row.title,
            snippet: row.snippet,
            url: `/notes?noteId=${row.id}`,
            createdAt: row.createdAt,
            score: Number(row.score),
          })),
        };
      };

      // Shopping items — join through ShoppingList for familyId
      const shoppingQuery = async (): Promise<SearchModuleGroup> => {
        const rows = await db.$queryRaw<RawSearchRow[]>(
          Prisma.sql`
            SELECT
              si."id",
              si."name" AS "title",
              ts_headline(
                'simple',
                COALESCE(si."name", '') || ' ' || COALESCE(si."category", ''),
                plainto_tsquery('simple', ${sanitized}),
                'StartSel=<mark>, StopSel=</mark>, MaxWords=25, MinWords=10'
              ) AS "snippet",
              ts_rank(
                to_tsvector('simple', COALESCE(si."name", '') || ' ' || COALESCE(si."category", '')),
                plainto_tsquery('simple', ${sanitized})
              ) * (1.0 / (1.0 + EXTRACT(EPOCH FROM NOW() - si."createdAt") / 2592000.0)) AS "score",
              si."createdAt"
            FROM "ShoppingItem" si
            JOIN "ShoppingList" sl ON sl."id" = si."listId"
            WHERE sl."familyId" = ${familyId}
              AND to_tsvector('simple', COALESCE(si."name", '') || ' ' || COALESCE(si."category", ''))
                  @@ plainto_tsquery('simple', ${sanitized})
            ORDER BY "score" DESC
            LIMIT ${limit}
          `
        );

        return {
          module: "shopping",
          labelKey: "moduleShopping",
          results: rows.map((row) => ({
            id: row.id,
            module: "shopping",
            title: row.title,
            snippet: row.snippet,
            url: "/shopping",
            createdAt: row.createdAt,
            score: Number(row.score),
          })),
        };
      };

      // Run all queries in parallel
      const allGroups = await Promise.all([
        ...standardQueries,
        recipeQuery(),
        noteQuery(),
        shoppingQuery(),
      ]);

      // Filter out empty groups and calculate total
      const nonEmptyGroups = allGroups.filter((g) => g.results.length > 0);
      const totalCount = nonEmptyGroups.reduce(
        (sum, g) => sum + g.results.length,
        0
      );

      return {
        modules: nonEmptyGroups,
        totalCount,
      } satisfies GlobalSearchOutput;
    }),
});

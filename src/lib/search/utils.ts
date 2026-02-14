/**
 * Sanitize a search query to prevent tsquery parse errors.
 * Strips characters that are special in PostgreSQL tsquery syntax.
 */
export function sanitizeSearchQuery(query: string): string {
  return query
    .replace(/[&|!<>():*\\'"]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Module search configuration.
 * Each entry defines which table/fields to search and how to build result URLs.
 */
export interface ModuleSearchConfig {
  module: string;
  labelKey: string;
  table: string;
  /** Text fields to concatenate into the tsvector */
  fields: string[];
  /** Column to use as the display title (defaults to "title") */
  titleField: string;
  /** SQL expression for the family scope WHERE clause */
  familyWhere: string;
  /** Timestamp field for recency bias */
  dateField: string;
  /** Function to build the result URL from an id */
  urlPrefix: string;
}

export const MODULE_CONFIGS: ModuleSearchConfig[] = [
  {
    module: "calendar",
    labelKey: "moduleCalendar",
    table: '"CalendarEvent"',
    fields: ["title", "description", "location"],
    titleField: "title",
    familyWhere: '"familyId"',
    dateField: '"createdAt"',
    urlPrefix: "/calendar?eventId=",
  },
  {
    module: "tasks",
    labelKey: "moduleTasks",
    table: '"Task"',
    fields: ["title", "description"],
    titleField: "title",
    familyWhere: '"familyId"',
    dateField: '"createdAt"',
    urlPrefix: "/tasks?taskId=",
  },
  {
    module: "chores",
    labelKey: "moduleChores",
    table: '"Chore"',
    fields: ["title", "description"],
    titleField: "title",
    familyWhere: '"familyId"',
    dateField: '"createdAt"',
    urlPrefix: "/chores?choreId=",
  },
  {
    module: "members",
    labelKey: "moduleMembers",
    table: '"FamilyMember"',
    fields: ["name"],
    titleField: "name",
    familyWhere: '"familyId"',
    dateField: '"createdAt"',
    urlPrefix: "/settings?memberId=",
  },
];

/**
 * ShoppingItem is special — it joins through ShoppingList for familyId.
 * Handled separately in the search router.
 */
export const SHOPPING_CONFIG = {
  module: "shopping",
  labelKey: "moduleShopping",
  urlPrefix: "/shopping",
} as const;

/**
 * Build the tsvector SQL expression from a list of fields.
 * Uses 'simple' configuration for language-agnostic matching (works with EN+DE).
 */
export function buildTsvectorExpr(fields: string[]): string {
  const parts = fields.map((f) => `COALESCE("${f}"::text, '')`);
  return `to_tsvector('simple', ${parts.join(" || ' ' || ")})`;
}

/**
 * Build the headline (snippet) SQL expression.
 */
export function buildHeadlineExpr(fields: string[]): string {
  const parts = fields.map((f) => `COALESCE("${f}"::text, '')`);
  const concat = parts.join(" || ' ' || ");
  return `ts_headline('simple', ${concat}, plainto_tsquery('simple', $1), 'StartSel=<mark>, StopSel=</mark>, MaxWords=25, MinWords=10')`;
}

/**
 * Build the recency-biased score expression.
 * Items from the last 30 days get a significant boost.
 */
export function buildScoreExpr(
  fields: string[],
  dateField: string
): string {
  const tsvector = buildTsvectorExpr(fields);
  return `ts_rank(${tsvector}, plainto_tsquery('simple', $1)) * (1.0 / (1.0 + EXTRACT(EPOCH FROM NOW() - ${dateField}) / 2592000.0))`;
}

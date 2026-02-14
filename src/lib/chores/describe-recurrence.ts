/**
 * Convert an RRULE string into a human-readable label.
 * Uses i18n translation function for known patterns, falls back to
 * the rrule library's toText() for complex/custom rules.
 */
export function describeRecurrence(
  rule: string,
  t: (key: string) => string,
): string {
  // Normalize: extract the RRULE body (strip prefix, DTSTART lines, etc.)
  const ruleStr =
    rule
      .split("\n")
      .find((l) => l.includes("FREQ="))
      ?.replace(/^RRULE:/, "") ?? rule.replace(/^RRULE:/, "");

  // Parse into key-value pairs
  const parts = Object.fromEntries(
    ruleStr.split(";").map((p) => {
      const [k, v] = p.split("=");
      return [k, v];
    }),
  );

  const freq = parts.FREQ;
  const interval = parts.INTERVAL ? parseInt(parts.INTERVAL) : 1;
  const byDay = parts.BYDAY;

  // Match known simple patterns to i18n keys
  if (freq === "DAILY" && interval === 1) {
    return t("frequencyDaily");
  }

  if (freq === "WEEKLY" && interval === 1) {
    // Simple weekly (with or without a single BYDAY)
    if (!byDay || /^[A-Z]{2}$/.test(byDay)) {
      return t("frequencyWeekly");
    }
    // Weekdays pattern
    if (byDay === "MO,TU,WE,TH,FR") {
      return t("frequencyWeekdays");
    }
  }

  if (freq === "WEEKLY" && interval === 2) {
    return t("frequencyBiweekly");
  }

  if (freq === "MONTHLY" && interval === 1) {
    return t("frequencyMonthly");
  }

  if (freq === "YEARLY" && interval === 1) {
    return t("frequencyYearly");
  }

  // For custom/complex rules, build a descriptive string
  // e.g. "Every 3 days", "Every 2 weeks on Mon, Wed, Fri"
  const DAY_NAMES: Record<string, string> = {
    MO: "Mon",
    TU: "Tue",
    WE: "Wed",
    TH: "Thu",
    FR: "Fri",
    SA: "Sat",
    SU: "Sun",
  };

  const freqLabels: Record<string, [string, string]> = {
    DAILY: ["day", "days"],
    WEEKLY: ["week", "weeks"],
    MONTHLY: ["month", "months"],
    YEARLY: ["year", "years"],
  };

  const [singular, plural] = freqLabels[freq] ?? ["period", "periods"];
  let label = interval === 1 ? `Every ${singular}` : `Every ${interval} ${plural}`;

  if (freq === "WEEKLY" && byDay) {
    const dayNames = byDay.split(",").map((d) => DAY_NAMES[d] ?? d);
    label += ` (${dayNames.join(", ")})`;
  }

  return label;
}

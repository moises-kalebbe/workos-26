import { useMemo } from "react";
import {
  buildFinanceiroSearchText,
  matchesFinanceiroFilter,
  sortFinanceiroEntries,
  summarizeFinanceiro,
} from "@/features/financeiro/utils";
import type { FinanceiroEntryWithProject, FinanceiroFilter } from "@/features/financeiro/types";

export function useFinanceiroFeature({
  entries,
  filter,
  search,
}: {
  entries: FinanceiroEntryWithProject[];
  filter: FinanceiroFilter;
  search: string;
}) {
  return useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    const filtered = entries.filter((entry) => {
      if (!matchesFinanceiroFilter(entry, filter)) return false;
      if (!normalizedSearch) return true;
      return buildFinanceiroSearchText(entry).includes(normalizedSearch);
    });

    return {
      filteredEntries: sortFinanceiroEntries(filtered),
      metrics: summarizeFinanceiro(entries),
    };
  }, [entries, filter, search]);
}

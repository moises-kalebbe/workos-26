import type {
  FinancialEntry,
  FinancialEntryRecurrence,
  FinancialEntryStatus,
  FinancialEntryType,
  Project,
} from "@/types";

export type FinanceiroEntry = FinancialEntry;
export type FinanceiroEntryType = FinancialEntryType;
export type FinanceiroEntryStatus = FinancialEntryStatus;
export type FinanceiroEntryRecurrence = FinancialEntryRecurrence;

export type FinanceiroEntryWithProject = FinanceiroEntry & {
  project?: Pick<Project, "id" | "name" | "client" | "color"> | null;
};

export type FinanceiroFilter =
  | "all"
  | "income"
  | "expense"
  | "upcoming"
  | "overdue"
  | "paid"
  | "platform";

export type FinanceiroVisualStatus = "overdue" | "upcoming" | "paid" | "pending";

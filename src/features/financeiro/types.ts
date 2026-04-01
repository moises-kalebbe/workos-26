import type {
  FinancialContract,
  FinancialContractStatus,
  FinancialEntry,
  FinancialEntryRecurrence,
  FinancialEntryStatus,
  FinancialEntryType,
  Project,
} from "@/types";

export type FinanceiroEntry = FinancialEntry;
export type FinanceiroContract = FinancialContract;
export type FinanceiroEntryType = FinancialEntryType;
export type FinanceiroEntryStatus = FinancialEntryStatus;
export type FinanceiroEntryRecurrence = FinancialEntryRecurrence;
export type FinanceiroContractStatus = FinancialContractStatus;

export type FinanceiroEntryWithProject = FinanceiroEntry & {
  project?: Pick<Project, "id" | "name" | "client" | "color"> | null;
  contract?: Pick<FinancialContract, "id" | "name" | "status" | "payment_url"> | null;
};

export type FinanceiroContractWithProject = FinanceiroContract & {
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
export type FinanceiroReportingBasis = "cash" | "competence";

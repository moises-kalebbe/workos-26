export const AVERAGE_WEEKS_PER_MONTH = 4.33;

export interface ProjectContractInput {
  monthlyAmount: number | null;
  monthlyHours: number | null;
  dailyHours: number | null;
  workdays: string[];
}

export interface ProjectContractResult {
  workdaysPerWeek: number;
  monthlyWorkdays: number | null;
  monthlyHoursResolved: number | null;
  hoursPerDay: number | null;
  hourlyRate: number | null;
  dailyRate: number | null;
}

export function calculateProjectContract(input: ProjectContractInput): ProjectContractResult {
  const workdaysPerWeek = input.workdays.length;
  const monthlyWorkdays = workdaysPerWeek > 0 ? workdaysPerWeek * AVERAGE_WEEKS_PER_MONTH : null;
  const hasMonthlyAmount = typeof input.monthlyAmount === "number" && input.monthlyAmount > 0;
  const hasMonthlyHours = typeof input.monthlyHours === "number" && input.monthlyHours > 0;
  const hasDailyHours = typeof input.dailyHours === "number" && input.dailyHours > 0;

  const monthlyHoursResolved = hasMonthlyHours
    ? input.monthlyHours!
    : hasDailyHours && monthlyWorkdays
      ? input.dailyHours! * monthlyWorkdays
      : null;

  const hoursPerDay = hasMonthlyHours && monthlyWorkdays
    ? input.monthlyHours! / monthlyWorkdays
    : hasDailyHours
      ? input.dailyHours!
      : null;

  const hourlyRate = hasMonthlyAmount && monthlyHoursResolved
    ? input.monthlyAmount! / monthlyHoursResolved
    : null;

  const dailyRate = hasMonthlyAmount && monthlyWorkdays
    ? input.monthlyAmount! / monthlyWorkdays
    : hourlyRate && hoursPerDay
      ? hourlyRate * hoursPerDay
      : null;

  return {
    workdaysPerWeek,
    monthlyWorkdays,
    monthlyHoursResolved,
    hoursPerDay,
    hourlyRate,
    dailyRate,
  };
}


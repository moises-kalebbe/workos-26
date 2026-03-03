import { describe, expect, it } from "vitest";
import { calculateProjectContract } from "@/lib/projectContract";

describe("calculateProjectContract", () => {
  it("calcula valor por hora e por dia com horas mensais", () => {
    const result = calculateProjectContract({
      monthlyAmount: 10000,
      monthlyHours: 160,
      dailyHours: null,
      workdays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
    });

    expect(result.hourlyRate).toBeCloseTo(62.5, 3);
    expect(result.dailyRate).toBeCloseTo(461.89, 2);
    expect(result.hoursPerDay).toBeCloseTo(7.39, 2);
  });

  it("usa horas por dia quando horas mensais nao forem informadas", () => {
    const result = calculateProjectContract({
      monthlyAmount: 8000,
      monthlyHours: null,
      dailyHours: 8,
      workdays: ["monday", "tuesday", "wednesday", "thursday", "friday"],
    });

    expect(result.monthlyHoursResolved).toBeCloseTo(173.2, 3);
    expect(result.hourlyRate).toBeCloseTo(46.19, 2);
    expect(result.dailyRate).toBeCloseTo(369.52, 2);
  });

  it("nao calcula valor diario sem dias de trabalho", () => {
    const result = calculateProjectContract({
      monthlyAmount: 5000,
      monthlyHours: 100,
      dailyHours: null,
      workdays: [],
    });

    expect(result.hourlyRate).toBeCloseTo(50, 2);
    expect(result.dailyRate).toBeNull();
    expect(result.hoursPerDay).toBeNull();
  });
});


export type ShiftTimeRange = {
  startTime: string;
  endTime: string;
};

export type WageRuleInput = {
  baseRate: number;
  nightRateEnabled: boolean;
  nightMultiplier?: number | null;
  nightStart?: string | null;
  nightEnd?: string | null;
  holidayRateEnabled: boolean;
  holidayPercent?: number | null;
};

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function overlapMinutes(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}

export function calculateShiftHours(shift: ShiftTimeRange): number {
  const start = toMinutes(shift.startTime);
  let end = toMinutes(shift.endTime);
  if (end <= start) end += 24 * 60;
  return (end - start) / 60;
}

export function calculateShiftWage(shift: ShiftTimeRange, rule: WageRuleInput, opts: { isHoliday?: boolean } = {}): number {
  const shiftStart = toMinutes(shift.startTime);
  let shiftEnd = toMinutes(shift.endTime);
  if (shiftEnd <= shiftStart) shiftEnd += 24 * 60;

  const totalMinutes = shiftEnd - shiftStart;

  let nightMinutes = 0;
  if (rule.nightRateEnabled && rule.nightStart && rule.nightEnd && rule.nightMultiplier) {
    const nightStart = toMinutes(rule.nightStart);
    let nightEnd = toMinutes(rule.nightEnd);
    if (nightEnd <= nightStart) nightEnd += 24 * 60;

    // 深夜時段跟班次都可能跨過午夜,把深夜時段在前一天/當天/後一天各算一次再加總重疊分鐘數,
    // 避免例如班次是 23:00–07:00、深夜時段是 22:00–06:00 這種橫跨兩天的情況漏算或算重複
    for (const offset of [-24 * 60, 0, 24 * 60]) {
      nightMinutes += overlapMinutes(shiftStart, shiftEnd, nightStart + offset, nightEnd + offset);
    }
  }

  const regularMinutes = totalMinutes - nightMinutes;
  let wage = (regularMinutes / 60) * rule.baseRate + (nightMinutes / 60) * rule.baseRate * (rule.nightMultiplier ?? 1);

  if (rule.holidayRateEnabled && opts.isHoliday && rule.holidayPercent) {
    wage *= 1 + rule.holidayPercent / 100;
  }

  return Math.round(wage);
}

export function calculateMonthlyWage(
  entries: Array<{ shift: ShiftTimeRange; rule: WageRuleInput; isHoliday?: boolean }>,
): number {
  return entries.reduce(
    (total, entry) => total + calculateShiftWage(entry.shift, entry.rule, { isHoliday: entry.isHoliday }),
    0,
  );
}

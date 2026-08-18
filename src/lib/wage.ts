export type ShiftTimeRange = {
  startTime: string;
  endTime: string;
};

export type WageRateInput = {
  baseRate: number;
  breakMinutes?: number | null;
  breakPaid?: boolean | null;
  nightRateEnabled: boolean;
  nightMultiplier?: number | null;
  nightStart?: string | null;
  nightEnd?: string | null;
  holidayRateEnabled: boolean;
  holidayPercent?: number | null;
};

export type HourlyWageInput = ShiftTimeRange &
  WageRateInput & {
    isFullDay?: false;
    isHoliday?: boolean;
    manualWageOverride?: number | null;
  };

/**
 * 全日班次:固定領 dailyAmount,不管實際工作多久,沒有起訖時間可算(例如日結工地師傅)。
 * 休息時間/深夜加給/假日加給在這種模式下都不適用。
 */
export type FullDayWageInput = {
  isFullDay: true;
  dailyAmount: number;
  manualWageOverride?: number | null;
};

export type WageCalcInput = HourlyWageInput | FullDayWageInput;

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
}

function overlapMinutes(aStart: number, aEnd: number, bStart: number, bEnd: number): number {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}

export function calculateShiftHours(
  shift: ShiftTimeRange,
  opts: { breakMinutes?: number | null; breakPaid?: boolean | null } = {},
): number {
  const start = toMinutes(shift.startTime);
  let end = toMinutes(shift.endTime);
  if (end <= start) end += 24 * 60;

  const unpaidBreakMinutes = !opts.breakPaid && opts.breakMinutes ? opts.breakMinutes : 0;
  return (end - start - unpaidBreakMinutes) / 60;
}

export function calculateShiftWage(input: WageCalcInput): number {
  if (input.manualWageOverride != null) return input.manualWageOverride;

  if (input.isFullDay) {
    return Math.round(input.dailyAmount);
  }

  const shiftStart = toMinutes(input.startTime);
  let shiftEnd = toMinutes(input.endTime);
  if (shiftEnd <= shiftStart) shiftEnd += 24 * 60;

  const grossMinutes = shiftEnd - shiftStart;
  const unpaidBreakMinutes = !input.breakPaid && input.breakMinutes ? input.breakMinutes : 0;

  let nightMinutes = 0;
  if (input.nightRateEnabled && input.nightStart && input.nightEnd && input.nightMultiplier) {
    const nightStart = toMinutes(input.nightStart);
    let nightEnd = toMinutes(input.nightEnd);
    if (nightEnd <= nightStart) nightEnd += 24 * 60;

    // 深夜時段跟班次都可能跨過午夜,把深夜時段在前一天/當天/後一天各算一次再加總重疊分鐘數,
    // 避免例如班次是 23:00–07:00、深夜時段是 22:00–06:00 這種橫跨兩天的情況漏算或算重複
    for (const offset of [-24 * 60, 0, 24 * 60]) {
      nightMinutes += overlapMinutes(shiftStart, shiftEnd, nightStart + offset, nightEnd + offset);
    }
  }

  const regularMinutesGross = grossMinutes - nightMinutes;
  // 沒有記錄休息時段的確切起訖,假設不計薪休息優先算在一般時段裡,
  // 超過一般時段長度的部分才反過來扣深夜時段
  const regularMinutes = Math.max(0, regularMinutesGross - unpaidBreakMinutes);
  const overflowIntoNight = Math.max(0, unpaidBreakMinutes - regularMinutesGross);
  const paidNightMinutes = Math.max(0, nightMinutes - overflowIntoNight);

  let wage =
    (regularMinutes / 60) * input.baseRate +
    (paidNightMinutes / 60) * input.baseRate * (input.nightMultiplier ?? 1);

  if (input.holidayRateEnabled && input.isHoliday && input.holidayPercent) {
    wage *= 1 + input.holidayPercent / 100;
  }

  return Math.round(wage);
}

export function calculateMonthlyWage(entries: WageCalcInput[]): number {
  return entries.reduce((total, entry) => total + calculateShiftWage(entry), 0);
}

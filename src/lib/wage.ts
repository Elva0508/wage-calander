import { differenceInCalendarDays, eachMonthOfInterval, endOfMonth, getDaysInMonth, startOfMonth } from 'date-fns';

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

export type WageBreakdown = {
  total: number;
  regularPay: number;
  nightPay: number;
};

/**
 * 給逐日明細「展開看拆解」用。全日班次/手動覆寫的情況沒有分項可拆,regularPay/nightPay 固定 0,
 * total 直接等於最終金額——不假裝拆解出不存在的分項。
 */
export function calculateShiftWageBreakdown(input: WageCalcInput): WageBreakdown {
  const total = calculateShiftWage(input);

  if (input.manualWageOverride != null || input.isFullDay) {
    return { total, regularPay: 0, nightPay: 0 };
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

    for (const offset of [-24 * 60, 0, 24 * 60]) {
      nightMinutes += overlapMinutes(shiftStart, shiftEnd, nightStart + offset, nightEnd + offset);
    }
  }

  const regularMinutesGross = grossMinutes - nightMinutes;
  const regularMinutes = Math.max(0, regularMinutesGross - unpaidBreakMinutes);
  const overflowIntoNight = Math.max(0, unpaidBreakMinutes - regularMinutesGross);
  const paidNightMinutes = Math.max(0, nightMinutes - overflowIntoNight);

  const holidayMultiplier =
    input.holidayRateEnabled && input.isHoliday && input.holidayPercent ? 1 + input.holidayPercent / 100 : 1;

  const regularPay = Math.round((regularMinutes / 60) * input.baseRate * holidayMultiplier);
  const nightPay = Math.round((paidNightMinutes / 60) * input.baseRate * (input.nightMultiplier ?? 1) * holidayMultiplier);

  return { total, regularPay, nightPay };
}

/** 單純比較日期字串,今日統計/發薪日曆的「已完成/預估」判斷共用同一個函式。 */
export function isShiftCompleted(dateStr: string, today: string): boolean {
  return dateStr <= today;
}

/** 跟 hours-report-view.tsx 的 parseISODateInput 用同一套時區安全慣例:用本地午夜組 Date */
function parseDateStrLocal(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00`);
}

/**
 * 月薪工作沒有「逐班計薪」概念,但工時統計/逐日明細仍需要在指定區間內攤出對應的月薪金額,
 * 不然月薪工作永遠顯示 $0 收入,沒有參考價值。做法:區間覆蓋到的每個日曆月,各自算
 * 「重疊天數 / 該月總天數 * 月薪」,加總後只在最後 round 一次(比照 calculateShiftWage
 * 只在最後捨入一次的慣例,避免多月加總分次捨入產生誤差)。
 * rangeStart/rangeEnd 皆為 'yyyy-MM-dd' 且為 inclusive 邊界。
 */
export function calculateProratedMonthlySalary(monthlySalary: number, rangeStart: string, rangeEnd: string): number {
  const start = parseDateStrLocal(rangeStart);
  const end = parseDateStrLocal(rangeEnd);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 0;

  let total = 0;
  for (const monthAnchor of eachMonthOfInterval({ start, end })) {
    const monthStart = startOfMonth(monthAnchor);
    const monthEnd = endOfMonth(monthAnchor);
    const overlapStart = monthStart > start ? monthStart : start;
    const overlapEnd = monthEnd < end ? monthEnd : end;
    const overlapDays = differenceInCalendarDays(overlapEnd, overlapStart) + 1;
    total += (overlapDays / getDaysInMonth(monthStart)) * monthlySalary;
  }
  return Math.round(total);
}

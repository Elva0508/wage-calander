import type { Shift, ShiftType, Workplace } from '@/db/schema';
import type { WageCalcInput } from './wage';

/**
 * 把一筆 Shift 解析成 lib/wage.ts 能吃的 canonical 計薪輸入。
 *
 * 規則優先順序:
 * 1. isRestDay → null(休息日純標記,沒有薪資可算)
 * 2. 有 shiftTypeId → 查對應 ShiftType + 它綁定的 Workplace,依 Workplace.wageType 三選一分流:
 *    - 'monthly' → null(月薪不計逐班金額,班別的起訖時間只用來算出勤工時)
 *    - 'daily' → 全日固定金額,ShiftType.dailyRate 有填就用,沒填 fallback 用
 *      Workplace.defaultDailyRate(同一份工作底下沒特別覆寫的班別都共用這份預設日薪)。
 *      起訖時間依然存在,只是不影響金額,純記錄用
 *    - 'hourly' → 走時薪公式,ShiftType.hourlyRate 有填就用,沒填 fallback 用 Workplace.defaultHourlyRate
 * 3. 沒有 shiftTypeId(手動輸入的臨時單次班次) → 一律走時薪公式,直接用 Shift 自己存的欄位,
 *    跟綁定的 Workplace.wageType 無關(手動輸入本來就是自成一套的逃生門)
 */
export function resolveShiftWageInput(
  shift: Shift,
  shiftTypesById: Map<number, ShiftType>,
  workplacesById: Map<number, Workplace>,
): WageCalcInput | null {
  if (shift.isRestDay) return null;

  if (shift.shiftTypeId != null) {
    const shiftType = shiftTypesById.get(shift.shiftTypeId);
    if (!shiftType) return null;

    const workplace = workplacesById.get(shiftType.workplaceId);
    if (!workplace || workplace.wageType === 'monthly') return null;

    if (workplace.wageType === 'daily') {
      return {
        isFullDay: true,
        dailyAmount: shiftType.dailyRate ?? workplace.defaultDailyRate ?? 0,
        manualWageOverride: shift.manualWageOverride,
      };
    }

    if (shift.startTime == null || shift.endTime == null) return null;
    return {
      startTime: shift.startTime,
      endTime: shift.endTime,
      isHoliday: shift.isHoliday,
      manualWageOverride: shift.manualWageOverride,
      baseRate: shiftType.hourlyRate ?? workplace.defaultHourlyRate ?? 0,
      breakMinutes: shiftType.breakMinutes,
      breakPaid: shiftType.breakPaid,
      nightRateEnabled: shiftType.nightRateEnabled,
      nightMultiplier: shiftType.nightMultiplier,
      nightStart: shiftType.nightStart,
      nightEnd: shiftType.nightEnd,
      holidayRateEnabled: shiftType.holidayRateEnabled,
      holidayPercent: shiftType.holidayPercent,
    };
  }

  if (shift.startTime == null || shift.endTime == null) return null;
  return {
    startTime: shift.startTime,
    endTime: shift.endTime,
    isHoliday: shift.isHoliday,
    manualWageOverride: shift.manualWageOverride,
    baseRate: shift.baseRate ?? 0,
    breakMinutes: shift.breakMinutes,
    breakPaid: shift.breakPaid,
    nightRateEnabled: shift.nightRateEnabled ?? false,
    nightMultiplier: shift.nightMultiplier,
    nightStart: shift.nightStart,
    nightEnd: shift.nightEnd,
    holidayRateEnabled: shift.holidayRateEnabled ?? false,
    holidayPercent: shift.holidayPercent,
  };
}

/** 找出某天所屬的工作地點 id(依 shiftTypeId 或手動輸入的 workplaceId),沒有則回傳 null。 */
export function resolveShiftWorkplaceId(shift: Shift, shiftTypesById: Map<number, ShiftType>): number | null {
  if (shift.shiftTypeId != null) {
    return shiftTypesById.get(shift.shiftTypeId)?.workplaceId ?? null;
  }
  return shift.workplaceId ?? null;
}

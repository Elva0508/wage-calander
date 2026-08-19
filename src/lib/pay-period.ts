import { addDays, addMonths, addWeeks, endOfMonth, format, getDaysInMonth, startOfISOWeek, startOfMonth } from 'date-fns';

export type PayCycle = 'monthly' | 'weekly' | 'daily';

export type PayPeriodConfig = {
  payCycle: PayCycle | null;
  paydayDayOfMonth?: number | null;
  paydayWeekday?: number | null;
  periodStartDayOfMonth?: number | null;
  periodStartWeekday?: number | null;
  periodEndDayOfMonth?: number | null;
  periodEndIsEndOfMonth?: boolean | null;
  periodEndWeekday?: number | null;
};

export type PayPeriodMonthRelation = {
  /** 計薪起始日是否落在「計薪結束日所在月份」的前一個月 */
  periodStartInPreviousMonth: boolean;
  /** 發薪日是否落在「計薪結束日所在月份」的下一個月 */
  paydayInNextMonth: boolean;
};

export type PayPeriodEntry = {
  paydayDate: string;
  periodStart: string;
  periodEnd: string;
};

// 比「31」再大一點,代表「月底」永遠是當月最晚的一天,不管實際月份天數多少
const END_OF_MONTH_SENTINEL = 99;

/**
 * 只用使用者填的原始數字(1-31)比大小,決定「計薪起始日/發薪日」相對「計薪結束日所在月份」的關係。
 * 這個關係一旦算出來就固定不變,不受 2 月只有 28 天之類的實際天數影響——套用到具體月份時才處理
 * 「填 31 號但當月沒有那天」的容錯(退到月底),詳見 resolvePayPeriodsInRange。
 */
export function resolvePayPeriodMonthRelation(
  config: Pick<PayPeriodConfig, 'periodStartDayOfMonth' | 'periodEndDayOfMonth' | 'periodEndIsEndOfMonth' | 'paydayDayOfMonth'>,
): PayPeriodMonthRelation {
  const periodEnd = config.periodEndIsEndOfMonth ? END_OF_MONTH_SENTINEL : config.periodEndDayOfMonth ?? END_OF_MONTH_SENTINEL;
  const periodStart = config.periodStartDayOfMonth ?? 1;
  const payday = config.paydayDayOfMonth ?? 1;

  return {
    periodStartInPreviousMonth: periodStart > periodEnd,
    paydayInNextMonth: payday < periodEnd,
  };
}

function clampDayOfMonth(year: number, monthIndex0: number, day: number): Date {
  const daysInMonth = getDaysInMonth(new Date(year, monthIndex0, 1));
  return new Date(year, monthIndex0, Math.min(day, daysInMonth));
}

function toDateString(date: Date): string {
  return format(date, 'yyyy-MM-dd');
}

function resolveMonthlyPeriods(config: PayPeriodConfig, rangeStart: Date, rangeEnd: Date): PayPeriodEntry[] {
  const relation = resolvePayPeriodMonthRelation(config);
  const payday = config.paydayDayOfMonth ?? 1;
  const periodStartDay = config.periodStartDayOfMonth ?? 1;
  const periodEndDay = config.periodEndDayOfMonth ?? 28;

  const entries: PayPeriodEntry[] = [];
  // 範圍前後各多掃一個月,避免月初/月末邊界的發薪日被漏掉
  let cursor = startOfMonth(addMonths(rangeStart, -1));
  const scanEnd = addMonths(rangeEnd, 1);

  while (cursor <= scanEnd) {
    const year = cursor.getFullYear();
    const monthIndex0 = cursor.getMonth();

    const paydayDate = clampDayOfMonth(year, monthIndex0, payday);

    const periodEndAnchor = addMonths(cursor, relation.paydayInNextMonth ? -1 : 0);
    const periodEndDate = config.periodEndIsEndOfMonth
      ? endOfMonth(periodEndAnchor)
      : clampDayOfMonth(periodEndAnchor.getFullYear(), periodEndAnchor.getMonth(), periodEndDay);

    const periodStartAnchor = addMonths(periodEndAnchor, relation.periodStartInPreviousMonth ? -1 : 0);
    const periodStartDate = clampDayOfMonth(periodStartAnchor.getFullYear(), periodStartAnchor.getMonth(), periodStartDay);

    if (paydayDate >= rangeStart && paydayDate <= rangeEnd) {
      entries.push({
        paydayDate: toDateString(paydayDate),
        periodStart: toDateString(periodStartDate),
        periodEnd: toDateString(periodEndDate),
      });
    }

    cursor = addMonths(cursor, 1);
  }

  return entries;
}

function resolveWeeklyPeriods(config: PayPeriodConfig, rangeStart: Date, rangeEnd: Date): PayPeriodEntry[] {
  const paydayWeekday = config.paydayWeekday ?? 1;
  const periodStartWeekday = config.periodStartWeekday ?? 1;
  const periodEndWeekday = config.periodEndWeekday ?? 7;

  // 週結沒有「這週有幾天」的天數落差問題(每週固定 7 天),所以不需要 clamp 容錯
  const periodStartInPreviousWeek = periodStartWeekday > periodEndWeekday;
  const paydayInNextWeek = paydayWeekday < periodEndWeekday;

  const entries: PayPeriodEntry[] = [];
  let cursor = startOfISOWeek(addWeeks(rangeStart, -1));
  const scanEnd = addWeeks(rangeEnd, 1);

  while (cursor <= scanEnd) {
    const paydayDate = addDays(cursor, paydayWeekday - 1);

    const periodEndWeekAnchor = addWeeks(cursor, paydayInNextWeek ? -1 : 0);
    const periodEndDate = addDays(periodEndWeekAnchor, periodEndWeekday - 1);

    const periodStartWeekAnchor = addWeeks(periodEndWeekAnchor, periodStartInPreviousWeek ? -1 : 0);
    const periodStartDate = addDays(periodStartWeekAnchor, periodStartWeekday - 1);

    if (paydayDate >= rangeStart && paydayDate <= rangeEnd) {
      entries.push({
        paydayDate: toDateString(paydayDate),
        periodStart: toDateString(periodStartDate),
        periodEnd: toDateString(periodEndDate),
      });
    }

    cursor = addWeeks(cursor, 1);
  }

  return entries;
}

/**
 * 算出某個工作在 [rangeStart, rangeEnd] 範圍內每一次的「發薪日 + 對應計薪區間」。
 * payCycle='daily' 的工作沒有固定發薪日概念(日結彙總由呼叫端另外處理),回傳空陣列。
 */
export function resolvePayPeriodsInRange(workplace: PayPeriodConfig, rangeStart: Date, rangeEnd: Date): PayPeriodEntry[] {
  if (workplace.payCycle === 'monthly') return resolveMonthlyPeriods(workplace, rangeStart, rangeEnd);
  if (workplace.payCycle === 'weekly') return resolveWeeklyPeriods(workplace, rangeStart, rangeEnd);
  return [];
}

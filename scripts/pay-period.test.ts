/**
 * src/lib/pay-period.ts 的手動測試案例。
 *   npx tsx scripts/pay-period.test.ts
 */
import assert from 'node:assert/strict';

import { resolvePayPeriodMonthRelation, resolvePayPeriodsInRange } from '../src/lib/pay-period';

let passed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed += 1;
    console.log(`PASS ${name}`);
  } catch (err) {
    console.error(`FAIL ${name}`);
    throw err;
  }
}

// ---- resolvePayPeriodMonthRelation:5 種月結組合 ----

test('月結案例 1:整月(1號~月底),25 號發薪 → 計薪起始同月、發薪算下個月', () => {
  const relation = resolvePayPeriodMonthRelation({
    periodStartDayOfMonth: 1,
    periodEndDayOfMonth: null,
    periodEndIsEndOfMonth: true,
    paydayDayOfMonth: 25,
  });
  assert.equal(relation.periodStartInPreviousMonth, false);
  assert.equal(relation.paydayInNextMonth, true);
});

test('月結案例 2:整月(1號~月底),10 號發薪 → 一樣算下個月(月底是最大值,發薪必屬下月)', () => {
  const relation = resolvePayPeriodMonthRelation({
    periodStartDayOfMonth: 1,
    periodEndDayOfMonth: null,
    periodEndIsEndOfMonth: true,
    paydayDayOfMonth: 10,
  });
  assert.equal(relation.periodStartInPreviousMonth, false);
  assert.equal(relation.paydayInNextMonth, true);
});

test('月結案例 3:月中到月中(16號~15號),20 號發薪 → 起始屬上月、發薪同月', () => {
  const relation = resolvePayPeriodMonthRelation({
    periodStartDayOfMonth: 16,
    periodEndDayOfMonth: 15,
    periodEndIsEndOfMonth: false,
    paydayDayOfMonth: 20,
  });
  assert.equal(relation.periodStartInPreviousMonth, true);
  assert.equal(relation.paydayInNextMonth, false);
});

test('月結案例 4:當月 1號~15號(起始結束同月),25 號發薪 → 起始同月、發薪同月', () => {
  const relation = resolvePayPeriodMonthRelation({
    periodStartDayOfMonth: 1,
    periodEndDayOfMonth: 15,
    periodEndIsEndOfMonth: false,
    paydayDayOfMonth: 25,
  });
  assert.equal(relation.periodStartInPreviousMonth, false);
  assert.equal(relation.paydayInNextMonth, false);
});

test('月結案例 5:26號~25號(起始屬上月),29 號發薪 → 起始屬上月、發薪同月(29 >= 25)', () => {
  const relation = resolvePayPeriodMonthRelation({
    periodStartDayOfMonth: 26,
    periodEndDayOfMonth: 25,
    periodEndIsEndOfMonth: false,
    paydayDayOfMonth: 29,
  });
  assert.equal(relation.periodStartInPreviousMonth, true);
  assert.equal(relation.paydayInNextMonth, false);
});

// ---- 「31 號問題」:填 29/31 但 2 月沒有那天,要退到月底,月份關係本身不能因此改變 ----

test('31 號問題:整月(1號~月底),29 號發薪,2 月退到 28 號,月份關係(下個月)不受影響', () => {
  const config = {
    payCycle: 'monthly' as const,
    periodStartDayOfMonth: 1,
    periodEndDayOfMonth: null,
    periodEndIsEndOfMonth: true,
    paydayDayOfMonth: 29,
  };

  const relation = resolvePayPeriodMonthRelation(config);
  assert.equal(relation.paydayInNextMonth, true);

  // 2026 年不是閏年,2 月只有 28 天;範圍抓 2026-02-01 ~ 2026-02-28
  const entries = resolvePayPeriodsInRange(config, new Date(2026, 1, 1), new Date(2026, 1, 28));
  assert.equal(entries.length, 1);
  assert.equal(entries[0].paydayDate, '2026-02-28');
  // 發薪算下個月 → 對應計薪結束是 1 月月底,起始是 1 月 1 號
  assert.equal(entries[0].periodEnd, '2026-01-31');
  assert.equal(entries[0].periodStart, '2026-01-01');
});

test('31 號問題:同一份設定在有 29 天的月份(閏年 2 月)不需要退位,照實際數字算', () => {
  const config = {
    payCycle: 'monthly' as const,
    periodStartDayOfMonth: 1,
    periodEndDayOfMonth: null,
    periodEndIsEndOfMonth: true,
    paydayDayOfMonth: 29,
  };

  // 2028 是閏年,2 月有 29 天
  const entries = resolvePayPeriodsInRange(config, new Date(2028, 1, 1), new Date(2028, 1, 29));
  assert.equal(entries.length, 1);
  assert.equal(entries[0].paydayDate, '2028-02-29');
});

// ---- 週結案例 ----

test('週結案例:週一(1)~週五(5)為計薪區間,隔週週一(次週)發薪', () => {
  const config = {
    payCycle: 'weekly' as const,
    periodStartWeekday: 1,
    periodEndWeekday: 5,
    paydayWeekday: 1,
  };

  // 找一段確定包含週一的範圍:2026-08-17 是週一
  const entries = resolvePayPeriodsInRange(config, new Date(2026, 7, 17), new Date(2026, 7, 17));
  assert.equal(entries.length, 1);
  assert.equal(entries[0].paydayDate, '2026-08-17');
  // 發薪日(週一)的原始數字 1 < 結束日 5 → 算下週,所以計薪區間往前推一週
  assert.equal(entries[0].periodStart, '2026-08-10');
  assert.equal(entries[0].periodEnd, '2026-08-14');
});

test('週結案例:發薪日與結束日同一天(週五發薪、週五結束),同週', () => {
  const config = {
    payCycle: 'weekly' as const,
    periodStartWeekday: 1,
    periodEndWeekday: 5,
    paydayWeekday: 5,
  };

  // 2026-08-21 是週五
  const entries = resolvePayPeriodsInRange(config, new Date(2026, 7, 21), new Date(2026, 7, 21));
  assert.equal(entries.length, 1);
  assert.equal(entries[0].paydayDate, '2026-08-21');
  assert.equal(entries[0].periodStart, '2026-08-17');
  assert.equal(entries[0].periodEnd, '2026-08-21');
});

test('payCycle 為 daily 時回傳空陣列(日結不走這套)', () => {
  const entries = resolvePayPeriodsInRange(
    { payCycle: 'daily' },
    new Date(2026, 0, 1),
    new Date(2026, 11, 31),
  );
  assert.equal(entries.length, 0);
});

console.log(`\n${passed} 個測試全部通過`);

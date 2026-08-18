/**
 * src/lib/wage.ts 的手動測試案例。
 * 專案目前沒有裝 jest/vitest,先用最輕量的方式驗證邊界案例:
 *   npx tsx scripts/wage.test.ts
 */
import assert from 'node:assert/strict';

import { calculateMonthlyWage, calculateShiftHours, calculateShiftWage, WageCalcInput } from '../src/lib/wage';

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

const noExtraRate = {
  baseRate: 180,
  nightRateEnabled: false,
  holidayRateEnabled: false,
};

test('一般日班(09:00-17:00),無加給', () => {
  const shift = { startTime: '09:00', endTime: '17:00' };
  assert.equal(calculateShiftHours(shift), 8);
  assert.equal(calculateShiftWage({ ...shift, ...noExtraRate }), 8 * 180);
});

test('跨夜班(22:00-06:00)不開深夜加給,視為 8 小時', () => {
  const shift = { startTime: '22:00', endTime: '06:00' };
  assert.equal(calculateShiftHours(shift), 8);
  assert.equal(calculateShiftWage({ ...shift, ...noExtraRate }), 8 * 180);
});

test('跨夜班整段落在深夜時段,全時段套用深夜倍率', () => {
  const input: WageCalcInput = {
    startTime: '22:00',
    endTime: '06:00',
    baseRate: 150,
    nightRateEnabled: true,
    nightMultiplier: 1.34,
    nightStart: '22:00',
    nightEnd: '06:00',
    holidayRateEnabled: false,
  };
  assert.equal(calculateShiftWage(input), Math.round(8 * 150 * 1.34));
});

test('部分深夜(18:00-23:00),深夜時段 22:00-06:00,只有重疊的 1 小時套用倍率', () => {
  const input: WageCalcInput = {
    startTime: '18:00',
    endTime: '23:00',
    baseRate: 200,
    nightRateEnabled: true,
    nightMultiplier: 1.34,
    nightStart: '22:00',
    nightEnd: '06:00',
    holidayRateEnabled: false,
  };
  const expected = Math.round(4 * 200 + 1 * 200 * 1.34);
  assert.equal(calculateShiftWage(input), expected);
});

test('班次跨夜且深夜時段也跨夜,重疊要正確橫跨兩天計算(23:00-07:00,深夜 22:00-06:00)', () => {
  const input: WageCalcInput = {
    startTime: '23:00',
    endTime: '07:00',
    baseRate: 160,
    nightRateEnabled: true,
    nightMultiplier: 1.34,
    nightStart: '22:00',
    nightEnd: '06:00',
    holidayRateEnabled: false,
  };
  // 深夜重疊:23:00-06:00 = 7 小時;一般:06:00-07:00 = 1 小時
  const expected = Math.round(1 * 160 + 7 * 160 * 1.34);
  assert.equal(calculateShiftWage(input), expected);
});

test('假日加給開啟且該班為假日班,整段加成', () => {
  const input: WageCalcInput = {
    startTime: '09:00',
    endTime: '17:00',
    baseRate: 180,
    nightRateEnabled: false,
    holidayRateEnabled: true,
    holidayPercent: 33,
    isHoliday: true,
  };
  assert.equal(calculateShiftWage(input), Math.round(8 * 180 * 1.33));
});

test('假日加給開啟但該班未標記假日,不加成', () => {
  const input: WageCalcInput = {
    startTime: '09:00',
    endTime: '17:00',
    baseRate: 180,
    nightRateEnabled: false,
    holidayRateEnabled: true,
    holidayPercent: 33,
  };
  assert.equal(calculateShiftWage(input), 8 * 180);
});

test('該班標記假日但規則沒開假日加給開關,不加成', () => {
  const input: WageCalcInput = {
    startTime: '09:00',
    endTime: '17:00',
    ...noExtraRate,
    isHoliday: true,
  };
  assert.equal(calculateShiftWage(input), 8 * 180);
});

test('不計薪休息時間會從工時扣除', () => {
  const shift = { startTime: '09:00', endTime: '18:00' };
  assert.equal(calculateShiftHours(shift, { breakMinutes: 60, breakPaid: false }), 8);
  assert.equal(
    calculateShiftWage({ ...shift, ...noExtraRate, breakMinutes: 60, breakPaid: false }),
    8 * 180,
  );
});

test('計薪休息時間不影響工時', () => {
  const shift = { startTime: '09:00', endTime: '18:00' };
  assert.equal(calculateShiftHours(shift, { breakMinutes: 60, breakPaid: true }), 9);
  assert.equal(
    calculateShiftWage({ ...shift, ...noExtraRate, breakMinutes: 60, breakPaid: true }),
    9 * 180,
  );
});

test('不計薪休息落在深夜時段時,優先從一般時段扣,一般時段不夠才反過來扣深夜時段', () => {
  // 18:00-23:00,深夜 22:00-06:00 → 一般 4 小時(240 分)、深夜 1 小時(60 分)。
  // 休息 270 分不計薪,先扣掉一般時段的 240 分,剩下 30 分才從深夜時段扣。
  const input: WageCalcInput = {
    startTime: '18:00',
    endTime: '23:00',
    baseRate: 200,
    nightRateEnabled: true,
    nightMultiplier: 1.34,
    nightStart: '22:00',
    nightEnd: '06:00',
    holidayRateEnabled: false,
    breakMinutes: 270,
    breakPaid: false,
  };
  const expected = Math.round(0 * 200 + 0.5 * 200 * 1.34);
  assert.equal(calculateShiftWage(input), expected);
});

test('manualWageOverride 有值時直接短路,不跑計算公式', () => {
  const input: WageCalcInput = {
    startTime: '09:00',
    endTime: '17:00',
    ...noExtraRate,
    manualWageOverride: 999,
  };
  assert.equal(calculateShiftWage(input), 999);
});

test('全日班次:固定領 dailyAmount,不管時數', () => {
  const input: WageCalcInput = { isFullDay: true, dailyAmount: 1600 };
  assert.equal(calculateShiftWage(input), 1600);
});

test('全日班次:manualWageOverride 優先於 dailyAmount', () => {
  const input: WageCalcInput = { isFullDay: true, dailyAmount: 1600, manualWageOverride: 2000 };
  assert.equal(calculateShiftWage(input), 2000);
});

test('calculateMonthlyWage 加總多筆班次', () => {
  const total = calculateMonthlyWage([
    { startTime: '09:00', endTime: '17:00', ...noExtraRate },
    { startTime: '09:00', endTime: '13:00', ...noExtraRate },
  ]);
  assert.equal(total, 8 * 180 + 4 * 180);
});

console.log(`\n${passed} 個測試全部通過`);

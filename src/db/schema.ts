import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const workplaces = sqliteTable('workplaces', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),

  // 'monthly'(月薪)| 'daily'(日薪)| 'hourly'(時薪)
  // 新增時選定,建立後不可改——計薪鏈每次都用「現在」的設定回算「過去」的班次,換算法會讓歷史紀錄失真
  wageType: text('wage_type').notNull(),

  // 以下只有 wageType='monthly' 才有值
  monthlySalary: real('monthly_salary'),
  onboardDate: text('onboard_date'),
  isCurrentlyEmployed: integer('is_currently_employed', { mode: 'boolean' }),
  endDate: text('end_date'),

  // 以下分別只有 wageType='hourly'/'daily' 才有值——同一份工作底下不同班別預設都用這份薪水,
  // 班別自己也可以填 hourlyRate/dailyRate 覆蓋,覆蓋值優先,沒填才 fallback 到這裡
  defaultHourlyRate: real('default_hourly_rate'),
  defaultDailyRate: real('default_daily_rate'),
});

export const shiftTypes = sqliteTable('shift_types', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  workplaceId: integer('workplace_id')
    .notNull()
    .references(() => workplaces.id),
  name: text('name').notNull(),

  // 不管綁定的工作地點是月薪/日薪/時薪,起訖時間一律必填(月薪、日薪也要記出勤時間,
  // 日薪的時間只是記錄用不影響金額,金額固定領 dailyRate)
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),

  // 選填,只有這個班別的薪水跟工作地點的預設值不一樣時才填(覆蓋用),
  // 留空時計薪會 fallback 用 Workplace.defaultHourlyRate/defaultDailyRate
  hourlyRate: real('hourly_rate'),
  dailyRate: real('daily_rate'),

  // 以下只有 wageType='hourly' 才有意義(日薪固定金額不看休息/深夜重疊,月薪不計逐班金額)
  breakMinutes: integer('break_minutes'),
  breakPaid: integer('break_paid', { mode: 'boolean' }),

  nightRateEnabled: integer('night_rate_enabled', { mode: 'boolean' }).notNull().default(false),
  nightMultiplier: real('night_multiplier'),
  nightStart: text('night_start'),
  nightEnd: text('night_end'),

  holidayRateEnabled: integer('holiday_rate_enabled', { mode: 'boolean' }).notNull().default(false),
  holidayPercent: real('holiday_percent'),
});

export const shifts = sqliteTable('shifts', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  date: text('date').notNull(),
  // 休息日標記(isRestDay)沒有時間,所以起訖時間不能是 notNull
  startTime: text('start_time'),
  endTime: text('end_time'),
  note: text('note'),

  shiftTypeId: integer('shift_type_id').references(() => shiftTypes.id),
  isHoliday: integer('is_holiday', { mode: 'boolean' }).notNull().default(false),
  isRestDay: integer('is_rest_day', { mode: 'boolean' }).notNull().default(false),
  manualWageOverride: real('manual_wage_override'),

  // 以下欄位只在 shiftTypeId 為空(手動輸入的臨時單次班次)時才會有值
  workplaceId: integer('workplace_id').references(() => workplaces.id),
  baseRate: real('base_rate'),
  breakMinutes: integer('break_minutes'),
  breakPaid: integer('break_paid', { mode: 'boolean' }),
  nightRateEnabled: integer('night_rate_enabled', { mode: 'boolean' }),
  nightMultiplier: real('night_multiplier'),
  nightStart: text('night_start'),
  nightEnd: text('night_end'),
  holidayRateEnabled: integer('holiday_rate_enabled', { mode: 'boolean' }),
  holidayPercent: real('holiday_percent'),
});

export type Workplace = typeof workplaces.$inferSelect;
export type NewWorkplace = typeof workplaces.$inferInsert;
export type ShiftType = typeof shiftTypes.$inferSelect;
export type NewShiftType = typeof shiftTypes.$inferInsert;
export type Shift = typeof shifts.$inferSelect;
export type NewShift = typeof shifts.$inferInsert;

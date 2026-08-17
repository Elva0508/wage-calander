import { sqliteTable, text, integer, real } from 'drizzle-orm/sqlite-core';

export const wageRules = sqliteTable('wage_rules', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  jobName: text('job_name').notNull(),
  baseRate: real('base_rate').notNull(),

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
  startTime: text('start_time').notNull(),
  endTime: text('end_time').notNull(),
  wageRuleId: integer('wage_rule_id')
    .notNull()
    .references(() => wageRules.id),
  note: text('note'),
});

export type WageRule = typeof wageRules.$inferSelect;
export type NewWageRule = typeof wageRules.$inferInsert;
export type Shift = typeof shifts.$inferSelect;
export type NewShift = typeof shifts.$inferInsert;

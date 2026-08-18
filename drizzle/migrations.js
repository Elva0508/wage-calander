// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo
//
// 手動改過:原本 drizzle-kit 產生的版本是 `import m0000 from './0000_xxx.sql'`,
// 但這個專案目前用的 Metro/Expo 版本組合沒辦法正確把 .sql 檔案當純文字 import 進來
// (試過 sourceExts + 自訂 transformer、也試過 babel-plugin-inline-import,Metro 的 dependency
// graph 階段都還是會把 .sql 檔案送進 JS transform 而失敗)。改成直接把 SQL 內容用字串內嵌在這裡。
// ⚠️ 之後如果 schema 改變、重新跑 `npm run db:generate`,drizzle-kit 會把這個檔案蓋回原本會壞掉的
// import 版本,記得要重新套用這個修改(把新產生的 0000_xxx.sql 內容貼進 m0000 字串)。

import journal from './meta/_journal.json';

const m0000 = `CREATE TABLE \`shift_types\` (
	\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	\`workplace_id\` integer NOT NULL,
	\`name\` text NOT NULL,
	\`start_time\` text NOT NULL,
	\`end_time\` text NOT NULL,
	\`hourly_rate\` real,
	\`daily_rate\` real,
	\`break_minutes\` integer,
	\`break_paid\` integer,
	\`night_rate_enabled\` integer DEFAULT false NOT NULL,
	\`night_multiplier\` real,
	\`night_start\` text,
	\`night_end\` text,
	\`holiday_rate_enabled\` integer DEFAULT false NOT NULL,
	\`holiday_percent\` real,
	FOREIGN KEY (\`workplace_id\`) REFERENCES \`workplaces\`(\`id\`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE \`shifts\` (
	\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	\`date\` text NOT NULL,
	\`start_time\` text,
	\`end_time\` text,
	\`note\` text,
	\`shift_type_id\` integer,
	\`is_holiday\` integer DEFAULT false NOT NULL,
	\`is_rest_day\` integer DEFAULT false NOT NULL,
	\`manual_wage_override\` real,
	\`workplace_id\` integer,
	\`base_rate\` real,
	\`break_minutes\` integer,
	\`break_paid\` integer,
	\`night_rate_enabled\` integer,
	\`night_multiplier\` real,
	\`night_start\` text,
	\`night_end\` text,
	\`holiday_rate_enabled\` integer,
	\`holiday_percent\` real,
	FOREIGN KEY (\`shift_type_id\`) REFERENCES \`shift_types\`(\`id\`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (\`workplace_id\`) REFERENCES \`workplaces\`(\`id\`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE \`workplaces\` (
	\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	\`name\` text NOT NULL,
	\`wage_type\` text NOT NULL,
	\`monthly_salary\` real,
	\`onboard_date\` text,
	\`is_currently_employed\` integer,
	\`end_date\` text,
	\`default_hourly_rate\` real,
	\`default_daily_rate\` real
);
`;

export default {
  journal,
  migrations: {
    m0000,
  },
};

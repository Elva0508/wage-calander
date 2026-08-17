// This file is required for Expo/React Native SQLite migrations - https://orm.drizzle.team/quick-sqlite/expo
//
// 手動改過:原本 drizzle-kit 產生的版本是 `import m0000 from './0000_whole_punisher.sql'`,
// 但這個專案目前用的 Metro/Expo 版本組合沒辦法正確把 .sql 檔案當純文字 import 進來
// (試過 sourceExts + 自訂 transformer、也試過 babel-plugin-inline-import,Metro 的 dependency
// graph 階段都還是會把 .sql 檔案送進 JS transform 而失敗)。改成直接把 SQL 內容用字串內嵌在這裡。
// ⚠️ 之後如果 schema 改變、重新跑 `npm run db:generate`,drizzle-kit 會把這個檔案蓋回原本會壞掉的
// import 版本,記得要重新套用這個修改(把新產生的 0000_xxx.sql 內容貼進 m0000 字串)。

import journal from './meta/_journal.json';

const m0000 = `CREATE TABLE \`shifts\` (
	\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	\`date\` text NOT NULL,
	\`start_time\` text NOT NULL,
	\`end_time\` text NOT NULL,
	\`wage_rule_id\` integer NOT NULL,
	\`note\` text,
	FOREIGN KEY (\`wage_rule_id\`) REFERENCES \`wage_rules\`(\`id\`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE \`wage_rules\` (
	\`id\` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	\`job_name\` text NOT NULL,
	\`base_rate\` real NOT NULL,
	\`night_rate_enabled\` integer DEFAULT false NOT NULL,
	\`night_multiplier\` real,
	\`night_start\` text,
	\`night_end\` text,
	\`holiday_rate_enabled\` integer DEFAULT false NOT NULL,
	\`holiday_percent\` real
);
`;

export default {
  journal,
  migrations: {
    m0000,
  },
};

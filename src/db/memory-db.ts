import { getTableColumns } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/sqlite-proxy';

import * as schema from './schema';

/**
 * 只給「網頁預覽」用的簡化資料庫。expo-sqlite 在瀏覽器上的 WASM worker 不穩定(SharedArrayBuffer/
 * sync timeout),手機上的真正版本完全不受影響,仍然走 src/db/client.ts 裡的 expo-sqlite。
 *
 * 做法:攔截 drizzle 產生的 SQL 文字,對照本專案目前唯一會用到的四種查詢型態(單表 SELECT *、
 * INSERT、依 id UPDATE、依 id DELETE),資料存在記憶體陣列裡——不是通用 SQL 引擎,重新整理或重啟
 * 開發伺服器時資料會清空。
 */

type ColumnInfo = { jsName: string; sqlName: string; isBoolean: boolean };

const TABLES = {
  workplaces: schema.workplaces,
  shift_types: schema.shiftTypes,
  shifts: schema.shifts,
} as const;

function columnInfoFor(table: object): ColumnInfo[] {
  const columns = getTableColumns(table as any);
  return Object.entries(columns).map(([jsName, column]) => ({
    jsName,
    sqlName: (column as any).name,
    isBoolean: (column as any).dataType === 'boolean',
  }));
}

const columnsByTable = new Map<string, ColumnInfo[]>(
  Object.entries(TABLES).map(([sqlName, table]) => [sqlName, columnInfoFor(table)]),
);

const rowsByTable = new Map<string, Record<string, unknown>[]>(
  Object.keys(TABLES).map((name) => [name, []]),
);
const nextIdByTable = new Map<string, number>(Object.keys(TABLES).map((name) => [name, 1]));

function toJsValue(value: unknown, isBoolean: boolean) {
  return isBoolean ? value === 1 || value === true : value;
}

function toSqlValue(value: unknown, isBoolean: boolean) {
  if (isBoolean) return value ? 1 : 0;
  return value ?? null;
}

function quotedIdentifiers(text: string): string[] {
  return [...text.matchAll(/"([a-zA-Z_]+)"/g)].map((m) => m[1]);
}

export function createMemoryDb() {
  return drizzle(async (sql, params) => {
    const text = sql.trim();

    const insertMatch = text.match(/^insert into "([^"]+)"\s*\(([^)]*)\)\s*values\s*\(([^)]*)\)/i);
    if (insertMatch) {
      const [, tableName, columnList, valuesList] = insertMatch;
      const columns = columnsByTable.get(tableName) ?? [];
      const byName = new Map(columns.map((c) => [c.sqlName, c]));
      const sqlNames = quotedIdentifiers(columnList);
      // 有 autoincrement 的 id 欄位,drizzle 產生的 VALUES 會直接寫字面 `null`,不是 `?` 綁定參數,
      // 這裡要照 value token 是不是 `?` 來決定要不要消耗一個 params,不能假設欄位跟 params 一一對應
      const valueTokens = valuesList.split(',').map((t) => t.trim());

      const id = nextIdByTable.get(tableName) ?? 1;
      nextIdByTable.set(tableName, id + 1);

      const row: Record<string, unknown> = { id };
      let paramIndex = 0;
      sqlNames.forEach((sqlName, i) => {
        const col = byName.get(sqlName);
        const isBoundParam = valueTokens[i] === '?';
        if (col && isBoundParam) {
          row[col.jsName] = toJsValue(params[paramIndex], col.isBoolean);
        }
        if (isBoundParam) paramIndex += 1;
      });
      rowsByTable.get(tableName)?.push(row);
      return { rows: [] };
    }

    const updateMatch = text.match(/^update "([^"]+)"/i);
    if (updateMatch) {
      const [, tableName] = updateMatch;
      const [setPart, wherePart] = text.split(/where/i);
      const columns = columnsByTable.get(tableName) ?? [];
      const byName = new Map(columns.map((c) => [c.sqlName, c]));
      const setColumnNames = [...setPart.matchAll(/"([a-zA-Z_]+)"\s*=\s*\?/g)].map((m) => m[1]);
      const id = params[params.length - 1];

      const rows = rowsByTable.get(tableName) ?? [];
      const row = rows.find((r) => r.id === id);
      if (row) {
        setColumnNames.forEach((sqlName, i) => {
          const col = byName.get(sqlName);
          if (col) row[col.jsName] = toJsValue(params[i], col.isBoolean);
        });
      }
      void wherePart;
      return { rows: [] };
    }

    const deleteMatch = text.match(/^delete from "([^"]+)"/i);
    if (deleteMatch) {
      const [, tableName] = deleteMatch;
      const id = params[0];
      const rows = rowsByTable.get(tableName) ?? [];
      const index = rows.findIndex((r) => r.id === id);
      if (index !== -1) rows.splice(index, 1);
      return { rows: [] };
    }

    const selectMatch = text.match(/^select .* from "([^"]+)"/i);
    if (selectMatch) {
      const [, tableName] = selectMatch;
      const columns = columnsByTable.get(tableName) ?? [];
      const rows = rowsByTable.get(tableName) ?? [];
      return { rows: rows.map((row) => columns.map((c) => toSqlValue(row[c.jsName], c.isBoolean))) };
    }

    return { rows: [] };
  }, { schema });
}

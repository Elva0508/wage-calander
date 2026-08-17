import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';
import { Platform } from 'react-native';

import { createMemoryDb } from './memory-db';
import * as schema from './schema';

// expo-sqlite 的網頁版走 WASM worker,在開發伺服器上不穩定(SharedArrayBuffer/sync timeout),
// 所以網頁預覽改用 memory-db.ts 的簡化記憶體資料庫;手機上的真正版本不受影響,仍是這裡的 expo-sqlite。
export const db = Platform.OS === 'web' ? createMemoryDb() : drizzle(openDatabaseSync('shift-wage.db'), { schema });

export const isMemoryDb = Platform.OS === 'web';

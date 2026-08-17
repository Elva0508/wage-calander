import { DarkTheme, DefaultTheme, ThemeProvider } from '@react-navigation/native';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import AppTabs from '@/components/app-tabs';
import { db, isMemoryDb } from '@/db/client';
import { useDataStore } from '@/store/data-store';
import migrations from '../../drizzle/migrations';

SplashScreen.preventAutoHideAsync();

// isMemoryDb 在單一個 bundle 的生命週期內是常數(web/native 各自打包成不同 bundle),
// 所以這裡條件呼叫 hook 是安全的——網頁預覽用的記憶體資料庫不需要 migration
function useDbMigrations() {
  if (isMemoryDb) {
    return { success: true, error: null };
  }
  // eslint-disable-next-line react-hooks/rules-of-hooks
  return useMigrations(db as Parameters<typeof useMigrations>[0], migrations);
}

export default function TabLayout() {
  const colorScheme = useColorScheme();
  const { success, error } = useDbMigrations();

  useEffect(() => {
    if (error) {
      console.error('資料庫 migration 失敗', error);
    }
  }, [error]);

  useEffect(() => {
    if (success) {
      useDataStore.getState().refresh();
    }
  }, [success]);

  if (!success) {
    return null;
  }

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <AnimatedSplashOverlay />
      <AppTabs />
    </ThemeProvider>
  );
}

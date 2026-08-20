import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { styles } from '@/components/settings/shared';
import { WorkplaceHub } from '@/components/settings/workplace-hub';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';

export default function SettingsScreen() {
  const theme = useTheme();
  const [view, setView] = useState<'root' | 'hub'>('root');

  if (view === 'hub') {
    return <WorkplaceHub onBack={() => setView('root')} />;
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <ThemedText type="subtitle">設定</ThemedText>
          <Pressable onPress={() => setView('hub')}>
            <ThemedView type="backgroundElement" style={styles.rootMenuCard}>
              <ThemedText type="smallBold">工作設定</ThemedText>
              <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
            </ThemedView>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

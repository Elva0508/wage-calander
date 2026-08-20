import { useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { HoursReportView } from '@/components/hours-report-view';
import { PaydayCalendarView } from '@/components/payday-calendar-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type ViewMode = 'hours' | 'payday';

export default function WageScreen() {
  const [viewMode, setViewMode] = useState<ViewMode>('hours');

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.header}>
          <ThemedText type="subtitle">統計</ThemedText>
          <ThemedView type="backgroundElement" style={styles.modeRow}>
            <ModeButton label="工時統計" active={viewMode === 'hours'} onPress={() => setViewMode('hours')} />
            <ModeButton label="發薪日曆" active={viewMode === 'payday'} onPress={() => setViewMode('payday')} />
          </ThemedView>
        </ThemedView>

        <ThemedView style={styles.body}>
          {viewMode === 'hours' ? <HoursReportView /> : <PaydayCalendarView />}
        </ThemedView>
      </SafeAreaView>
    </ThemedView>
  );
}

function ModeButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} style={styles.modeButtonPressable}>
      <ThemedView style={[styles.modeButton, { backgroundColor: active ? theme.primary : 'transparent' }]}>
        <ThemedText style={{ color: active ? theme.onPrimary : theme.textSecondary, fontWeight: active ? '500' : '400' }}>
          {label}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
  },
  header: {
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
  },
  modeRow: {
    flexDirection: 'row',
    borderRadius: Spacing.five,
    padding: 3,
  },
  modeButtonPressable: {
    flex: 1,
  },
  modeButton: {
    borderRadius: Spacing.five,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  body: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.five,
  },
});

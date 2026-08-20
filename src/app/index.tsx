import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { SafeAreaView } from 'react-native-safe-area-context';

import { DayDetailSheet } from '@/components/day-detail-sheet';
import { SchedulingSheet } from '@/components/scheduling-sheet';
import { ShiftEditSheet } from '@/components/shift-edit-sheet';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, CardRadius, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useDataStore } from '@/store/data-store';
import { useUiStore } from '@/store/ui-store';

export default function TodayScreen() {
  const theme = useTheme();
  const todayMode = useUiStore((s) => s.todayMode);
  const selectedDate = useUiStore((s) => s.selectedDate);
  const setSelectedDate = useUiStore((s) => s.setSelectedDate);
  const schedulingDate = useUiStore((s) => s.schedulingDate);
  const setSchedulingDate = useUiStore((s) => s.setSchedulingDate);
  const enterSchedulingMode = useUiStore((s) => s.enterSchedulingMode);
  const openDayDetail = useUiStore((s) => s.openDayDetail);

  const shifts = useDataStore((state) => state.shifts);

  const highlightedDate = todayMode === 'scheduling' ? schedulingDate : selectedDate;

  const markedDates = useMemo(() => {
    const marks: Record<string, any> = {};
    for (const shift of shifts) {
      if (shift.isRestDay) {
        marks[shift.date] = {
          ...(marks[shift.date] ?? {}),
          marked: true,
          dotColor: theme.textSecondary,
        };
      } else {
        marks[shift.date] = {
          ...(marks[shift.date] ?? {}),
          marked: true,
          dotColor: theme.primary,
        };
      }
    }
    marks[highlightedDate] = {
      ...(marks[highlightedDate] ?? {}),
      selected: true,
      selectedColor: theme.primary,
    };
    return marks;
  }, [shifts, highlightedDate, theme.primary, theme.textSecondary]);

  const calendarTheme = {
    calendarBackground: theme.backgroundElement,
    dayTextColor: theme.text,
    monthTextColor: theme.text,
    textDisabledColor: theme.textSecondary,
    todayTextColor: theme.primary,
    arrowColor: theme.primary,
  };

  if (todayMode === 'scheduling') {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <View style={styles.schedulingCalendarArea}>
            <Calendar
              current={schedulingDate}
              markedDates={markedDates}
              onDayPress={(day) => setSchedulingDate(day.dateString)}
              theme={calendarTheme}
              style={styles.calendar}
            />
          </View>
          <View style={styles.schedulingSheetArea}>
            <SchedulingSheet />
          </View>
        </SafeAreaView>
        <DayDetailSheet />
        <ShiftEditSheet />
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <ThemedText type="subtitle">今日</ThemedText>

          <Calendar
            current={selectedDate}
            markedDates={markedDates}
            onDayPress={(day) => {
              setSelectedDate(day.dateString);
              openDayDetail(day.dateString);
            }}
            theme={calendarTheme}
            style={styles.calendar}
          />

          <ThemedText type="small" themeColor="textSecondary" style={styles.caption}>
            點任一天查看班別,或按右下角「+」開始排班
          </ThemedText>
        </ScrollView>

        <Pressable onPress={() => enterSchedulingMode()} style={styles.fabWrapper}>
          <ThemedView style={[styles.fab, { backgroundColor: theme.primary }]}>
            <Ionicons name="add" size={28} color={theme.onPrimary} />
          </ThemedView>
        </Pressable>
      </SafeAreaView>

      <DayDetailSheet />
      <ShiftEditSheet />
    </ThemedView>
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
  scrollContent: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    paddingBottom: BottomTabInset + Spacing.six,
    gap: Spacing.three,
  },
  calendar: {
    borderRadius: CardRadius,
  },
  caption: {
    textAlign: 'center',
  },
  fabWrapper: {
    position: 'absolute',
    right: Spacing.four,
    bottom: BottomTabInset + Spacing.four,
  },
  fab: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  schedulingCalendarArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
  },
  schedulingSheetArea: {
    paddingBottom: BottomTabInset,
  },
});

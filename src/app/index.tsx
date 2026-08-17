import { format } from 'date-fns';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, CardRadius, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { calculateShiftHours, calculateShiftWage } from '@/lib/wage';
import { useDataStore } from '@/store/data-store';

export default function CalendarScreen() {
  const theme = useTheme();
  const today = format(new Date(), 'yyyy-MM-dd');
  const [selectedDate, setSelectedDate] = useState(today);
  const shifts = useDataStore((state) => state.shifts);
  const wageRules = useDataStore((state) => state.wageRules);
  const deleteShift = useDataStore((state) => state.deleteShift);

  const markedDates = useMemo(() => {
    const marks: Record<string, any> = {};
    for (const shift of shifts) {
      marks[shift.date] = {
        ...(marks[shift.date] ?? {}),
        marked: true,
        dotColor: theme.primary,
      };
    }
    marks[selectedDate] = {
      ...(marks[selectedDate] ?? {}),
      selected: true,
      selectedColor: theme.primary,
    };
    return marks;
  }, [shifts, selectedDate, theme.primary]);

  const dayShifts = useMemo(
    () =>
      shifts
        .filter((s) => s.date === selectedDate)
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [shifts, selectedDate],
  );

  const onDelete = (id: number) => {
    Alert.alert('刪除班次', '確定要刪除這筆班次嗎?此動作無法復原。', [
      { text: '取消', style: 'cancel' },
      { text: '刪除', style: 'destructive', onPress: () => deleteShift(id) },
    ]);
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <ThemedText type="subtitle">月曆</ThemedText>

          <Calendar
            current={selectedDate}
            markedDates={markedDates}
            onDayPress={(day) => setSelectedDate(day.dateString)}
            theme={{
              calendarBackground: theme.backgroundElement,
              dayTextColor: theme.text,
              monthTextColor: theme.text,
              textDisabledColor: theme.textSecondary,
              todayTextColor: theme.primary,
              arrowColor: theme.primary,
            }}
            style={styles.calendar}
          />

          <ThemedView style={styles.dayHeader}>
            <ThemedText type="smallBold">{selectedDate}</ThemedText>
            <Pressable onPress={() => router.push({ pathname: '/add-shift', params: { date: selectedDate } })}>
              <ThemedText style={{ color: theme.primary }}>+ 新增班次</ThemedText>
            </Pressable>
          </ThemedView>

          {dayShifts.length === 0 ? (
            <ThemedText themeColor="textSecondary">這天還沒有排班。</ThemedText>
          ) : (
            dayShifts.map((shift) => {
              const rule = wageRules.find((r) => r.id === shift.wageRuleId);
              const hours = calculateShiftHours(shift);
              const pay = rule ? calculateShiftWage(shift, rule) : null;
              return (
                <Pressable
                  key={shift.id}
                  onPress={() => router.push({ pathname: '/add-shift', params: { id: String(shift.id) } })}
                  onLongPress={() => onDelete(shift.id)}>
                  <ThemedView type="backgroundElement" style={styles.shiftCard}>
                    <ThemedView type="backgroundElement" style={styles.shiftCardHeader}>
                      <ThemedText type="smallBold">{rule?.jobName ?? '未知工作'}</ThemedText>
                      {pay != null && (
                        <ThemedText style={{ color: theme.primary }}>${pay.toLocaleString()}</ThemedText>
                      )}
                    </ThemedView>
                    <ThemedText themeColor="textSecondary">
                      {shift.startTime}–{shift.endTime}({hours.toFixed(1)} 小時)
                    </ThemedText>
                    {shift.note && <ThemedText themeColor="textSecondary">{shift.note}</ThemedText>}
                  </ThemedView>
                </Pressable>
              );
            })
          )}
        </ScrollView>
      </SafeAreaView>
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
    paddingBottom: BottomTabInset + Spacing.five,
    gap: Spacing.three,
  },
  calendar: {
    borderRadius: CardRadius,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  shiftCard: {
    borderRadius: CardRadius,
    padding: Spacing.four,
    gap: Spacing.half,
  },
  shiftCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});

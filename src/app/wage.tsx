import { Ionicons } from '@expo/vector-icons';
import { addMonths, endOfMonth, format, startOfMonth } from 'date-fns';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, CardRadius, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { calculateShiftHours, calculateShiftWage } from '@/lib/wage';
import { useDataStore } from '@/store/data-store';

export default function WageScreen() {
  const theme = useTheme();
  const shifts = useDataStore((state) => state.shifts);
  const wageRules = useDataStore((state) => state.wageRules);
  const [monthAnchor, setMonthAnchor] = useState(new Date());

  const monthLabel = format(monthAnchor, 'yyyy 年 M 月');
  const rangeStart = format(startOfMonth(monthAnchor), 'yyyy-MM-dd');
  const rangeEnd = format(endOfMonth(monthAnchor), 'yyyy-MM-dd');

  const breakdown = useMemo(() => {
    const monthShifts = shifts.filter((s) => s.date >= rangeStart && s.date <= rangeEnd);

    const byRule = new Map<number, { hours: number; pay: number }>();
    let totalHours = 0;
    let totalPay = 0;

    for (const shift of monthShifts) {
      const rule = wageRules.find((r) => r.id === shift.wageRuleId);
      if (!rule) continue;
      const hours = calculateShiftHours(shift);
      const pay = calculateShiftWage(shift, rule);
      totalHours += hours;
      totalPay += pay;
      const existing = byRule.get(rule.id) ?? { hours: 0, pay: 0 };
      byRule.set(rule.id, { hours: existing.hours + hours, pay: existing.pay + pay });
    }

    return {
      totalHours,
      totalPay,
      byJob: Array.from(byRule.entries()).map(([wageRuleId, sums]) => ({
        rule: wageRules.find((r) => r.id === wageRuleId)!,
        ...sums,
      })),
    };
  }, [shifts, wageRules, rangeStart, rangeEnd]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <ThemedText type="subtitle">薪資總覽</ThemedText>

          <ThemedView style={styles.monthSwitcher}>
            <Pressable onPress={() => setMonthAnchor((d) => addMonths(d, -1))}>
              <Ionicons name="chevron-back" size={22} color={theme.text} />
            </Pressable>
            <ThemedText type="smallBold">{monthLabel}</ThemedText>
            <Pressable onPress={() => setMonthAnchor((d) => addMonths(d, 1))}>
              <Ionicons name="chevron-forward" size={22} color={theme.text} />
            </Pressable>
          </ThemedView>

          <ThemedView style={styles.bigCardRow}>
            <ThemedView style={[styles.bigCard, { backgroundColor: theme.primarySoft }]}>
              <ThemedText type="small" themeColor="textSecondary">
                當月總工時
              </ThemedText>
              <ThemedText type="title" style={[styles.bigNumber, { color: theme.primary }]}>
                {breakdown.totalHours.toFixed(1)}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                小時
              </ThemedText>
            </ThemedView>
            <ThemedView style={[styles.bigCard, { backgroundColor: theme.accentSoft }]}>
              <ThemedText type="small" themeColor="textSecondary">
                預估薪資
              </ThemedText>
              <ThemedText type="title" style={[styles.bigNumber, { color: theme.accent }]}>
                ${breakdown.totalPay.toLocaleString()}
              </ThemedText>
            </ThemedView>
          </ThemedView>

          <ThemedText type="smallBold">依工作拆算</ThemedText>
          {breakdown.byJob.length === 0 ? (
            <ThemedText themeColor="textSecondary">這個月還沒有任何排班紀錄。</ThemedText>
          ) : (
            breakdown.byJob.map(({ rule, hours, pay }) => (
              <ThemedView key={rule.id} type="backgroundElement" style={styles.jobCard}>
                <ThemedText type="smallBold">{rule.jobName}</ThemedText>
                <ThemedView type="backgroundElement" style={styles.jobCardRow}>
                  <ThemedText themeColor="textSecondary">{hours.toFixed(1)} 小時</ThemedText>
                  <ThemedText style={{ color: theme.primary }}>${pay.toLocaleString()}</ThemedText>
                </ThemedView>
              </ThemedView>
            ))
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
  monthSwitcher: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.four,
  },
  bigCardRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
  bigCard: {
    flex: 1,
    borderRadius: CardRadius,
    padding: Spacing.four,
    gap: 2,
  },
  bigNumber: {
    fontSize: 32,
    lineHeight: 38,
  },
  jobCard: {
    borderRadius: CardRadius,
    padding: Spacing.four,
    gap: Spacing.one,
  },
  jobCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});

import { Ionicons } from '@expo/vector-icons';
import { addMonths, endOfMonth, format, startOfMonth } from 'date-fns';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { JobDetailView } from '@/components/job-detail-view';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { PayCycle, resolvePayPeriodsInRange } from '@/lib/pay-period';
import { calculateShiftWage, isShiftCompleted } from '@/lib/wage';
import { resolveShiftWageInput, resolveShiftWorkplaceId } from '@/lib/resolve-shift-wage-input';
import { useDataStore } from '@/store/data-store';

type PaydayRow = {
  key: string;
  workplaceId: number;
  workplaceName: string;
  paydayLabel: string;
  periodLabel: string | null;
  amount: number;
  completed: boolean;
  detailRangeStart: string;
  detailRangeEnd: string;
};

export function PaydayCalendarView() {
  const theme = useTheme();
  const shifts = useDataStore((state) => state.shifts);
  const shiftTypes = useDataStore((state) => state.shiftTypes);
  const workplaces = useDataStore((state) => state.workplaces);
  const [anchor, setAnchor] = useState(new Date());
  const [openDetail, setOpenDetail] = useState<{ workplaceId: number; rangeStart: string; rangeEnd: string } | null>(
    null,
  );

  const shiftTypesById = useMemo(() => new Map(shiftTypes.map((st) => [st.id, st])), [shiftTypes]);
  const workplacesById = useMemo(() => new Map(workplaces.map((w) => [w.id, w])), [workplaces]);

  const rangeStart = startOfMonth(anchor);
  const rangeEnd = endOfMonth(anchor);
  const today = format(new Date(), 'yyyy-MM-dd');
  const monthLabel = format(anchor, 'yyyy 年 M 月');

  function payForPeriod(workplaceId: number, periodStart: string, periodEnd: string): number {
    return shifts
      .filter((s) => s.date >= periodStart && s.date <= periodEnd)
      .filter((s) => (resolveShiftWorkplaceId(s, shiftTypesById) ?? -1) === workplaceId)
      .reduce((sum, s) => {
        const wageInput = resolveShiftWageInput(s, shiftTypesById, workplacesById);
        return sum + (wageInput ? calculateShiftWage(wageInput) : 0);
      }, 0);
  }

  const { rows, unconfigured } = useMemo(() => {
    const result: PaydayRow[] = [];
    const missing: string[] = [];

    for (const workplace of workplaces) {
      if (!workplace.payCycle) {
        missing.push(workplace.name);
        continue;
      }

      if (workplace.payCycle === 'daily') {
        const dayShifts = shifts.filter(
          (s) =>
            s.date >= format(rangeStart, 'yyyy-MM-dd') &&
            s.date <= format(rangeEnd, 'yyyy-MM-dd') &&
            (resolveShiftWorkplaceId(s, shiftTypesById) ?? -1) === workplace.id,
        );
        if (dayShifts.length === 0) continue;
        const amount = dayShifts.reduce((sum, s) => {
          const wageInput = resolveShiftWageInput(s, shiftTypesById, workplacesById);
          return sum + (wageInput ? calculateShiftWage(wageInput) : 0);
        }, 0);
        const allCompleted = dayShifts.every((s) => isShiftCompleted(s.date, today));
        result.push({
          key: `daily-${workplace.id}`,
          workplaceId: workplace.id,
          workplaceName: workplace.name,
          paydayLabel: '日結彙總',
          periodLabel: `本月共 ${dayShifts.length} 個班次`,
          amount,
          completed: allCompleted,
          detailRangeStart: format(rangeStart, 'yyyy-MM-dd'),
          detailRangeEnd: format(rangeEnd, 'yyyy-MM-dd'),
        });
        continue;
      }

      const entries = resolvePayPeriodsInRange({ ...workplace, payCycle: workplace.payCycle as PayCycle }, rangeStart, rangeEnd);
      for (const entry of entries) {
        const amount =
          workplace.wageType === 'monthly'
            ? workplace.monthlySalary ?? 0
            : payForPeriod(workplace.id, entry.periodStart, entry.periodEnd);
        result.push({
          key: `${workplace.id}-${entry.paydayDate}`,
          workplaceId: workplace.id,
          workplaceName: workplace.name,
          paydayLabel: `發薪日 ${shortDate(entry.paydayDate)}`,
          periodLabel: `計薪區間 ${shortDate(entry.periodStart)}–${shortDate(entry.periodEnd)}`,
          amount,
          completed: isShiftCompleted(entry.paydayDate, today),
          detailRangeStart: entry.periodStart,
          detailRangeEnd: entry.periodEnd,
        });
      }
    }

    result.sort((a, b) => a.paydayLabel.localeCompare(b.paydayLabel));
    return { rows: result, unconfigured: missing };
  }, [workplaces, shifts, shiftTypesById, workplacesById, rangeStart, rangeEnd, today]);

  const totals = rows.reduce(
    (acc, row) => {
      const bucket = row.completed ? 'confirmed' : 'pending';
      acc[bucket] += row.amount;
      return acc;
    },
    { confirmed: 0, pending: 0 },
  );

  if (openDetail) {
    return (
      <JobDetailView
        workplaceKey={openDetail.workplaceId}
        rangeStart={openDetail.rangeStart}
        rangeEnd={openDetail.rangeEnd}
        onBack={() => setOpenDetail(null)}
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <ThemedView style={styles.rangeNav}>
        <Pressable onPress={() => setAnchor((d) => addMonths(d, -1))}>
          <Ionicons name="chevron-back" size={22} color={theme.text} />
        </Pressable>
        <ThemedText type="smallBold">{monthLabel}</ThemedText>
        <Pressable onPress={() => setAnchor((d) => addMonths(d, 1))}>
          <Ionicons name="chevron-forward" size={22} color={theme.text} />
        </Pressable>
      </ThemedView>

      {unconfigured.length > 0 && (
        <ThemedView style={[styles.hintBox, { backgroundColor: theme.warningSoft, borderLeftColor: theme.warning }]}>
          <ThemedText type="small" style={{ color: theme.warningText }}>
            {unconfigured.join('、')} 還沒設定發薪日,請去「設定」補上才會出現在這裡
          </ThemedText>
        </ThemedView>
      )}

      <ThemedView style={[styles.heroCard, { backgroundColor: theme.primary }]}>
        <ThemedText type="small" style={{ color: theme.onPrimary, opacity: 0.85 }}>
          這個月總共領到
        </ThemedText>
        <ThemedText type="title" style={[styles.heroNumber, { color: theme.onPrimary }]}>
          ${totals.confirmed.toLocaleString()}
        </ThemedText>
        {totals.pending > 0 && (
          <ThemedText type="small" style={{ color: theme.onPrimary, opacity: 0.85 }}>
            另有預估 ${totals.pending.toLocaleString()} 尚未入帳
          </ThemedText>
        )}
      </ThemedView>

      {rows.length === 0 ? (
        <ThemedText themeColor="textSecondary">這個月還沒有任何發薪紀錄。</ThemedText>
      ) : (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            發薪時間軸
          </ThemedText>
          <ThemedView style={styles.timeline}>
            {rows.map((row) => (
              <Pressable
                key={row.key}
                onPress={() =>
                  setOpenDetail({
                    workplaceId: row.workplaceId,
                    rangeStart: row.detailRangeStart,
                    rangeEnd: row.detailRangeEnd,
                  })
                }>
                <ThemedView type="backgroundElement" style={styles.card}>
                  <ThemedView
                    style={[styles.timelineDot, { backgroundColor: row.completed ? theme.primary : theme.border }]}
                  />
                  <ThemedView type="backgroundElement" style={styles.cardHeader}>
                    <ThemedText type="smallBold">{row.workplaceName}</ThemedText>
                    <ThemedText style={{ color: row.completed ? theme.primary : theme.accent }}>
                      ${row.amount.toLocaleString()}
                    </ThemedText>
                  </ThemedView>
                  <ThemedText type="small" themeColor="textSecondary">
                    {row.paydayLabel}
                    {row.periodLabel ? ` · ${row.periodLabel}` : ''}
                  </ThemedText>
                  {!row.completed && (
                    <ThemedText type="small" themeColor="textSecondary">
                      預估,尚未確定入帳
                    </ThemedText>
                  )}
                </ThemedView>
              </Pressable>
            ))}
          </ThemedView>
        </>
      )}
    </ScrollView>
  );
}

function shortDate(dateStr: string): string {
  const [, month, day] = dateStr.split('-');
  return `${Number(month)}/${Number(day)}`;
}

const styles = StyleSheet.create({
  scrollContent: {
    gap: Spacing.three,
  },
  rangeNav: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.four,
  },
  hintBox: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    borderLeftWidth: 3,
  },
  timeline: {
    gap: Spacing.two,
    paddingLeft: Spacing.three,
  },
  card: {
    position: 'relative',
    borderRadius: CardRadius,
    padding: Spacing.four,
    gap: Spacing.one,
  },
  timelineDot: {
    position: 'absolute',
    left: -Spacing.three - 4,
    top: Spacing.four + 4,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  heroCard: {
    borderRadius: CardRadius,
    padding: Spacing.four,
    gap: 2,
  },
  heroNumber: {
    fontSize: 32,
    lineHeight: 38,
  },
});

import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { calculateShiftHours, calculateShiftWageBreakdown, isShiftCompleted } from '@/lib/wage';
import { resolveShiftWageInput, resolveShiftWorkplaceId } from '@/lib/resolve-shift-wage-input';
import { useDataStore } from '@/store/data-store';
import { UNASSIGNED_KEY } from '@/components/hours-report-view';

const TRUNCATE_AT = 6;

export function JobDetailView({
  workplaceKey,
  rangeStart,
  rangeEnd,
  onBack,
}: {
  workplaceKey: number;
  rangeStart: string;
  rangeEnd: string;
  onBack: () => void;
}) {
  const theme = useTheme();
  const shifts = useDataStore((state) => state.shifts);
  const shiftTypes = useDataStore((state) => state.shiftTypes);
  const workplaces = useDataStore((state) => state.workplaces);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [showAll, setShowAll] = useState(false);

  const shiftTypesById = useMemo(() => new Map(shiftTypes.map((st) => [st.id, st])), [shiftTypes]);
  const workplacesById = useMemo(() => new Map(workplaces.map((w) => [w.id, w])), [workplaces]);
  const workplace = workplaceKey !== UNASSIGNED_KEY ? workplacesById.get(workplaceKey) : undefined;
  const today = format(new Date(), 'yyyy-MM-dd');

  const rows = useMemo(() => {
    const matched = shifts
      .filter((s) => s.date >= rangeStart && s.date <= rangeEnd)
      .filter((s) => (resolveShiftWorkplaceId(s, shiftTypesById) ?? UNASSIGNED_KEY) === workplaceKey)
      .sort((a, b) => a.date.localeCompare(b.date));

    return matched.map((shift) => {
      const shiftType = shift.shiftTypeId != null ? shiftTypesById.get(shift.shiftTypeId) : undefined;
      const wageInput = resolveShiftWageInput(shift, shiftTypesById, workplacesById);
      const hours =
        shift.startTime != null && shift.endTime != null
          ? calculateShiftHours(
              { startTime: shift.startTime, endTime: shift.endTime },
              { breakMinutes: shiftType?.breakMinutes ?? shift.breakMinutes, breakPaid: shiftType?.breakPaid ?? shift.breakPaid },
            )
          : 0;
      const breakdown = wageInput ? calculateShiftWageBreakdown(wageInput) : { total: 0, regularPay: 0, nightPay: 0 };
      const completed = isShiftCompleted(shift.date, today) || workplace?.wageType === 'monthly';
      const hasExtraRate = breakdown.nightPay > 0;

      return {
        shift,
        name: shift.isRestDay ? '休息日' : shiftType?.name ?? '手動輸入',
        timeRange: shift.startTime && shift.endTime ? `${shift.startTime}–${shift.endTime}` : null,
        hours,
        breakdown,
        completed,
        hasExtraRate,
      };
    });
  }, [shifts, shiftTypesById, workplacesById, rangeStart, rangeEnd, workplaceKey, today, workplace?.wageType]);

  const summary = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        const bucket = row.completed ? acc.completed : acc.pending;
        bucket.hours += row.hours;
        bucket.pay += row.breakdown.total;
        return acc;
      },
      { completed: { hours: 0, pay: 0 }, pending: { hours: 0, pay: 0 } },
    );
  }, [rows]);

  const visibleRows = showAll ? rows : rows.slice(0, TRUNCATE_AT);

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <ThemedView style={styles.header}>
        <Pressable onPress={onBack} hitSlop={12} style={styles.backPressable}>
          <ThemedView style={styles.backRow}>
            <Ionicons name="chevron-back" size={22} color={theme.primary} />
            <ThemedText style={{ color: theme.primary }}>返回</ThemedText>
          </ThemedView>
        </Pressable>
        <ThemedText type="smallBold">{workplaceKey === UNASSIGNED_KEY ? '未指定' : workplace?.name ?? '未知工作地點'}</ThemedText>
      </ThemedView>

      <ThemedView style={styles.bigCardRow}>
        <ThemedView style={[styles.bigCard, { backgroundColor: theme.primarySoft }]}>
          <ThemedText type="small" themeColor="textSecondary">
            已完成
          </ThemedText>
          <ThemedText type="title" style={[styles.bigNumber, { color: theme.primary }]}>
            ${summary.completed.pay.toLocaleString()}
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {summary.completed.hours.toFixed(1)} 小時
          </ThemedText>
        </ThemedView>
        {summary.pending.hours + summary.pending.pay > 0 && (
          <ThemedView style={[styles.bigCard, { backgroundColor: theme.accentSoft }]}>
            <ThemedText type="small" themeColor="textSecondary">
              預估
            </ThemedText>
            <ThemedText type="title" style={[styles.bigNumber, { color: theme.accent }]}>
              ${summary.pending.pay.toLocaleString()}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {summary.pending.hours.toFixed(1)} 小時
            </ThemedText>
          </ThemedView>
        )}
      </ThemedView>

      {rows.length === 0 ? (
        <ThemedText themeColor="textSecondary">這段範圍內還沒有這份工作的排班紀錄。</ThemedText>
      ) : (
        visibleRows.map((row) => {
          const expanded = expandedIds.has(row.shift.id);
          return (
            <Pressable
              key={row.shift.id}
              onPress={() => {
                if (!row.hasExtraRate) return;
                setExpandedIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(row.shift.id)) next.delete(row.shift.id);
                  else next.add(row.shift.id);
                  return next;
                });
              }}>
              <ThemedView
                type="backgroundElement"
                style={[styles.dayCard, !row.completed && styles.dayCardPending]}>
                <ThemedView type="backgroundElement" style={styles.dayCardHeader}>
                  <ThemedView type="backgroundElement" style={styles.dayCardTitleRow}>
                    {!row.completed && <Ionicons name="time-outline" size={14} color={theme.textSecondary} />}
                    <ThemedText type="smallBold">
                      {row.shift.date} · {row.name}
                    </ThemedText>
                    {row.shift.manualWageOverride != null && (
                      <Ionicons name="pencil" size={12} color={theme.textSecondary} />
                    )}
                  </ThemedView>
                  <ThemedText style={[!row.completed && { opacity: 0.6 }, { color: theme.primary }]}>
                    ${row.breakdown.total.toLocaleString()}
                  </ThemedText>
                </ThemedView>
                {row.timeRange && (
                  <ThemedText type="small" themeColor="textSecondary">
                    {row.timeRange} · {row.hours.toFixed(1)} 小時
                  </ThemedText>
                )}
                {row.shift.manualWageOverride != null && (
                  <ThemedText type="small" themeColor="textSecondary">
                    此金額為手動調整,非系統自動計算
                  </ThemedText>
                )}
                {expanded && (
                  <ThemedView style={styles.breakdownBox}>
                    <ThemedText type="small" themeColor="textSecondary">
                      一般時段 ${row.breakdown.regularPay.toLocaleString()} + 深夜加給 ${row.breakdown.nightPay.toLocaleString()}
                    </ThemedText>
                  </ThemedView>
                )}
              </ThemedView>
            </Pressable>
          );
        })
      )}

      {!showAll && rows.length > TRUNCATE_AT && (
        <Pressable onPress={() => setShowAll(true)}>
          <ThemedText type="small" themeColor="textSecondary">
            本範圍共 {rows.length} 筆,顯示前 {TRUNCATE_AT} 筆,點擊查看全部
          </ThemedText>
        </Pressable>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    gap: Spacing.three,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  backPressable: {
    minHeight: 44,
    justifyContent: 'center',
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
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
    fontSize: 28,
    lineHeight: 34,
  },
  dayCard: {
    borderRadius: CardRadius,
    padding: Spacing.three,
    gap: Spacing.half,
  },
  dayCardPending: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(0,0,0,0.15)',
  },
  dayCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dayCardTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    flexShrink: 1,
  },
  breakdownBox: {
    paddingTop: Spacing.one,
  },
});

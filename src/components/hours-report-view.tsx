import { Ionicons } from '@expo/vector-icons';
import {
  addDays,
  addMonths,
  addWeeks,
  addYears,
  endOfISOWeek,
  endOfMonth,
  endOfYear,
  format,
  startOfISOWeek,
  startOfMonth,
  startOfYear,
} from 'date-fns';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';

import { JobDetailView } from '@/components/job-detail-view';
import { ReportTemplateForm } from '@/components/report-template-form';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { calculateProratedMonthlySalary, calculateShiftHours, calculateShiftWage, isShiftCompleted } from '@/lib/wage';
import { resolveShiftWageInput, resolveShiftWorkplaceId } from '@/lib/resolve-shift-wage-input';
import { useDataStore } from '@/store/data-store';

export const UNASSIGNED_KEY = -1;

export type RangeType = 'week' | 'biweek' | 'month' | 'year' | 'custom';

export const RANGE_TYPE_LABELS: Record<RangeType, string> = {
  week: '週',
  biweek: '雙週',
  month: '月',
  year: '年',
  custom: '自訂',
};

function todayStr() {
  return format(new Date(), 'yyyy-MM-dd');
}

/** 自訂範圍的輸入框允許使用者一個字一個字打,打到一半(甚至打錯)都不能讓整頁噴錯 */
function parseISODateInput(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function computeRange(
  rangeType: RangeType,
  anchor: Date,
  customRange: { start: string; end: string },
): { start: Date; end: Date; label: string } {
  switch (rangeType) {
    case 'week':
      return { start: startOfISOWeek(anchor), end: endOfISOWeek(anchor), label: format(anchor, "yyyy 年 'W'II") };
    case 'biweek': {
      const start = startOfISOWeek(anchor);
      return { start, end: addDays(start, 13), label: `${format(start, 'M/d')} 起兩週` };
    }
    case 'year':
      return { start: startOfYear(anchor), end: endOfYear(anchor), label: format(anchor, 'yyyy 年') };
    case 'custom': {
      const start = parseISODateInput(customRange.start) ?? startOfMonth(anchor);
      const end = parseISODateInput(customRange.end) ?? endOfMonth(anchor);
      return { start, end, label: `${customRange.start || '未選'} ~ ${customRange.end || '未選'}` };
    }
    case 'month':
    default:
      return { start: startOfMonth(anchor), end: endOfMonth(anchor), label: format(anchor, 'yyyy 年 M 月') };
  }
}

function shiftAnchor(rangeType: RangeType, anchor: Date, direction: 1 | -1): Date {
  switch (rangeType) {
    case 'week':
      return addWeeks(anchor, direction);
    case 'biweek':
      return addWeeks(anchor, direction * 2);
    case 'year':
      return addYears(anchor, direction);
    case 'month':
    default:
      return addMonths(anchor, direction);
  }
}

type Totals = { hours: number; pay: number };
type BucketTotals = Totals & { days: number };

export function HoursReportView() {
  const theme = useTheme();
  const shifts = useDataStore((state) => state.shifts);
  const shiftTypes = useDataStore((state) => state.shiftTypes);
  const workplaces = useDataStore((state) => state.workplaces);
  const reportTemplates = useDataStore((state) => state.reportTemplates);
  const addReportTemplate = useDataStore((state) => state.addReportTemplate);
  const updateReportTemplate = useDataStore((state) => state.updateReportTemplate);
  const deleteReportTemplate = useDataStore((state) => state.deleteReportTemplate);

  const [activeTemplateId, setActiveTemplateId] = useState<'default' | number>('default');
  const [rangeType, setRangeType] = useState<RangeType>('month');
  const [anchor, setAnchor] = useState(new Date());
  const [customRange, setCustomRange] = useState({ start: '', end: '' });
  const [workplaceIds, setWorkplaceIds] = useState<number[] | null>(null); // null = 全部工作
  const [showSplit, setShowSplit] = useState(true);
  const [showBreakdown, setShowBreakdown] = useState(true);
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [openJobKey, setOpenJobKey] = useState<number | null>(null);

  const shiftTypesById = useMemo(() => new Map(shiftTypes.map((st) => [st.id, st])), [shiftTypes]);
  const workplacesById = useMemo(() => new Map(workplaces.map((w) => [w.id, w])), [workplaces]);

  const { start: rangeStart, end: rangeEnd, label: rangeLabel } = useMemo(
    () => computeRange(rangeType, anchor, customRange),
    [rangeType, anchor, customRange],
  );
  const rangeStartStr = format(rangeStart, 'yyyy-MM-dd');
  const rangeEndStr = format(rangeEnd, 'yyyy-MM-dd');
  const today = todayStr();

  function applyTemplate(id: 'default' | number) {
    setActiveTemplateId(id);
    if (id === 'default') {
      setRangeType('month');
      setWorkplaceIds(null);
      setShowSplit(true);
      setShowBreakdown(true);
      return;
    }
    const template = reportTemplates.find((t) => t.id === id);
    if (!template) return;
    setRangeType(template.rangeType as RangeType);
    setWorkplaceIds(template.workplaceIds ? (JSON.parse(template.workplaceIds) as number[]) : null);
    setShowSplit(template.showSplit);
    setShowBreakdown(template.showBreakdown);
  }

  const activeTemplate = typeof activeTemplateId === 'number' ? reportTemplates.find((t) => t.id === activeTemplateId) : undefined;
  const isDrifted =
    !!activeTemplate &&
    (activeTemplate.rangeType !== rangeType ||
      JSON.stringify(activeTemplate.workplaceIds ? JSON.parse(activeTemplate.workplaceIds) : null) !==
        JSON.stringify(workplaceIds) ||
      activeTemplate.showSplit !== showSplit ||
      activeTemplate.showBreakdown !== showBreakdown);

  const report = useMemo(() => {
    const includedWorkplaceIds = workplaceIds == null ? null : new Set(workplaceIds);
    const rangeShifts = shifts.filter((s) => s.date >= rangeStartStr && s.date <= rangeEndStr);

    const completed: Totals = { hours: 0, pay: 0 };
    const future: Totals = { hours: 0, pay: 0 };
    const completedDays = new Set<string>();
    const futureDays = new Set<string>();
    const byWorkplace = new Map<number, { name: string; wageType: string | null; completed: Totals; pending: Totals }>();

    for (const shift of rangeShifts) {
      const workplaceId = resolveShiftWorkplaceId(shift, shiftTypesById) ?? UNASSIGNED_KEY;
      if (includedWorkplaceIds && workplaceId !== UNASSIGNED_KEY && !includedWorkplaceIds.has(workplaceId)) continue;
      if (includedWorkplaceIds && workplaceId === UNASSIGNED_KEY) continue;

      const wageInput = resolveShiftWageInput(shift, shiftTypesById, workplacesById);
      const shiftType = shift.shiftTypeId != null ? shiftTypesById.get(shift.shiftTypeId) : undefined;
      const workplace = workplaceId !== UNASSIGNED_KEY ? workplacesById.get(workplaceId) : undefined;
      const isMonthly = workplace?.wageType === 'monthly';

      const hours =
        shift.startTime != null && shift.endTime != null
          ? calculateShiftHours(
              { startTime: shift.startTime, endTime: shift.endTime },
              { breakMinutes: shiftType?.breakMinutes ?? shift.breakMinutes, breakPaid: shiftType?.breakPaid ?? shift.breakPaid },
            )
          : 0;
      const pay = wageInput ? calculateShiftWage(wageInput) : 0;
      const isAttendanceDay = hours > 0 || pay > 0 || shift.isRestDay === false;

      // 月薪工作不參與截至今日/未來拆分,金額固定算在截至今日——月薪本身不會因為還沒到月底就變得不確定
      const isCompletedBucket = isMonthly || isShiftCompleted(shift.date, today);
      const bucket = isCompletedBucket ? completed : future;
      bucket.hours += hours;
      bucket.pay += pay;
      if (isAttendanceDay) (isCompletedBucket ? completedDays : futureDays).add(shift.date);

      const entry = byWorkplace.get(workplaceId) ?? {
        name: workplaceId === UNASSIGNED_KEY ? '未指定' : workplace?.name ?? '未知工作地點',
        wageType: workplace?.wageType ?? null,
        completed: { hours: 0, pay: 0 },
        pending: { hours: 0, pay: 0 },
      };
      const entryBucket = isCompletedBucket ? entry.completed : entry.pending;
      entryBucket.hours += hours;
      entryBucket.pay += pay;
      byWorkplace.set(workplaceId, entry);
    }

    // 月薪工作不逐班計薪(resolveShiftWageInput 對它一律回傳 null),上面迴圈算出來的 pay 永遠是 0,
    // 這裡另外把 Workplace.monthlySalary 依重疊天數攤進選定範圍,只攤一次、只算進截至今日
    for (const [workplaceId, entry] of byWorkplace) {
      if (entry.wageType !== 'monthly') continue;
      const workplace = workplacesById.get(workplaceId);
      const prorated = calculateProratedMonthlySalary(workplace?.monthlySalary ?? 0, rangeStartStr, rangeEndStr);
      entry.completed.pay += prorated;
      completed.pay += prorated;
    }

    return {
      completed: { ...completed, days: completedDays.size } as BucketTotals,
      future: { ...future, days: futureDays.size } as BucketTotals,
      totalPay: completed.pay + future.pay,
      byWorkplace: Array.from(byWorkplace.entries()).map(([key, value]) => ({ key, ...value })),
    };
  }, [shifts, shiftTypesById, workplacesById, rangeStartStr, rangeEndStr, workplaceIds, today]);

  if (openJobKey != null) {
    return (
      <JobDetailView
        workplaceKey={openJobKey}
        rangeStart={rangeStartStr}
        rangeEnd={rangeEndStr}
        onBack={() => setOpenJobKey(null)}
      />
    );
  }

  if (showTemplateForm) {
    return (
      <ReportTemplateForm
        workplaces={workplaces}
        onCancel={() => setShowTemplateForm(false)}
        onSubmit={async (values) => {
          await addReportTemplate(values);
          setShowTemplateForm(false);
        }}
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <ThemedView style={styles.pillRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.pillRowContent}>
          <Pill label="預設" active={activeTemplateId === 'default'} onPress={() => applyTemplate('default')} />
          {reportTemplates.map((t) => (
            <Pill key={t.id} label={t.name} active={activeTemplateId === t.id} onPress={() => applyTemplate(t.id)} />
          ))}
          <Pressable onPress={() => setShowTemplateForm(true)}>
            <ThemedView style={[styles.pill, styles.pillAdd, { borderColor: theme.primary }]}>
              <Ionicons name="add" size={14} color={theme.primary} />
              <ThemedText type="small" style={{ color: theme.primary }}>
                新增範本
              </ThemedText>
            </ThemedView>
          </Pressable>
        </ScrollView>
      </ThemedView>

      {isDrifted && activeTemplate && (
        <ThemedView style={[styles.driftBanner, { backgroundColor: theme.accentSoft }]}>
          <ThemedText type="small" style={{ color: theme.accent }}>
            篩選條件已跟「{activeTemplate.name}」不一樣,不會自動存回範本
          </ThemedText>
          <Pressable
            onPress={() =>
              updateReportTemplate(activeTemplate.id, {
                rangeType,
                workplaceIds: workplaceIds ? JSON.stringify(workplaceIds) : null,
                showSplit,
                showBreakdown,
              })
            }>
            <ThemedText type="small" style={{ color: theme.accent, fontWeight: '700' }}>
              更新範本
            </ThemedText>
          </Pressable>
        </ThemedView>
      )}

      {typeof activeTemplateId === 'number' && (
        <Pressable
          onPress={() => {
            const id = activeTemplateId;
            Alert.alert('刪除範本', '確定要刪除這個範本嗎?此動作無法復原。', [
              { text: '取消', style: 'cancel' },
              {
                text: '刪除',
                style: 'destructive',
                onPress: async () => {
                  await deleteReportTemplate(id);
                  setActiveTemplateId('default');
                },
              },
            ]);
          }}>
          <ThemedText type="small" themeColor="textSecondary">
            刪除這個範本
          </ThemedText>
        </Pressable>
      )}

      <ThemedView style={styles.chipRow}>
        {(['week', 'biweek', 'month', 'year', 'custom'] as const).map((option) => (
          <Chip
            key={option}
            label={RANGE_TYPE_LABELS[option]}
            active={rangeType === option}
            onPress={() => setRangeType(option)}
          />
        ))}
      </ThemedView>

      {rangeType === 'custom' ? (
        <ThemedView style={styles.customRangeRow}>
          <TextInput
            value={customRange.start}
            onChangeText={(v) => setCustomRange((r) => ({ ...r, start: v }))}
            placeholder="起始 YYYY-MM-DD"
            placeholderTextColor={theme.textSecondary}
            style={[styles.customRangeInput, { color: theme.text, borderColor: theme.border }]}
          />
          <TextInput
            value={customRange.end}
            onChangeText={(v) => setCustomRange((r) => ({ ...r, end: v }))}
            placeholder="結束 YYYY-MM-DD"
            placeholderTextColor={theme.textSecondary}
            style={[styles.customRangeInput, { color: theme.text, borderColor: theme.border }]}
          />
        </ThemedView>
      ) : (
        <ThemedView style={styles.rangeNav}>
          <Pressable onPress={() => setAnchor((d) => shiftAnchor(rangeType, d, -1))}>
            <Ionicons name="chevron-back" size={22} color={theme.text} />
          </Pressable>
          <ThemedText type="smallBold">{rangeLabel}</ThemedText>
          <Pressable onPress={() => setAnchor((d) => shiftAnchor(rangeType, d, 1))}>
            <Ionicons name="chevron-forward" size={22} color={theme.text} />
          </Pressable>
        </ThemedView>
      )}

      <ThemedView style={styles.chipRow}>
        <Chip label="全部工作" active={workplaceIds == null} onPress={() => setWorkplaceIds(null)} />
        {workplaces.map((wp) => (
          <Chip
            key={wp.id}
            label={wp.name}
            active={!!workplaceIds?.includes(wp.id)}
            onPress={() =>
              setWorkplaceIds((prev) => {
                const current = prev ?? [];
                return current.includes(wp.id) ? current.filter((id) => id !== wp.id) : [...current, wp.id];
              })
            }
          />
        ))}
      </ThemedView>

      {showSplit ? (
        <>
          <ThemedView style={[styles.totalCard, { backgroundColor: theme.primarySoft }]}>
            <ThemedText type="small" themeColor="textSecondary">
              未來總計
            </ThemedText>
            <ThemedText type="title" style={[styles.bigNumber, { color: theme.primary }]}>
              ${report.totalPay.toLocaleString()}
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              這個日期區間總共可以領到多少
            </ThemedText>
          </ThemedView>
          <ThemedView style={styles.bigCardRow}>
            <SummaryCard
              label="截至今日"
              hours={report.completed.hours}
              pay={report.completed.pay}
              days={report.completed.days}
              color={theme.primary}
              background={theme.primarySoft}
            />
          </ThemedView>
        </>
      ) : (
        <ThemedView style={styles.bigCardRow}>
          <SummaryCard
            label="總計"
            hours={report.completed.hours + report.future.hours}
            pay={report.totalPay}
            days={report.completed.days + report.future.days}
            color={theme.primary}
            background={theme.primarySoft}
          />
        </ThemedView>
      )}

      {showBreakdown && (
        <>
          <ThemedText type="smallBold">依工作拆算</ThemedText>
          {report.byWorkplace.length === 0 ? (
            <ThemedText themeColor="textSecondary">這段範圍內還沒有任何排班紀錄。</ThemedText>
          ) : (
            report.byWorkplace.map(({ key, name, completed: c, pending: p }) => (
              <Pressable key={key} onPress={() => setOpenJobKey(key)}>
                <ThemedView type="backgroundElement" style={styles.jobCard}>
                  <ThemedView type="backgroundElement" style={styles.jobCardHeader}>
                    <ThemedText type="smallBold">{name}</ThemedText>
                    <Ionicons name="chevron-forward" size={16} color={theme.textSecondary} />
                  </ThemedView>
                  <ThemedView type="backgroundElement" style={styles.jobCardRow}>
                    <ThemedText themeColor="textSecondary">{(c.hours + p.hours).toFixed(1)} 小時</ThemedText>
                    <ThemedText style={{ color: theme.primary }}>${(c.pay + p.pay).toLocaleString()}</ThemedText>
                  </ThemedView>
                </ThemedView>
              </Pressable>
            ))
          )}
        </>
      )}
    </ScrollView>
  );
}

function SummaryCard({
  label,
  hours,
  pay,
  days,
  color,
  background,
}: {
  label: string;
  hours: number;
  pay: number;
  days: number;
  color: string;
  background: string;
}) {
  return (
    <ThemedView style={[styles.bigCard, { backgroundColor: background }]}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      <ThemedText type="title" style={[styles.bigNumber, { color }]}>
        ${pay.toLocaleString()}
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary">
        {hours.toFixed(1)} 小時 · {days} 天
      </ThemedText>
    </ThemedView>
  );
}

function Pill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress}>
      <ThemedView style={[styles.pill, { backgroundColor: active ? theme.primary : theme.backgroundElement }]}>
        <ThemedText type="small" style={{ color: active ? '#ffffff' : theme.text }}>
          {label}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress}>
      <ThemedView style={[styles.chip, { backgroundColor: active ? theme.primary : theme.backgroundElement }]}>
        <ThemedText type="small" style={{ color: active ? '#ffffff' : theme.text }}>
          {label}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    gap: Spacing.three,
  },
  pillRow: {
    flexDirection: 'row',
  },
  pillRowContent: {
    gap: Spacing.two,
  },
  pill: {
    borderRadius: Spacing.five,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
  },
  pillAdd: {
    borderWidth: 1.5,
    borderStyle: 'dashed',
    backgroundColor: 'transparent',
  },
  driftBanner: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  chip: {
    borderRadius: Spacing.five,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  rangeNav: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.four,
  },
  customRangeRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  customRangeInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  totalCard: {
    borderRadius: CardRadius,
    padding: Spacing.four,
    gap: 2,
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
  jobCard: {
    borderRadius: CardRadius,
    padding: Spacing.four,
    gap: Spacing.one,
  },
  jobCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  jobCardRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});

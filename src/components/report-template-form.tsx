import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { NewReportTemplate, Workplace } from '@/db/schema';
import { RANGE_TYPE_LABELS, RangeType } from '@/components/hours-report-view';

export function ReportTemplateForm({
  workplaces,
  onCancel,
  onSubmit,
}: {
  workplaces: Workplace[];
  onCancel: () => void;
  onSubmit: (values: NewReportTemplate) => Promise<void>;
}) {
  const theme = useTheme();
  const [name, setName] = useState('');
  const [rangeType, setRangeType] = useState<RangeType>('month');
  const [workplaceIds, setWorkplaceIds] = useState<number[] | null>(null);
  const [showSplit, setShowSplit] = useState(true);
  const [showBreakdown, setShowBreakdown] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = name.trim().length > 0 && !submitting;

  async function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    await onSubmit({
      name: name.trim(),
      rangeType,
      workplaceIds: workplaceIds ? JSON.stringify(workplaceIds) : null,
      showSplit,
      showBreakdown,
    });
    setSubmitting(false);
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContent}>
      <ThemedView style={styles.formHeader}>
        <Pressable onPress={onCancel}>
          <ThemedText style={{ color: theme.primary }}>取消</ThemedText>
        </Pressable>
        <ThemedText type="smallBold">新增範本</ThemedText>
        <Pressable onPress={handleSubmit} disabled={!canSubmit}>
          <ThemedText style={{ color: canSubmit ? theme.primary : theme.textSecondary }}>儲存</ThemedText>
        </Pressable>
      </ThemedView>

      <ThemedView style={styles.fieldGroup}>
        <ThemedText type="small" themeColor="textSecondary">
          範本名稱
        </ThemedText>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="例如:兼職月結"
          placeholderTextColor={theme.textSecondary}
          style={[styles.input, { color: theme.text, borderColor: theme.border }]}
        />
      </ThemedView>

      <ThemedView style={styles.fieldGroup}>
        <ThemedText type="small" themeColor="textSecondary">
          時間範圍規則
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          存的是「規則」不是固定日期,套用時永遠是相對現在重新算;自訂範圍套用時要重新選一次日期。
        </ThemedText>
        <ThemedView style={styles.chipRow}>
          {(['week', 'biweek', 'month', 'year', 'custom'] as const).map((option) => (
            <Pressable key={option} onPress={() => setRangeType(option)}>
              <ThemedView
                style={[styles.chip, { backgroundColor: rangeType === option ? theme.primary : theme.backgroundElement }]}>
                <ThemedText type="small" style={{ color: rangeType === option ? '#ffffff' : theme.text }}>
                  {RANGE_TYPE_LABELS[option]}
                </ThemedText>
              </ThemedView>
            </Pressable>
          ))}
        </ThemedView>
      </ThemedView>

      <ThemedView style={styles.fieldGroup}>
        <ThemedText type="small" themeColor="textSecondary">
          工作範圍
        </ThemedText>
        <ThemedView style={styles.chipRow}>
          <Pressable onPress={() => setWorkplaceIds(null)}>
            <ThemedView style={[styles.chip, { backgroundColor: workplaceIds == null ? theme.primary : theme.backgroundElement }]}>
              <ThemedText type="small" style={{ color: workplaceIds == null ? '#ffffff' : theme.text }}>
                全部工作
              </ThemedText>
            </ThemedView>
          </Pressable>
          {workplaces.map((wp) => {
            const active = !!workplaceIds?.includes(wp.id);
            return (
              <Pressable
                key={wp.id}
                onPress={() =>
                  setWorkplaceIds((prev) => {
                    const current = prev ?? [];
                    return current.includes(wp.id) ? current.filter((id) => id !== wp.id) : [...current, wp.id];
                  })
                }>
                <ThemedView style={[styles.chip, { backgroundColor: active ? theme.primary : theme.backgroundElement }]}>
                  <ThemedText type="small" style={{ color: active ? '#ffffff' : theme.text }}>
                    {wp.name}
                  </ThemedText>
                </ThemedView>
              </Pressable>
            );
          })}
        </ThemedView>
      </ThemedView>

      <ThemedView style={styles.fieldGroup}>
        <ThemedText type="small" themeColor="textSecondary">
          要顯示的區塊
        </ThemedText>
        <ThemedView type="backgroundElement" style={styles.switchRow}>
          <ThemedText>已完成/預估拆分</ThemedText>
          <Switch value={showSplit} onValueChange={setShowSplit} trackColor={{ true: theme.primary }} />
        </ThemedView>
        <ThemedView type="backgroundElement" style={styles.switchRow}>
          <ThemedText>依工作拆算列表</ThemedText>
          <Switch value={showBreakdown} onValueChange={setShowBreakdown} trackColor={{ true: theme.primary }} />
        </ThemedView>
      </ThemedView>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    gap: Spacing.three,
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  fieldGroup: {
    gap: Spacing.two,
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
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
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.one,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
  },
});

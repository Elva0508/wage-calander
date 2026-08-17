import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, CardRadius, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { WageRule } from '@/db/schema';
import { useDataStore } from '@/store/data-store';

const ruleFormSchema = z.object({
  jobName: z.string().trim().min(1, '請輸入工作名稱'),
  baseRate: z.coerce.number().positive('基本時薪需大於 0'),
  nightRateEnabled: z.boolean(),
  nightMultiplier: z.coerce.number().positive().optional(),
  nightStart: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, '格式需為 HH:mm').optional(),
  nightEnd: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, '格式需為 HH:mm').optional(),
  holidayRateEnabled: z.boolean(),
  holidayPercent: z.coerce.number().positive().optional(),
});

type RuleFormValues = z.infer<typeof ruleFormSchema>;

const emptyValues: RuleFormValues = {
  jobName: '',
  baseRate: 0,
  nightRateEnabled: false,
  nightMultiplier: 1.34,
  nightStart: '22:00',
  nightEnd: '06:00',
  holidayRateEnabled: false,
  holidayPercent: 33,
};

export default function SettingsScreen() {
  const theme = useTheme();
  const wageRules = useDataStore((state) => state.wageRules);
  const addWageRule = useDataStore((state) => state.addWageRule);
  const updateWageRule = useDataStore((state) => state.updateWageRule);
  const [editingId, setEditingId] = useState<number | 'new' | null>(null);

  const editingRule = useMemo(
    () => (typeof editingId === 'number' ? wageRules.find((r) => r.id === editingId) : undefined),
    [editingId, wageRules],
  );

  if (editingId !== null) {
    return (
      <RuleForm
        key={editingId}
        initial={editingRule}
        onCancel={() => setEditingId(null)}
        onSubmit={async (values) => {
          if (typeof editingId === 'number') {
            await updateWageRule(editingId, values);
          } else {
            await addWageRule(values);
          }
          setEditingId(null);
        }}
      />
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}>
          <ThemedText type="subtitle">薪資規則設定</ThemedText>

          {wageRules.length === 0 ? (
            <ThemedText themeColor="textSecondary">
              還沒有任何工作,點下方「新增工作」開始設定時薪。
            </ThemedText>
          ) : (
            wageRules.map((rule) => (
              <Pressable key={rule.id} onPress={() => setEditingId(rule.id)}>
                <ThemedView type="backgroundElement" style={styles.ruleCard}>
                  <ThemedView type="backgroundElement" style={styles.ruleCardHeader}>
                    <ThemedText type="smallBold">{rule.jobName}</ThemedText>
                    <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
                  </ThemedView>
                  <ThemedText themeColor="textSecondary">基本時薪 ${rule.baseRate}</ThemedText>
                  <ThemedView type="backgroundElement" style={styles.badgeRow}>
                    {rule.nightRateEnabled && <Badge label="深夜加給" color={theme.primary} />}
                    {rule.holidayRateEnabled && <Badge label="假日加給" color={theme.accent} />}
                  </ThemedView>
                </ThemedView>
              </Pressable>
            ))
          )}

          <Pressable onPress={() => setEditingId('new')}>
            <ThemedView style={[styles.addButton, { borderColor: theme.primary }]}>
              <Ionicons name="add" size={18} color={theme.primary} />
              <ThemedText style={{ color: theme.primary }}>新增工作</ThemedText>
            </ThemedView>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function Badge({ label, color }: { label: string; color: string }) {
  return (
    <ThemedView style={[styles.badge, { backgroundColor: color }]}>
      <ThemedText type="small" style={styles.badgeText}>
        {label}
      </ThemedText>
    </ThemedView>
  );
}

function RuleForm({
  initial,
  onSubmit,
  onCancel,
}: {
  initial?: WageRule;
  onSubmit: (values: RuleFormValues) => Promise<void>;
  onCancel: () => void;
}) {
  const theme = useTheme();
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof ruleFormSchema>, any, RuleFormValues>({
    resolver: zodResolver(ruleFormSchema),
    defaultValues: initial
      ? {
          jobName: initial.jobName,
          baseRate: initial.baseRate,
          nightRateEnabled: initial.nightRateEnabled,
          nightMultiplier: initial.nightMultiplier ?? emptyValues.nightMultiplier,
          nightStart: initial.nightStart ?? emptyValues.nightStart,
          nightEnd: initial.nightEnd ?? emptyValues.nightEnd,
          holidayRateEnabled: initial.holidayRateEnabled,
          holidayPercent: initial.holidayPercent ?? emptyValues.holidayPercent,
        }
      : emptyValues,
  });

  const nightEnabled = watch('nightRateEnabled');
  const holidayEnabled = watch('holidayRateEnabled');

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent}>
          <ThemedView type="backgroundElement" style={styles.formHeader}>
            <Pressable onPress={onCancel}>
              <ThemedText style={{ color: theme.primary }}>取消</ThemedText>
            </Pressable>
            <ThemedText type="smallBold">{initial ? '編輯工作' : '新增工作'}</ThemedText>
            <Pressable onPress={handleSubmit(onSubmit)} disabled={isSubmitting}>
              <ThemedText style={{ color: theme.primary }}>儲存</ThemedText>
            </Pressable>
          </ThemedView>

          <FieldLabel label="工作名稱" error={errors.jobName?.message}>
            <Controller
              control={control}
              name="jobName"
              render={({ field }) => (
                <TextInput
                  value={field.value}
                  onChangeText={field.onChange}
                  placeholder="例如:早餐店"
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                />
              )}
            />
          </FieldLabel>

          <FieldLabel label="基本時薪" error={errors.baseRate?.message}>
            <Controller
              control={control}
              name="baseRate"
              render={({ field }) => (
                <TextInput
                  value={String(field.value ?? '')}
                  onChangeText={field.onChange}
                  keyboardType="numeric"
                  placeholder="183"
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                />
              )}
            />
          </FieldLabel>

          <SwitchRow label="深夜加給" name="nightRateEnabled" control={control} />
          <ThemedView style={[styles.subFields, !nightEnabled && styles.disabledSection]}>
            <FieldLabel label="深夜倍率" error={errors.nightMultiplier?.message}>
              <Controller
                control={control}
                name="nightMultiplier"
                render={({ field }) => (
                  <TextInput
                    editable={nightEnabled}
                    value={String(field.value ?? '')}
                    onChangeText={field.onChange}
                    keyboardType="numeric"
                    placeholder="1.34"
                    placeholderTextColor={theme.textSecondary}
                    style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                  />
                )}
              />
            </FieldLabel>
            <ThemedView type="backgroundElement" style={styles.timeRow}>
              <FieldLabel label="開始時段" error={errors.nightStart?.message} flex>
                <Controller
                  control={control}
                  name="nightStart"
                  render={({ field }) => (
                    <TextInput
                      editable={nightEnabled}
                      value={field.value}
                      onChangeText={field.onChange}
                      placeholder="22:00"
                      placeholderTextColor={theme.textSecondary}
                      style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                    />
                  )}
                />
              </FieldLabel>
              <FieldLabel label="結束時段" error={errors.nightEnd?.message} flex>
                <Controller
                  control={control}
                  name="nightEnd"
                  render={({ field }) => (
                    <TextInput
                      editable={nightEnabled}
                      value={field.value}
                      onChangeText={field.onChange}
                      placeholder="06:00"
                      placeholderTextColor={theme.textSecondary}
                      style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                    />
                  )}
                />
              </FieldLabel>
            </ThemedView>
          </ThemedView>

          <SwitchRow label="假日加給" name="holidayRateEnabled" control={control} />
          <ThemedView style={[styles.subFields, !holidayEnabled && styles.disabledSection]}>
            <FieldLabel label="假日加成百分比" error={errors.holidayPercent?.message}>
              <Controller
                control={control}
                name="holidayPercent"
                render={({ field }) => (
                  <TextInput
                    editable={holidayEnabled}
                    value={String(field.value ?? '')}
                    onChangeText={field.onChange}
                    keyboardType="numeric"
                    placeholder="33"
                    placeholderTextColor={theme.textSecondary}
                    style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                  />
                )}
              />
            </FieldLabel>
          </ThemedView>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function FieldLabel({
  label,
  error,
  flex,
  children,
}: {
  label: string;
  error?: string;
  flex?: boolean;
  children: React.ReactNode;
}) {
  return (
    <ThemedView style={[styles.fieldGroup, flex && styles.flex1]}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      {children}
      {error && (
        <ThemedText type="small" themeColor="textSecondary" style={styles.errorText}>
          {error}
        </ThemedText>
      )}
    </ThemedView>
  );
}

function SwitchRow({ label, name, control }: { label: string; name: 'nightRateEnabled' | 'holidayRateEnabled'; control: any }) {
  const theme = useTheme();
  return (
    <ThemedView type="backgroundElement" style={styles.switchRow}>
      <ThemedText>{label}</ThemedText>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <Switch
            value={field.value}
            onValueChange={field.onChange}
            trackColor={{ true: theme.primary }}
          />
        )}
      />
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
  ruleCard: {
    borderRadius: CardRadius,
    padding: Spacing.four,
    gap: Spacing.one,
  },
  ruleCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  badgeRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  badge: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 4,
    borderRadius: Spacing.five,
  },
  badgeText: {
    color: '#ffffff',
  },
  addButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.one,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: CardRadius,
    paddingVertical: Spacing.three,
  },
  formHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.two,
  },
  fieldGroup: {
    gap: Spacing.one,
  },
  flex1: {
    flex: 1,
  },
  input: {
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  errorText: {
    color: '#C0392B',
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.one,
  },
  subFields: {
    gap: Spacing.three,
    paddingLeft: Spacing.three,
  },
  disabledSection: {
    opacity: 0.4,
  },
  timeRow: {
    flexDirection: 'row',
    gap: Spacing.three,
  },
});

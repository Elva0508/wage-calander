import { zodResolver } from '@hookform/resolvers/zod';
import { format } from 'date-fns';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Alert, Pressable, ScrollView, StyleSheet, TextInput } from 'react-native';
import { Calendar } from 'react-native-calendars';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, CardRadius, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { calculateShiftHours, calculateShiftWage } from '@/lib/wage';
import { useDataStore } from '@/store/data-store';

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const shiftFormSchema = z
  .object({
    wageRuleId: z.number(),
    date: z.string().min(1, '請選擇日期'),
    startTime: z.string().regex(timeRegex, '格式需為 HH:mm'),
    endTime: z.string().regex(timeRegex, '格式需為 HH:mm'),
    note: z.string().optional(),
  })
  .refine((values) => values.startTime !== values.endTime, {
    message: '結束時間需晚於開始時間(不可與開始時間相同)',
    path: ['endTime'],
  });

type ShiftFormValues = z.infer<typeof shiftFormSchema>;

export default function AddShiftScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{ id?: string; date?: string }>();
  const wageRules = useDataStore((state) => state.wageRules);
  const existingShift = useDataStore((state) =>
    params.id ? state.shifts.find((s) => s.id === Number(params.id)) : undefined,
  );
  const addShift = useDataStore((state) => state.addShift);
  const updateShift = useDataStore((state) => state.updateShift);
  const deleteShift = useDataStore((state) => state.deleteShift);
  const [showCalendar, setShowCalendar] = useState(false);

  const isEditing = existingShift != null;

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ShiftFormValues>({
    resolver: zodResolver(shiftFormSchema),
    defaultValues: {
      wageRuleId: existingShift?.wageRuleId ?? wageRules[0]?.id,
      date: existingShift?.date ?? params.date ?? format(new Date(), 'yyyy-MM-dd'),
      startTime: existingShift?.startTime ?? '',
      endTime: existingShift?.endTime ?? '',
      note: existingShift?.note ?? '',
    },
  });

  const watchedValues = watch();
  const selectedRule = wageRules.find((r) => r.id === watchedValues.wageRuleId);

  const preview = useMemo(() => {
    if (!selectedRule || !timeRegex.test(watchedValues.startTime) || !timeRegex.test(watchedValues.endTime)) {
      return null;
    }
    const shift = { startTime: watchedValues.startTime, endTime: watchedValues.endTime };
    return {
      hours: calculateShiftHours(shift),
      pay: calculateShiftWage(shift, selectedRule),
    };
  }, [selectedRule, watchedValues.startTime, watchedValues.endTime]);

  if (wageRules.length === 0) {
    return (
      <ThemedView style={styles.container}>
        <SafeAreaView style={styles.safeArea}>
          <ThemedView style={styles.emptyState}>
            <ThemedText type="subtitle" style={styles.centerText}>
              還沒有薪資規則
            </ThemedText>
            <ThemedText themeColor="textSecondary" style={styles.centerText}>
              請先到「設定」分頁新增一份工作的時薪,才能記錄班次。
            </ThemedText>
            <Pressable onPress={() => router.push('/settings')}>
              <ThemedView style={[styles.submitButton, { backgroundColor: theme.primary }]}>
                <ThemedText style={styles.submitButtonText}>前往設定</ThemedText>
              </ThemedView>
            </Pressable>
          </ThemedView>
        </SafeAreaView>
      </ThemedView>
    );
  }

  const onSubmit = async (values: ShiftFormValues) => {
    if (isEditing) {
      await updateShift(existingShift.id, values);
    } else {
      await addShift(values);
    }
    router.back();
  };

  const onDelete = () => {
    if (!isEditing) return;
    Alert.alert('刪除班次', '確定要刪除這筆班次嗎?此動作無法復原。', [
      { text: '取消', style: 'cancel' },
      {
        text: '刪除',
        style: 'destructive',
        onPress: async () => {
          await deleteShift(existingShift.id);
          router.back();
        },
      },
    ]);
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <ThemedText type="subtitle">{isEditing ? '編輯班次' : '新增班次'}</ThemedText>

          <FieldGroup label="選工作" error={errors.wageRuleId?.message}>
            <Controller
              control={control}
              name="wageRuleId"
              render={({ field }) => (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow}>
                  {wageRules.map((rule) => {
                    const selected = field.value === rule.id;
                    return (
                      <Pressable key={rule.id} onPress={() => field.onChange(rule.id)}>
                        <ThemedView
                          style={[
                            styles.chip,
                            {
                              backgroundColor: selected ? theme.primary : theme.backgroundElement,
                            },
                          ]}>
                          <ThemedText style={{ color: selected ? '#ffffff' : theme.text }}>
                            {rule.jobName}
                          </ThemedText>
                        </ThemedView>
                      </Pressable>
                    );
                  })}
                </ScrollView>
              )}
            />
          </FieldGroup>

          <FieldGroup label="日期" error={errors.date?.message}>
            <Controller
              control={control}
              name="date"
              render={({ field }) => (
                <>
                  <Pressable onPress={() => setShowCalendar((v) => !v)}>
                    <ThemedView type="backgroundElement" style={styles.dateButton}>
                      <ThemedText>{field.value}</ThemedText>
                    </ThemedView>
                  </Pressable>
                  {showCalendar && (
                    <Calendar
                      current={field.value}
                      onDayPress={(day) => {
                        field.onChange(day.dateString);
                        setShowCalendar(false);
                      }}
                      markedDates={{ [field.value]: { selected: true, selectedColor: theme.primary } }}
                      theme={{
                        calendarBackground: theme.backgroundElement,
                        dayTextColor: theme.text,
                        monthTextColor: theme.text,
                        todayTextColor: theme.primary,
                        arrowColor: theme.primary,
                      }}
                      style={styles.calendar}
                    />
                  )}
                </>
              )}
            />
          </FieldGroup>

          <ThemedView type="backgroundElement" style={styles.timeRow}>
            <FieldGroup label="開始時間" error={errors.startTime?.message} flex>
              <Controller
                control={control}
                name="startTime"
                render={({ field }) => (
                  <TextInput
                    value={field.value}
                    onChangeText={field.onChange}
                    placeholder="09:00"
                    placeholderTextColor={theme.textSecondary}
                    style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                  />
                )}
              />
            </FieldGroup>
            <FieldGroup label="結束時間" error={errors.endTime?.message} flex>
              <Controller
                control={control}
                name="endTime"
                render={({ field }) => (
                  <TextInput
                    value={field.value}
                    onChangeText={field.onChange}
                    placeholder="17:00"
                    placeholderTextColor={theme.textSecondary}
                    style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                  />
                )}
              />
            </FieldGroup>
          </ThemedView>
          <ThemedText type="small" themeColor="textSecondary">
            結束時間比開始時間早,會視為跨夜到隔天(例如 23:00–06:00)。
          </ThemedText>

          <FieldGroup label="備註(選填)">
            <Controller
              control={control}
              name="note"
              render={({ field }) => (
                <TextInput
                  value={field.value}
                  onChangeText={field.onChange}
                  placeholder="例如:代班、教育訓練"
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                />
              )}
            />
          </FieldGroup>

          {preview && (
            <ThemedView style={[styles.previewCard, { backgroundColor: theme.primarySoft }]}>
              <ThemedText type="small" themeColor="textSecondary">
                預估這班薪資
              </ThemedText>
              <ThemedText type="subtitle" style={{ color: theme.primary }}>
                ${preview.pay.toLocaleString()}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                共 {preview.hours.toFixed(1)} 小時
              </ThemedText>
            </ThemedView>
          )}

          <Pressable onPress={handleSubmit(onSubmit)} disabled={isSubmitting}>
            <ThemedView style={[styles.submitButton, { backgroundColor: theme.primary }]}>
              <ThemedText style={styles.submitButtonText}>{isEditing ? '儲存變更' : '新增班次'}</ThemedText>
            </ThemedView>
          </Pressable>

          {isEditing && (
            <Pressable onPress={onDelete}>
              <ThemedView style={[styles.deleteButton, { borderColor: theme.danger }]}>
                <ThemedText style={{ color: theme.danger }}>刪除這筆班次</ThemedText>
              </ThemedView>
            </Pressable>
          )}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function FieldGroup({
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
        <ThemedText type="small" style={styles.errorText}>
          {error}
        </ThemedText>
      )}
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
  fieldGroup: {
    gap: Spacing.one,
  },
  flex1: {
    flex: 1,
  },
  chipRow: {
    flexDirection: 'row',
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
    marginRight: Spacing.two,
  },
  dateButton: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
  },
  calendar: {
    borderRadius: CardRadius,
    marginTop: Spacing.one,
  },
  timeRow: {
    flexDirection: 'row',
    gap: Spacing.three,
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
  previewCard: {
    borderRadius: CardRadius,
    padding: Spacing.four,
    gap: 2,
  },
  submitButton: {
    borderRadius: CardRadius,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#ffffff',
    fontWeight: '600',
  },
  deleteButton: {
    borderRadius: CardRadius,
    borderWidth: 1.5,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  emptyState: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
  },
  centerText: {
    textAlign: 'center',
  },
});

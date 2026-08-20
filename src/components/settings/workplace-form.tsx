import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Pressable, Switch, TextInput } from 'react-native';
import { z } from 'zod';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Workplace } from '@/db/schema';
import { useTheme } from '@/hooks/use-theme';
import { resolvePayPeriodsInRange } from '@/lib/pay-period';

import {
  addRoughDays,
  addRoughMonths,
  FieldLabel,
  formatDateOnly,
  parseDateOnly,
  PAY_CYCLE_LABELS,
  shortDate,
  styles,
  WAGE_TYPE_LABELS,
  WEEKDAY_LABELS,
} from './shared';

export const workplaceFormSchema = z
  .object({
    name: z.string().trim().min(1, '請輸入工作地點名稱'),
    wageType: z.enum(['monthly', 'daily', 'hourly']),
    monthlySalary: z.coerce.number().positive().optional(),
    onboardDate: z.date().optional(),
    isCurrentlyEmployed: z.boolean().optional(),
    endDate: z.string().optional(),
    defaultHourlyRate: z.coerce.number().positive().optional(),
    defaultDailyRate: z.coerce.number().positive().optional(),

    // 發薪設定,跟計薪方式(wageType)是兩件獨立的事,不分月薪/日薪/時薪都可以選填
    payCycle: z.enum(['monthly', 'weekly', 'daily']).nullable().optional(),
    paydayDayOfMonth: z.coerce.number().int().min(1).max(31).optional(),
    paydayWeekday: z.coerce.number().int().min(1).max(7).optional(),
    periodStartDayOfMonth: z.coerce.number().int().min(1).max(31).optional(),
    periodStartWeekday: z.coerce.number().int().min(1).max(7).optional(),
    periodEndDayOfMonth: z.coerce.number().int().min(1).max(31).optional(),
    periodEndIsEndOfMonth: z.boolean().optional(),
    periodEndWeekday: z.coerce.number().int().min(1).max(7).optional(),
  })
  .refine((values) => values.wageType !== 'monthly' || values.monthlySalary != null, {
    message: '請輸入月薪金額',
    path: ['monthlySalary'],
  });

export type WorkplaceFormValues = z.infer<typeof workplaceFormSchema>;

export function WorkplaceForm({
  initial,
  onSubmit,
  onCancel,
  onDelete,
}: {
  initial?: Workplace;
  onSubmit: (values: WorkplaceFormValues) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const theme = useTheme();
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof workplaceFormSchema>, any, WorkplaceFormValues>({
    resolver: zodResolver(workplaceFormSchema),
    defaultValues: initial
      ? {
          name: initial.name,
          wageType: initial.wageType as 'monthly' | 'daily' | 'hourly',
          monthlySalary: initial.monthlySalary ?? undefined,
          onboardDate: initial.onboardDate ? parseDateOnly(initial.onboardDate) : undefined,
          isCurrentlyEmployed: initial.isCurrentlyEmployed ?? true,
          endDate: initial.endDate ?? '',
          defaultHourlyRate: initial.defaultHourlyRate ?? undefined,
          defaultDailyRate: initial.defaultDailyRate ?? undefined,
          payCycle: (initial.payCycle as 'monthly' | 'weekly' | 'daily' | null) ?? undefined,
          paydayDayOfMonth: initial.paydayDayOfMonth ?? undefined,
          paydayWeekday: initial.paydayWeekday ?? undefined,
          periodStartDayOfMonth: initial.periodStartDayOfMonth ?? undefined,
          periodStartWeekday: initial.periodStartWeekday ?? undefined,
          periodEndDayOfMonth: initial.periodEndDayOfMonth ?? undefined,
          periodEndIsEndOfMonth: initial.periodEndIsEndOfMonth ?? undefined,
          periodEndWeekday: initial.periodEndWeekday ?? undefined,
        }
      : { name: '', wageType: 'hourly', isCurrentlyEmployed: true },
  });

  const wageType = watch('wageType');
  const isCurrentlyEmployed = watch('isCurrentlyEmployed');

  return (
    <>
      <ThemedView type="backgroundElement" style={styles.formHeader}>
        <Pressable onPress={onCancel}>
          <ThemedText style={{ color: theme.primary }}>取消</ThemedText>
        </Pressable>
        <ThemedText type="smallBold">{initial ? '編輯工作地點' : '新增工作地點'}</ThemedText>
        <Pressable onPress={handleSubmit(onSubmit)} disabled={isSubmitting}>
          <ThemedText style={{ color: theme.primary }}>儲存</ThemedText>
        </Pressable>
      </ThemedView>

      <FieldLabel label="工作地點名稱" error={errors.name?.message}>
        <Controller
          control={control}
          name="name"
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

      <FieldLabel label="計薪方式">
        {initial ? (
          <ThemedView style={styles.lockedField}>
            <ThemedText themeColor="textSecondary">{WAGE_TYPE_LABELS[wageType]}</ThemedText>
          </ThemedView>
        ) : (
          <Controller
            control={control}
            name="wageType"
            render={({ field }) => (
              <ThemedView style={styles.segmentedRow}>
                {(['monthly', 'daily', 'hourly'] as const).map((option) => {
                  const selected = field.value === option;
                  return (
                    <Pressable key={option} onPress={() => field.onChange(option)} style={styles.flex1}>
                      <ThemedView
                        style={[
                          styles.segmentedButton,
                          { backgroundColor: selected ? theme.primary : theme.backgroundElement },
                        ]}>
                        <ThemedText style={{ color: selected ? theme.onPrimary : theme.text }}>
                          {WAGE_TYPE_LABELS[option]}
                        </ThemedText>
                      </ThemedView>
                    </Pressable>
                  );
                })}
              </ThemedView>
            )}
          />
        )}
        <ThemedText type="small" themeColor="textSecondary">
          建立後無法變更,避免過去排班紀錄的金額被回溯改變
        </ThemedText>
      </FieldLabel>

      {wageType === 'monthly' ? (
        <>
          <FieldLabel label="月薪金額" error={errors.monthlySalary?.message}>
            <Controller
              control={control}
              name="monthlySalary"
              render={({ field }) => (
                <TextInput
                  value={field.value != null ? String(field.value) : ''}
                  onChangeText={field.onChange}
                  keyboardType="numeric"
                  placeholder="35000"
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                />
              )}
            />
          </FieldLabel>

          <FieldLabel label="起始日(選填)">
            <Controller
              control={control}
              name="onboardDate"
              render={({ field }) => (
                <DateTimePicker
                  testID="dateTimePicker"
                  value={field.value ?? new Date()}
                  mode="date"
                  onChange={(event, selectedDate) => {
                    if (event.type !== 'dismissed' && selectedDate) field.onChange(selectedDate);
                  }}
                />
              )}
            />
          </FieldLabel>

          <ThemedView type="backgroundElement" style={styles.switchRow}>
            <ThemedText>目前是否仍在職</ThemedText>
            <Controller
              control={control}
              name="isCurrentlyEmployed"
              render={({ field }) => (
                <Switch value={field.value ?? true} onValueChange={field.onChange} trackColor={{ true: theme.primary }} />
              )}
            />
          </ThemedView>

          {isCurrentlyEmployed === false && (
            <FieldLabel label="結束日(建議填)">
              <Controller
                control={control}
                name="endDate"
                render={({ field }) => (
                  <TextInput
                    value={field.value}
                    onChangeText={field.onChange}
                    placeholder="YYYY-MM-DD"
                    placeholderTextColor={theme.textSecondary}
                    style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                  />
                )}
              />
            </FieldLabel>
          )}
        </>
      ) : wageType === 'hourly' ? (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            這是預設時薪,同一份工作底下不同班別預設都用這個數字;個別班別時薪不一樣的話,可以在「排班」分頁裡針對那個班別覆蓋。
          </ThemedText>

          <FieldLabel label="預設時薪(選填)" error={errors.defaultHourlyRate?.message}>
            <Controller
              control={control}
              name="defaultHourlyRate"
              render={({ field }) => (
                <TextInput
                  value={field.value != null ? String(field.value) : ''}
                  onChangeText={field.onChange}
                  keyboardType="numeric"
                  placeholder="183"
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                />
              )}
            />
          </FieldLabel>
        </>
      ) : (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            這是預設日薪,同一份工作底下不同班別預設都用這個數字,不管實際工作多久;個別班別日薪不一樣的話,可以在「排班」分頁裡針對那個班別覆蓋。
          </ThemedText>

          <FieldLabel label="預設日薪(選填)" error={errors.defaultDailyRate?.message}>
            <Controller
              control={control}
              name="defaultDailyRate"
              render={({ field }) => (
                <TextInput
                  value={field.value != null ? String(field.value) : ''}
                  onChangeText={field.onChange}
                  keyboardType="numeric"
                  placeholder="1600"
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                />
              )}
            />
          </FieldLabel>
        </>
      )}

      <PaySettingsSection control={control} />

      {onDelete && (
        <Pressable onPress={onDelete}>
          <ThemedView style={[styles.deleteButton, { borderColor: theme.danger }]}>
            <ThemedText style={{ color: theme.danger }}>刪除這個工作地點</ThemedText>
          </ThemedView>
        </Pressable>
      )}
    </>
  );
}

function PaySettingsSection({ control }: { control: any }) {
  const theme = useTheme();
  const payCycle = useWatch({ control, name: 'payCycle' }) as 'monthly' | 'weekly' | 'daily' | null | undefined;
  const [expanded, setExpanded] = useState(!!payCycle);

  const paydayDayOfMonth = useWatch({ control, name: 'paydayDayOfMonth' });
  const paydayWeekday = useWatch({ control, name: 'paydayWeekday' });
  const periodStartDayOfMonth = useWatch({ control, name: 'periodStartDayOfMonth' });
  const periodStartWeekday = useWatch({ control, name: 'periodStartWeekday' });
  const periodEndDayOfMonth = useWatch({ control, name: 'periodEndDayOfMonth' });
  const periodEndIsEndOfMonth = useWatch({ control, name: 'periodEndIsEndOfMonth' });
  const periodEndWeekday = useWatch({ control, name: 'periodEndWeekday' });

  const preview = useMemo(() => {
    if (!payCycle || payCycle === 'daily') return null;
    if (payCycle === 'monthly' && (paydayDayOfMonth == null || periodStartDayOfMonth == null)) return null;
    if (payCycle === 'monthly' && !periodEndIsEndOfMonth && periodEndDayOfMonth == null) return null;
    if (payCycle === 'weekly' && (paydayWeekday == null || periodStartWeekday == null || periodEndWeekday == null))
      return null;

    const today = new Date();
    const scanEnd = payCycle === 'monthly' ? addRoughMonths(today, 3) : addRoughDays(today, 21);
    const entries = resolvePayPeriodsInRange(
      {
        payCycle,
        paydayDayOfMonth,
        paydayWeekday,
        periodStartDayOfMonth,
        periodStartWeekday,
        periodEndDayOfMonth,
        periodEndIsEndOfMonth,
        periodEndWeekday,
      },
      today,
      scanEnd,
    );
    const next = entries.find((entry) => entry.paydayDate >= formatDateOnly(today));
    if (!next) return null;
    return `下一次發薪日 ${shortDate(next.paydayDate)},對應計薪區間 ${shortDate(next.periodStart)}–${shortDate(next.periodEnd)}`;
  }, [
    payCycle,
    paydayDayOfMonth,
    paydayWeekday,
    periodStartDayOfMonth,
    periodStartWeekday,
    periodEndDayOfMonth,
    periodEndIsEndOfMonth,
    periodEndWeekday,
  ]);

  return (
    <ThemedView type="backgroundElement" style={styles.paySection}>
      <Pressable onPress={() => setExpanded((v) => !v)} style={styles.paySectionHeader}>
        <ThemedText type="smallBold">發薪設定(選填)</ThemedText>
        <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={18} color={theme.textSecondary} />
      </Pressable>

      {expanded && (
        <>
          <ThemedText type="small" themeColor="textSecondary">
            跟計薪方式是獨立的設定,填了才會出現在統計頁的「發薪日曆」裡。
          </ThemedText>

          <FieldLabel label="發薪頻率">
            <Controller
              control={control}
              name="payCycle"
              render={({ field }) => (
                <ThemedView style={styles.segmentedRow}>
                  {(['monthly', 'weekly', 'daily'] as const).map((option) => {
                    const selected = field.value === option;
                    return (
                      <Pressable
                        key={option}
                        onPress={() => field.onChange(selected ? null : option)}
                        style={styles.flex1}>
                        <ThemedView
                          style={[
                            styles.segmentedButton,
                            { backgroundColor: selected ? theme.primary : theme.backgroundElement },
                          ]}>
                          <ThemedText style={{ color: selected ? theme.onPrimary : theme.text }}>
                            {PAY_CYCLE_LABELS[option]}
                          </ThemedText>
                        </ThemedView>
                      </Pressable>
                    );
                  })}
                </ThemedView>
              )}
            />
          </FieldLabel>

          {payCycle === 'monthly' && (
            <>
              <FieldLabel label="發薪日(每月第幾天)">
                <Controller
                  control={control}
                  name="paydayDayOfMonth"
                  render={({ field }) => (
                    <TextInput
                      value={field.value != null ? String(field.value) : ''}
                      onChangeText={field.onChange}
                      keyboardType="numeric"
                      placeholder="25"
                      placeholderTextColor={theme.textSecondary}
                      style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                    />
                  )}
                />
                <ThemedText type="small" themeColor="textSecondary">
                  若當月沒有這一天,自動視為當月最後一天
                </ThemedText>
              </FieldLabel>

              <FieldLabel label="計薪起始日(每月第幾天)">
                <Controller
                  control={control}
                  name="periodStartDayOfMonth"
                  render={({ field }) => (
                    <TextInput
                      value={field.value != null ? String(field.value) : ''}
                      onChangeText={field.onChange}
                      keyboardType="numeric"
                      placeholder="1"
                      placeholderTextColor={theme.textSecondary}
                      style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                    />
                  )}
                />
                <ThemedText type="small" themeColor="textSecondary">
                  若當月沒有這一天,自動視為當月最後一天
                </ThemedText>
              </FieldLabel>

              <ThemedView type="backgroundElement" style={styles.switchRow}>
                <ThemedText>計薪結束日=月底</ThemedText>
                <Controller
                  control={control}
                  name="periodEndIsEndOfMonth"
                  render={({ field }) => (
                    <Switch value={field.value ?? false} onValueChange={field.onChange} trackColor={{ true: theme.primary }} />
                  )}
                />
              </ThemedView>

              {!periodEndIsEndOfMonth && (
                <FieldLabel label="計薪結束日(每月第幾天)">
                  <Controller
                    control={control}
                    name="periodEndDayOfMonth"
                    render={({ field }) => (
                      <TextInput
                        value={field.value != null ? String(field.value) : ''}
                        onChangeText={field.onChange}
                        keyboardType="numeric"
                        placeholder="31"
                        placeholderTextColor={theme.textSecondary}
                        style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                      />
                    )}
                  />
                  <ThemedText type="small" themeColor="textSecondary">
                    若當月沒有這一天,自動視為當月最後一天
                  </ThemedText>
                </FieldLabel>
              )}
            </>
          )}

          {payCycle === 'weekly' && (
            <>
              <WeekdayField label="發薪星期" name="paydayWeekday" control={control} />
              <WeekdayField label="計薪起始星期" name="periodStartWeekday" control={control} />
              <WeekdayField label="計薪結束星期" name="periodEndWeekday" control={control} />
            </>
          )}

          {preview && (
            <ThemedView style={[styles.previewBox, { backgroundColor: theme.primarySoft }]}>
              <ThemedText type="small" style={{ color: theme.primary }}>
                {preview}
              </ThemedText>
            </ThemedView>
          )}
        </>
      )}
    </ThemedView>
  );
}

function WeekdayField({
  label,
  name,
  control,
}: {
  label: string;
  name: 'paydayWeekday' | 'periodStartWeekday' | 'periodEndWeekday';
  control: any;
}) {
  const theme = useTheme();
  return (
    <FieldLabel label={label}>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <ThemedView style={styles.weekdayRow}>
            {WEEKDAY_LABELS.map((weekdayLabel, index) => {
              const value = index + 1;
              const selected = field.value === value;
              return (
                <Pressable key={value} onPress={() => field.onChange(value)} style={styles.weekdayChipPressable}>
                  <ThemedView
                    style={[
                      styles.weekdayChip,
                      { backgroundColor: selected ? theme.primary : theme.backgroundElement },
                    ]}>
                    <ThemedText type="small" style={{ color: selected ? theme.onPrimary : theme.text }}>
                      {weekdayLabel}
                    </ThemedText>
                  </ThemedView>
                </Pressable>
              );
            })}
          </ThemedView>
        )}
      />
    </FieldLabel>
  );
}

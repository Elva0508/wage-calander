import { zodResolver } from '@hookform/resolvers/zod';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Controller, useForm } from 'react-hook-form';
import { Pressable, Switch, TextInput } from 'react-native';
import { z } from 'zod';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ShiftType, Workplace } from '@/db/schema';
import { useTheme } from '@/hooks/use-theme';

import { FieldLabel, formatTimeOnly, parseTimeOnly, styles, SwitchRow, timeRegex } from './shared';

export const shiftTypeFormShape = z.object({
  name: z.string().trim().min(1, '請輸入班別名稱'),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  useDefaultRate: z.boolean(),
  hourlyRate: z.coerce.number().positive().optional(),
  dailyRate: z.coerce.number().positive().optional(),
  breakMinutes: z.coerce.number().min(0).optional(),
  breakPaid: z.boolean(),
  nightRateEnabled: z.boolean(),
  nightMultiplier: z.coerce.number().positive().optional(),
  nightStart: z.string().optional(),
  nightEnd: z.string().optional(),
  holidayRateEnabled: z.boolean(),
  holidayPercent: z.coerce.number().positive().optional(),
});

/**
 * 起訖時間不管綁定哪種計薪方式都一律必填。薪率要不要求則看計薪方式:
 * 月薪完全不需要薪率欄位;日薪/時薪則是「有開套用預設薪資」就不用填,沒開才要填自己的覆蓋值。
 */
export function buildShiftTypeFormSchema(wageType: 'monthly' | 'daily' | 'hourly') {
  const withTimeRequired = shiftTypeFormShape
    .refine((v) => v.startTime && timeRegex.test(v.startTime), { message: '格式需為 HH:mm', path: ['startTime'] })
    .refine((v) => v.endTime && timeRegex.test(v.endTime), { message: '格式需為 HH:mm', path: ['endTime'] });

  if (wageType === 'monthly') return withTimeRequired;

  if (wageType === 'daily') {
    return withTimeRequired.refine((v) => v.useDefaultRate || v.dailyRate != null, {
      message: '請輸入日薪金額,或開啟「套用工作預設薪資」',
      path: ['dailyRate'],
    });
  }

  return withTimeRequired.refine((v) => v.useDefaultRate || v.hourlyRate != null, {
    message: '請輸入時薪,或開啟「套用工作預設薪資」',
    path: ['hourlyRate'],
  });
}

export type ShiftTypeFormValues = z.infer<typeof shiftTypeFormShape>;

export const emptyShiftTypeValues: ShiftTypeFormValues = {
  name: '',
  startTime: '',
  endTime: '',
  useDefaultRate: true,
  breakMinutes: 0,
  breakPaid: false,
  nightRateEnabled: false,
  nightMultiplier: 1.34,
  nightStart: '22:00',
  nightEnd: '06:00',
  holidayRateEnabled: false,
  holidayPercent: 33,
};

export function ShiftTypeForm({
  workplace,
  initial,
  onSubmit,
  onCancel,
  onDelete,
}: {
  workplace: Workplace;
  initial?: ShiftType;
  onSubmit: (values: ShiftTypeFormValues) => Promise<void>;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const theme = useTheme();
  const isMonthly = workplace.wageType === 'monthly';
  const isDaily = workplace.wageType === 'daily';
  const isHourly = workplace.wageType === 'hourly';
  const {
    control,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<z.input<typeof shiftTypeFormShape>, any, ShiftTypeFormValues>({
    resolver: zodResolver(buildShiftTypeFormSchema(workplace.wageType as 'monthly' | 'daily' | 'hourly')),
    defaultValues: initial
      ? {
          name: initial.name,
          startTime: initial.startTime ?? '',
          endTime: initial.endTime ?? '',
          useDefaultRate: initial.hourlyRate == null && initial.dailyRate == null,
          hourlyRate: initial.hourlyRate ?? undefined,
          dailyRate: initial.dailyRate ?? undefined,
          breakMinutes: initial.breakMinutes ?? 0,
          breakPaid: initial.breakPaid ?? false,
          nightRateEnabled: initial.nightRateEnabled,
          nightMultiplier: initial.nightMultiplier ?? emptyShiftTypeValues.nightMultiplier,
          nightStart: initial.nightStart ?? emptyShiftTypeValues.nightStart,
          nightEnd: initial.nightEnd ?? emptyShiftTypeValues.nightEnd,
          holidayRateEnabled: initial.holidayRateEnabled,
          holidayPercent: initial.holidayPercent ?? emptyShiftTypeValues.holidayPercent,
        }
      : emptyShiftTypeValues,
  });

  const useDefaultRate = watch('useDefaultRate');
  const nightEnabled = watch('nightRateEnabled');
  const holidayEnabled = watch('holidayRateEnabled');

  return (
    <>
      <ThemedView type="backgroundElement" style={styles.formHeader}>
        <Pressable onPress={onCancel}>
          <ThemedText style={{ color: theme.primary }}>取消</ThemedText>
        </Pressable>
        <ThemedText type="smallBold">{initial ? '編輯班別' : '新增班別'}</ThemedText>
        <Pressable onPress={handleSubmit(onSubmit)} disabled={isSubmitting}>
          <ThemedText style={{ color: theme.primary }}>儲存</ThemedText>
        </Pressable>
      </ThemedView>

      <FieldLabel label="所屬工作地點">
        <ThemedView style={styles.lockedField}>
          <ThemedText themeColor="textSecondary">{workplace.name}</ThemedText>
        </ThemedView>
      </FieldLabel>

      <FieldLabel label="班別名稱" error={errors.name?.message}>
        <Controller
          control={control}
          name="name"
          render={({ field }) => (
            <TextInput
              value={field.value}
              onChangeText={field.onChange}
              placeholder="例如:早班"
              placeholderTextColor={theme.textSecondary}
              style={[styles.input, { color: theme.text, borderColor: theme.border }]}
            />
          )}
        />
      </FieldLabel>

      <ThemedView type="backgroundElement" style={styles.timeRow}>
        <FieldLabel label="開始時間" error={errors.startTime?.message} flex>
          <Controller
            control={control}
            name="startTime"
            render={({ field }) => (
              <DateTimePicker
                testID="startTimePicker"
                value={field.value ? parseTimeOnly(field.value) : new Date()}
                mode="time"
                is24Hour
                onChange={(event, selectedDate) => {
                  if (event.type !== 'dismissed' && selectedDate) field.onChange(formatTimeOnly(selectedDate));
                }}
              />
            )}
          />
        </FieldLabel>
        <FieldLabel label="結束時間" error={errors.endTime?.message} flex>
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
        </FieldLabel>
      </ThemedView>
      {isDaily && (
        <ThemedText type="small" themeColor="textSecondary">
          日薪固定領一筆金額,起訖時間只是記錄用,不影響金額
        </ThemedText>
      )}

      {isMonthly ? (
        <ThemedText themeColor="textSecondary">
          月薪工作地點的班別只用來記出勤工時,不會另外計算逐班金額。
        </ThemedText>
      ) : (
        <>
          <ThemedView type="backgroundElement" style={styles.switchRow}>
            <ThemedText>套用工作預設薪資</ThemedText>
            <Controller
              control={control}
              name="useDefaultRate"
              render={({ field }) => (
                <Switch value={field.value} onValueChange={field.onChange} trackColor={{ true: theme.primary }} />
              )}
            />
          </ThemedView>

          {useDefaultRate ? (
            <ThemedText type="small" themeColor="textSecondary">
              套用工作預設的{isDaily ? '日薪' : '時薪'}:$
              {(isDaily ? workplace.defaultDailyRate : workplace.defaultHourlyRate)?.toLocaleString() ??
                '尚未在工作設定填寫,請先去補上或在這裡覆蓋'}
            </ThemedText>
          ) : isDaily ? (
            <FieldLabel label="這個班別的日薪金額(覆蓋預設值)" error={errors.dailyRate?.message}>
              <Controller
                control={control}
                name="dailyRate"
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
          ) : (
            <FieldLabel label="這個班別的時薪(覆蓋預設值)" error={errors.hourlyRate?.message}>
              <Controller
                control={control}
                name="hourlyRate"
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
          )}
        </>
      )}

      {isHourly && (
        <>
          <ThemedView type="backgroundElement" style={styles.timeRow}>
            <FieldLabel label="休息時間(分鐘)" flex>
              <Controller
                control={control}
                name="breakMinutes"
                render={({ field }) => (
                  <TextInput
                    value={field.value != null ? String(field.value) : ''}
                    onChangeText={field.onChange}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={theme.textSecondary}
                    style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                  />
                )}
              />
            </FieldLabel>
            <ThemedView style={[styles.switchRow, styles.flex1]}>
              <ThemedText type="small" themeColor="textSecondary">
                休息時間計薪
              </ThemedText>
              <Controller
                control={control}
                name="breakPaid"
                render={({ field }) => (
                  <Switch value={field.value} onValueChange={field.onChange} trackColor={{ true: theme.primary }} />
                )}
              />
            </ThemedView>
          </ThemedView>

          <SwitchRow label="深夜加給" name="nightRateEnabled" control={control} />
          <ThemedView style={[styles.subFields, !nightEnabled && styles.disabledSection]}>
            <FieldLabel label="深夜倍率">
              <Controller
                control={control}
                name="nightMultiplier"
                render={({ field }) => (
                  <TextInput
                    editable={nightEnabled}
                    value={field.value != null ? String(field.value) : ''}
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
              <FieldLabel label="開始時段" flex>
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
              <FieldLabel label="結束時段" flex>
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
            <FieldLabel label="假日加成百分比">
              <Controller
                control={control}
                name="holidayPercent"
                render={({ field }) => (
                  <TextInput
                    editable={holidayEnabled}
                    value={field.value != null ? String(field.value) : ''}
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
        </>
      )}

      {onDelete && (
        <Pressable onPress={onDelete}>
          <ThemedView style={[styles.deleteButton, { borderColor: theme.danger }]}>
            <ThemedText style={{ color: theme.danger }}>刪除這個班別</ThemedText>
          </ThemedView>
        </Pressable>
      )}
    </>
  );
}

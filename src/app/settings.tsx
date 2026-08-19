import { Ionicons } from '@expo/vector-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { useMemo, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Alert, Pressable, ScrollView, StyleSheet, Switch, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { z } from 'zod';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { BottomTabInset, CardRadius, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { ShiftType, Workplace } from '@/db/schema';
import { resolvePayPeriodsInRange } from '@/lib/pay-period';
import { useDataStore } from '@/store/data-store';

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

const WAGE_TYPE_LABELS: Record<'monthly' | 'daily' | 'hourly', string> = {
  monthly: '月薪',
  daily: '日薪',
  hourly: '時薪',
};

const PAY_CYCLE_LABELS: Record<'monthly' | 'weekly' | 'daily', string> = {
  monthly: '月結',
  weekly: '週結',
  daily: '日結',
};

const WEEKDAY_LABELS = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'];

export default function SettingsScreen() {
  const [view, setView] = useState<'root' | 'hub'>('root');

  if (view === 'hub') {
    return <WorkplaceHub onBack={() => setView('root')} />;
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
          <ThemedText type="subtitle">設定</ThemedText>
          <Pressable onPress={() => setView('hub')}>
            <ThemedView type="backgroundElement" style={styles.rootMenuCard}>
              <ThemedText type="smallBold">工作設定</ThemedText>
              <Ionicons name="chevron-forward" size={18} color="#60646C" />
            </ThemedView>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

// ---------------------------------------------------------------------------
// 工作主頁(上方 pill 子分頁:工作 / 排班)
// ---------------------------------------------------------------------------

function WorkplaceHub({ onBack }: { onBack: () => void }) {
  const theme = useTheme();
  const [activeTab, setActiveTab] = useState<'workplace' | 'shiftType'>('workplace');

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.hubHeader}>
          <Pressable onPress={onBack} hitSlop={12} style={styles.backPressable}>
            <ThemedView style={styles.backRow}>
              <Ionicons name="chevron-back" size={22} color={theme.primary} />
              <ThemedText style={{ color: theme.primary }}>設定</ThemedText>
            </ThemedView>
          </Pressable>
          <ThemedText type="smallBold">工作設定</ThemedText>
          <ThemedView style={styles.headerSpacer} />
        </ThemedView>

        <ThemedView style={styles.subTabRow}>
          <SubTabButton label="工作" active={activeTab === 'workplace'} onPress={() => setActiveTab('workplace')} />
          <SubTabButton label="排班" active={activeTab === 'shiftType'} onPress={() => setActiveTab('shiftType')} />
        </ThemedView>

        {activeTab === 'workplace' ? <WorkplaceSettings /> : <ShiftTypeSettings />}
      </SafeAreaView>
    </ThemedView>
  );
}

function SubTabButton({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} style={styles.subTabButtonPressable}>
      <ThemedView type={active ? 'backgroundSelected' : 'backgroundElement'} style={styles.subTabButton}>
        <ThemedText themeColor={active ? 'text' : 'textSecondary'} style={active ? { color: theme.primary } : undefined}>
          {label}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// 工作(子分頁)
// ---------------------------------------------------------------------------

const workplaceFormSchema = z
  .object({
    name: z.string().trim().min(1, '請輸入工作地點名稱'),
    wageType: z.enum(['monthly', 'daily', 'hourly']),
    monthlySalary: z.coerce.number().positive().optional(),
    onboardDate: z.string().optional(),
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

type WorkplaceFormValues = z.infer<typeof workplaceFormSchema>;

function WorkplaceSettings() {
  const theme = useTheme();
  const workplaces = useDataStore((state) => state.workplaces);
  const addWorkplace = useDataStore((state) => state.addWorkplace);
  const updateWorkplace = useDataStore((state) => state.updateWorkplace);
  const deleteWorkplace = useDataStore((state) => state.deleteWorkplace);
  const [editingId, setEditingId] = useState<number | 'new' | null>(null);

  const editing = useMemo(
    () => (typeof editingId === 'number' ? workplaces.find((w) => w.id === editingId) : undefined),
    [editingId, workplaces],
  );

  if (editingId !== null) {
    return (
      <WorkplaceForm
        key={editingId}
        initial={editing}
        onCancel={() => setEditingId(null)}
        onSubmit={async (values) => {
          if (typeof editingId === 'number') {
            await updateWorkplace(editingId, values);
          } else {
            await addWorkplace(values);
          }
          setEditingId(null);
        }}
        onDelete={
          typeof editingId === 'number'
            ? () => {
                Alert.alert('刪除工作地點', '確定要刪除這個工作地點嗎?此動作無法復原。', [
                  { text: '取消', style: 'cancel' },
                  {
                    text: '刪除',
                    style: 'destructive',
                    onPress: async () => {
                      await deleteWorkplace(editingId);
                      setEditingId(null);
                    },
                  },
                ]);
              }
            : undefined
        }
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {workplaces.length === 0 ? (
        <ThemedText themeColor="textSecondary">還沒有任何工作地點,點下方「新增工作地點」開始設定。</ThemedText>
      ) : (
        workplaces.map((wp) => (
          <Pressable key={wp.id} onPress={() => setEditingId(wp.id)}>
            <ThemedView type="backgroundElement" style={styles.card}>
              <ThemedView type="backgroundElement" style={styles.cardHeader}>
                <ThemedText type="smallBold">{wp.name}</ThemedText>
                <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
              </ThemedView>
              <ThemedText themeColor="textSecondary">
                {wp.wageType === 'monthly'
                  ? `月薪 $${wp.monthlySalary?.toLocaleString() ?? '未設定'}`
                  : wp.wageType === 'daily'
                    ? `日薪 $${wp.defaultDailyRate?.toLocaleString() ?? '未設定'}`
                    : `時薪 $${wp.defaultHourlyRate?.toLocaleString() ?? '未設定'}`}
              </ThemedText>
            </ThemedView>
          </Pressable>
        ))
      )}

      <Pressable onPress={() => setEditingId('new')}>
        <ThemedView style={[styles.addButton, { borderColor: theme.primary }]}>
          <Ionicons name="add" size={18} color={theme.primary} />
          <ThemedText style={{ color: theme.primary }}>新增工作地點</ThemedText>
        </ThemedView>
      </Pressable>
    </ScrollView>
  );
}

function WorkplaceForm({
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
          onboardDate: initial.onboardDate ?? '',
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
    <ScrollView contentContainerStyle={styles.scrollContent}>
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
                        <ThemedText style={{ color: selected ? '#ffffff' : theme.text }}>
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
    </ScrollView>
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
                          <ThemedText style={{ color: selected ? '#ffffff' : theme.text }}>
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
                    <ThemedText type="small" style={{ color: selected ? '#ffffff' : theme.text }}>
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

function formatDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function shortDate(dateStr: string): string {
  const [, month, day] = dateStr.split('-');
  return `${Number(month)}/${Number(day)}`;
}

function addRoughMonths(date: Date, months: number): Date {
  return new Date(date.getFullYear(), date.getMonth() + months, date.getDate());
}

function addRoughDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

// ---------------------------------------------------------------------------
// 排班(子分頁)
// ---------------------------------------------------------------------------

const shiftTypeFormShape = z.object({
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
function buildShiftTypeFormSchema(wageType: 'monthly' | 'daily' | 'hourly') {
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

type ShiftTypeFormValues = z.infer<typeof shiftTypeFormShape>;

const emptyShiftTypeValues: ShiftTypeFormValues = {
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

function ShiftTypeSettings() {
  const theme = useTheme();
  const shiftTypes = useDataStore((state) => state.shiftTypes);
  const workplaces = useDataStore((state) => state.workplaces);
  const addShiftType = useDataStore((state) => state.addShiftType);
  const updateShiftType = useDataStore((state) => state.updateShiftType);
  const deleteShiftType = useDataStore((state) => state.deleteShiftType);
  const [editing, setEditing] = useState<{ mode: 'new'; workplaceId: number } | { mode: 'edit'; id: number } | null>(
    null,
  );

  const shiftTypesByWorkplace = useMemo(() => {
    const groups = new Map<number, ShiftType[]>();
    for (const st of shiftTypes) {
      const list = groups.get(st.workplaceId) ?? [];
      list.push(st);
      groups.set(st.workplaceId, list);
    }
    return workplaces.map((wp) => ({ workplace: wp, shiftTypes: groups.get(wp.id) ?? [] }));
  }, [shiftTypes, workplaces]);

  if (workplaces.length === 0) {
    return (
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <ThemedText themeColor="textSecondary">請先到「工作」分頁新增至少一個工作地點,才能新增班別。</ThemedText>
      </ScrollView>
    );
  }

  if (editing) {
    const workplace = workplaces.find(
      (wp) => wp.id === (editing.mode === 'new' ? editing.workplaceId : shiftTypes.find((st) => st.id === editing.id)?.workplaceId),
    );
    const editingShiftType = editing.mode === 'edit' ? shiftTypes.find((st) => st.id === editing.id) : undefined;
    if (!workplace) {
      setEditing(null);
      return null;
    }
    return (
      <ShiftTypeForm
        key={editing.mode === 'new' ? `new-${editing.workplaceId}` : editing.id}
        workplace={workplace}
        initial={editingShiftType}
        onCancel={() => setEditing(null)}
        onSubmit={async (values) => {
          const isHourly = workplace.wageType === 'hourly';
          const isDaily = workplace.wageType === 'daily';
          const payload = {
            name: values.name,
            startTime: values.startTime || '',
            endTime: values.endTime || '',
            hourlyRate: isHourly && !values.useDefaultRate ? values.hourlyRate ?? null : null,
            dailyRate: isDaily && !values.useDefaultRate ? values.dailyRate ?? null : null,
            breakMinutes: isHourly ? values.breakMinutes ?? null : null,
            breakPaid: isHourly ? values.breakPaid : null,
            nightRateEnabled: isHourly && values.nightRateEnabled,
            nightMultiplier: isHourly && values.nightRateEnabled ? values.nightMultiplier ?? null : null,
            nightStart: isHourly && values.nightRateEnabled ? values.nightStart ?? null : null,
            nightEnd: isHourly && values.nightRateEnabled ? values.nightEnd ?? null : null,
            holidayRateEnabled: isHourly && values.holidayRateEnabled,
            holidayPercent: isHourly && values.holidayRateEnabled ? values.holidayPercent ?? null : null,
          };
          if (editing.mode === 'edit') {
            await updateShiftType(editing.id, payload);
          } else {
            await addShiftType({ ...payload, workplaceId: editing.workplaceId });
          }
          setEditing(null);
        }}
        onDelete={
          editing.mode === 'edit'
            ? () => {
                Alert.alert('刪除班別', '確定要刪除這個班別嗎?此動作無法復原。', [
                  { text: '取消', style: 'cancel' },
                  {
                    text: '刪除',
                    style: 'destructive',
                    onPress: async () => {
                      if (editing.mode === 'edit') await deleteShiftType(editing.id);
                      setEditing(null);
                    },
                  },
                ]);
              }
            : undefined
        }
      />
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      {shiftTypesByWorkplace.map(({ workplace, shiftTypes: list }) => (
        <ThemedView key={workplace.id} style={styles.shiftTypeGroup}>
          <ThemedText type="smallBold">{workplace.name}</ThemedText>

          {list.map((st) => (
            <Pressable key={st.id} onPress={() => setEditing({ mode: 'edit', id: st.id })}>
              <ThemedView type="backgroundElement" style={styles.card}>
                <ThemedView type="backgroundElement" style={styles.cardHeader}>
                  <ThemedText type="smallBold">{st.name}</ThemedText>
                  <Ionicons name="chevron-forward" size={18} color={theme.textSecondary} />
                </ThemedView>
                <ThemedText themeColor="textSecondary">
                  {st.startTime}–{st.endTime}
                </ThemedText>
              </ThemedView>
            </Pressable>
          ))}

          <Pressable onPress={() => setEditing({ mode: 'new', workplaceId: workplace.id })}>
            <ThemedView style={[styles.addButton, { borderColor: theme.primary }]}>
              <Ionicons name="add" size={18} color={theme.primary} />
              <ThemedText style={{ color: theme.primary }}>新增班別</ThemedText>
            </ThemedView>
          </Pressable>
        </ThemedView>
      ))}
    </ScrollView>
  );
}

function ShiftTypeForm({
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
    <ScrollView contentContainerStyle={styles.scrollContent}>
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
              <TextInput
                value={field.value}
                onChangeText={field.onChange}
                placeholder="09:00"
                placeholderTextColor={theme.textSecondary}
                style={[styles.input, { color: theme.text, borderColor: theme.border }]}
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
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// 共用小元件
// ---------------------------------------------------------------------------

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
        <ThemedText type="small" style={styles.errorText}>
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
          <Switch value={field.value} onValueChange={field.onChange} trackColor={{ true: theme.primary }} />
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
    paddingTop: Spacing.three,
    paddingBottom: BottomTabInset + Spacing.five,
    gap: Spacing.three,
  },
  rootMenuCard: {
    borderRadius: CardRadius,
    padding: Spacing.four,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  hubHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
  },
  backPressable: {
    minHeight: 44,
    justifyContent: 'center',
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.half,
    paddingVertical: Spacing.two,
    paddingRight: Spacing.two,
  },
  headerSpacer: {
    width: 60,
  },
  subTabRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
  },
  subTabButtonPressable: {
    flex: 1,
  },
  subTabButton: {
    borderRadius: Spacing.five,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
  card: {
    borderRadius: CardRadius,
    padding: Spacing.four,
    gap: Spacing.one,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  shiftTypeGroup: {
    gap: Spacing.two,
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
  lockedField: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.three,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  segmentedRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  segmentedButton: {
    borderRadius: Spacing.three,
    paddingVertical: Spacing.two,
    alignItems: 'center',
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
  deleteButton: {
    borderRadius: CardRadius,
    borderWidth: 1.5,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  paySection: {
    borderRadius: CardRadius,
    padding: Spacing.four,
    gap: Spacing.three,
  },
  paySectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  previewBox: {
    borderRadius: Spacing.three,
    padding: Spacing.three,
  },
  weekdayRow: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  weekdayChipPressable: {
    flex: 1,
  },
  weekdayChip: {
    borderRadius: Spacing.two,
    paddingVertical: Spacing.two,
    alignItems: 'center',
  },
});

import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, TextInput } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, MaxContentWidth, Spacing } from '@/constants/theme';
import { ShiftType } from '@/db/schema';
import { useTheme } from '@/hooks/use-theme';
import { calculateShiftHours, calculateShiftWage, WageCalcInput } from '@/lib/wage';
import { useDataStore } from '@/store/data-store';
import { useUiStore } from '@/store/ui-store';

const timeRegex = /^([01]\d|2[0-3]):[0-5]\d$/;

type ManualFormState = {
  workplaceId: number | null;
  startTime: string;
  endTime: string;
  note: string;
  baseRate: string;
  breakMinutes: string;
  breakPaid: boolean;
  nightRateEnabled: boolean;
  nightMultiplier: string;
  nightStart: string;
  nightEnd: string;
  holidayRateEnabled: boolean;
  holidayPercent: string;
  isHoliday: boolean;
  manualWageOverride: string;
};

const emptyManualForm: ManualFormState = {
  workplaceId: null,
  startTime: '',
  endTime: '',
  note: '',
  baseRate: '',
  breakMinutes: '',
  breakPaid: false,
  nightRateEnabled: false,
  nightMultiplier: '1.34',
  nightStart: '22:00',
  nightEnd: '06:00',
  holidayRateEnabled: false,
  holidayPercent: '33',
  isHoliday: false,
  manualWageOverride: '',
};

type ShiftTypeFormState = {
  workplaceId: number | null;
  name: string;
  startTime: string;
  endTime: string;
  hourlyRate: string;
  dailyRate: string;
  breakMinutes: string;
  breakPaid: boolean;
  nightRateEnabled: boolean;
  nightMultiplier: string;
  nightStart: string;
  nightEnd: string;
  holidayRateEnabled: boolean;
  holidayPercent: string;
};

const emptyShiftTypeForm: ShiftTypeFormState = {
  workplaceId: null,
  name: '',
  startTime: '',
  endTime: '',
  hourlyRate: '',
  dailyRate: '',
  breakMinutes: '',
  breakPaid: false,
  nightRateEnabled: false,
  nightMultiplier: '1.34',
  nightStart: '22:00',
  nightEnd: '06:00',
  holidayRateEnabled: false,
  holidayPercent: '33',
};

/**
 * 排班狀態的常駐半截 sheet——不可透過點背景或下滑關閉,只能點「退出」離開排班狀態。
 * 選班別/手動輸入/標記休息日之後都會自動把目標日期跳到下一天,方便連續排一整個月。
 */
export function SchedulingSheet() {
  const theme = useTheme();
  const schedulingDate = useUiStore((s) => s.schedulingDate);
  const exitSchedulingMode = useUiStore((s) => s.exitSchedulingMode);
  const advanceSchedulingDate = useUiStore((s) => s.advanceSchedulingDate);

  const shiftTypes = useDataStore((s) => s.shiftTypes);
  const workplaces = useDataStore((s) => s.workplaces);
  const addShift = useDataStore((s) => s.addShift);
  const addShiftType = useDataStore((s) => s.addShiftType);

  const [panel, setPanel] = useState<'list' | 'manual' | 'newShiftType'>('list');
  const [manualForm, setManualForm] = useState<ManualFormState>(emptyManualForm);
  const [shiftTypeForm, setShiftTypeForm] = useState<ShiftTypeFormState>(emptyShiftTypeForm);

  const shiftTypesByWorkplace = useMemo(() => {
    const groups = new Map<number, typeof shiftTypes>();
    for (const st of shiftTypes) {
      const list = groups.get(st.workplaceId) ?? [];
      list.push(st);
      groups.set(st.workplaceId, list);
    }
    return Array.from(groups.entries()).map(([workplaceId, list]) => ({
      workplace: workplaces.find((w) => w.id === workplaceId),
      shiftTypes: list,
    }));
  }, [shiftTypes, workplaces]);

  const manualPreview = useMemo(() => {
    if (!timeRegex.test(manualForm.startTime) || !timeRegex.test(manualForm.endTime)) return null;
    const baseRate = Number(manualForm.baseRate);
    if (!baseRate) return null;
    const input: WageCalcInput = {
      startTime: manualForm.startTime,
      endTime: manualForm.endTime,
      baseRate,
      breakMinutes: manualForm.breakMinutes ? Number(manualForm.breakMinutes) : null,
      breakPaid: manualForm.breakPaid,
      nightRateEnabled: manualForm.nightRateEnabled,
      nightMultiplier: manualForm.nightRateEnabled ? Number(manualForm.nightMultiplier) : null,
      nightStart: manualForm.nightRateEnabled ? manualForm.nightStart : null,
      nightEnd: manualForm.nightRateEnabled ? manualForm.nightEnd : null,
      holidayRateEnabled: manualForm.holidayRateEnabled,
      holidayPercent: manualForm.holidayRateEnabled ? Number(manualForm.holidayPercent) : null,
      isHoliday: manualForm.isHoliday,
      manualWageOverride: manualForm.manualWageOverride ? Number(manualForm.manualWageOverride) : null,
    };
    return { hours: calculateShiftHours(input, input), pay: calculateShiftWage(input) };
  }, [manualForm]);

  const onPickShiftType = async (shiftType: ShiftType) => {
    await addShift({
      date: schedulingDate,
      startTime: shiftType.startTime,
      endTime: shiftType.endTime,
      shiftTypeId: shiftType.id,
      isHoliday: false,
      isRestDay: false,
      note: null,
    });
    advanceSchedulingDate();
  };

  const onMarkRestDay = async () => {
    await addShift({
      date: schedulingDate,
      startTime: null,
      endTime: null,
      shiftTypeId: null,
      isHoliday: false,
      isRestDay: true,
      note: null,
    });
    advanceSchedulingDate();
  };

  const onSubmitManual = async () => {
    await addShift({
      date: schedulingDate,
      startTime: manualForm.startTime,
      endTime: manualForm.endTime,
      note: manualForm.note || null,
      shiftTypeId: null,
      isHoliday: manualForm.isHoliday,
      isRestDay: false,
      manualWageOverride: manualForm.manualWageOverride ? Number(manualForm.manualWageOverride) : null,
      workplaceId: manualForm.workplaceId,
      baseRate: Number(manualForm.baseRate) || 0,
      breakMinutes: manualForm.breakMinutes ? Number(manualForm.breakMinutes) : null,
      breakPaid: manualForm.breakPaid,
      nightRateEnabled: manualForm.nightRateEnabled,
      nightMultiplier: manualForm.nightRateEnabled ? Number(manualForm.nightMultiplier) : null,
      nightStart: manualForm.nightRateEnabled ? manualForm.nightStart : null,
      nightEnd: manualForm.nightRateEnabled ? manualForm.nightEnd : null,
      holidayRateEnabled: manualForm.holidayRateEnabled,
      holidayPercent: manualForm.holidayRateEnabled ? Number(manualForm.holidayPercent) : null,
    });
    advanceSchedulingDate();
    setManualForm(emptyManualForm);
    setPanel('list');
  };

  const newShiftTypeWorkplace = workplaces.find((wp) => wp.id === shiftTypeForm.workplaceId);
  const newShiftTypeWageType = newShiftTypeWorkplace?.wageType;
  const newShiftTypeIsMonthly = newShiftTypeWageType === 'monthly';
  const newShiftTypeIsDaily = newShiftTypeWageType === 'daily';
  const newShiftTypeIsHourly = newShiftTypeWageType === 'hourly';

  const onSubmitNewShiftType = async () => {
    if (shiftTypeForm.workplaceId == null) return;
    await addShiftType({
      workplaceId: shiftTypeForm.workplaceId,
      name: shiftTypeForm.name,
      startTime: shiftTypeForm.startTime,
      endTime: shiftTypeForm.endTime,
      // 留空就存 null,計薪時會自動 fallback 用工作地點的預設時薪/日薪,不用在這裡強制填
      hourlyRate: newShiftTypeIsHourly && shiftTypeForm.hourlyRate ? Number(shiftTypeForm.hourlyRate) : null,
      dailyRate: newShiftTypeIsDaily && shiftTypeForm.dailyRate ? Number(shiftTypeForm.dailyRate) : null,
      breakMinutes: newShiftTypeIsHourly && shiftTypeForm.breakMinutes ? Number(shiftTypeForm.breakMinutes) : null,
      breakPaid: newShiftTypeIsHourly ? shiftTypeForm.breakPaid : null,
      nightRateEnabled: newShiftTypeIsHourly && shiftTypeForm.nightRateEnabled,
      nightMultiplier: newShiftTypeIsHourly && shiftTypeForm.nightRateEnabled ? Number(shiftTypeForm.nightMultiplier) : null,
      nightStart: newShiftTypeIsHourly && shiftTypeForm.nightRateEnabled ? shiftTypeForm.nightStart : null,
      nightEnd: newShiftTypeIsHourly && shiftTypeForm.nightRateEnabled ? shiftTypeForm.nightEnd : null,
      holidayRateEnabled: newShiftTypeIsHourly && shiftTypeForm.holidayRateEnabled,
      holidayPercent: newShiftTypeIsHourly && shiftTypeForm.holidayRateEnabled ? Number(shiftTypeForm.holidayPercent) : null,
    });
    setShiftTypeForm(emptyShiftTypeForm);
    setPanel('list');
  };

  return (
    <ThemedView style={[styles.sheet, { borderColor: theme.border }]}>
      <ThemedView style={styles.headerRow}>
        <ThemedView style={styles.headerLeft}>
          <ThemedText type="smallBold">排班中</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            目前排到 {schedulingDate}
          </ThemedText>
        </ThemedView>
        <Pressable onPress={exitSchedulingMode}>
          <ThemedView style={[styles.exitButton, { borderColor: theme.border }]}>
            <Ionicons name="close" size={16} color={theme.textSecondary} />
            <ThemedText type="small" themeColor="textSecondary">
              退出
            </ThemedText>
          </ThemedView>
        </Pressable>
      </ThemedView>

      <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
        {panel === 'list' && (
          <>
            {shiftTypesByWorkplace.length === 0 ? (
              <ThemedText themeColor="textSecondary">
                還沒有任何班別,可以先「新增班別」或直接「手動輸入」。
              </ThemedText>
            ) : (
              shiftTypesByWorkplace.map(({ workplace, shiftTypes: list }) => (
                <ThemedView key={workplace?.id ?? 'unknown'} style={styles.shiftTypeGroup}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {workplace?.name ?? '未知工作地點'}
                  </ThemedText>
                  {list.map((st) => (
                    <Pressable key={st.id} onPress={() => onPickShiftType(st)}>
                      <ThemedView type="backgroundElement" style={styles.shiftTypeCard}>
                        <ThemedText type="smallBold">{st.name}</ThemedText>
                        <ThemedText themeColor="textSecondary">
                          {st.startTime}–{st.endTime}
                        </ThemedText>
                      </ThemedView>
                    </Pressable>
                  ))}
                </ThemedView>
              ))
            )}

            <Pressable onPress={onMarkRestDay}>
              <ThemedView type="backgroundElement" style={styles.optionRow}>
                <Ionicons name="moon-outline" size={18} color={theme.textSecondary} />
                <ThemedText>休息日</ThemedText>
              </ThemedView>
            </Pressable>

            <Pressable onPress={() => setPanel('manual')}>
              <ThemedView type="backgroundElement" style={styles.optionRow}>
                <Ionicons name="create-outline" size={18} color={theme.textSecondary} />
                <ThemedText>手動輸入</ThemedText>
              </ThemedView>
            </Pressable>

            <Pressable onPress={() => setPanel('newShiftType')}>
              <ThemedView style={[styles.addButton, { borderColor: theme.primary }]}>
                <Ionicons name="add" size={18} color={theme.primary} />
                <ThemedText style={{ color: theme.primary }}>新增班別</ThemedText>
              </ThemedView>
            </Pressable>
          </>
        )}

        {panel === 'manual' && (
          <>
            <ThemedText type="smallBold">手動輸入班次</ThemedText>

            <FieldGroup label="工作地點(選填)">
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Pressable onPress={() => setManualForm((f) => ({ ...f, workplaceId: null }))}>
                  <ThemedView
                    style={[
                      styles.chip,
                      { backgroundColor: manualForm.workplaceId == null ? theme.primary : theme.backgroundElement },
                    ]}>
                    <ThemedText style={{ color: manualForm.workplaceId == null ? '#ffffff' : theme.text }}>
                      不指定
                    </ThemedText>
                  </ThemedView>
                </Pressable>
                {workplaces.map((wp) => {
                  const selected = manualForm.workplaceId === wp.id;
                  return (
                    <Pressable key={wp.id} onPress={() => setManualForm((f) => ({ ...f, workplaceId: wp.id }))}>
                      <ThemedView
                        style={[styles.chip, { backgroundColor: selected ? theme.primary : theme.backgroundElement }]}>
                        <ThemedText style={{ color: selected ? '#ffffff' : theme.text }}>{wp.name}</ThemedText>
                      </ThemedView>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </FieldGroup>

            <ThemedView type="backgroundElement" style={styles.timeRow}>
              <FieldGroup label="開始時間" flex>
                <TextInput
                  value={manualForm.startTime}
                  onChangeText={(v) => setManualForm((f) => ({ ...f, startTime: v }))}
                  placeholder="09:00"
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                />
              </FieldGroup>
              <FieldGroup label="結束時間" flex>
                <TextInput
                  value={manualForm.endTime}
                  onChangeText={(v) => setManualForm((f) => ({ ...f, endTime: v }))}
                  placeholder="17:00"
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                />
              </FieldGroup>
            </ThemedView>

            <FieldGroup label="基本薪資">
              <TextInput
                value={manualForm.baseRate}
                onChangeText={(v) => setManualForm((f) => ({ ...f, baseRate: v }))}
                keyboardType="numeric"
                placeholder="183"
                placeholderTextColor={theme.textSecondary}
                style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              />
            </FieldGroup>

            <ThemedView type="backgroundElement" style={styles.timeRow}>
              <FieldGroup label="休息時間(分鐘)" flex>
                <TextInput
                  value={manualForm.breakMinutes}
                  onChangeText={(v) => setManualForm((f) => ({ ...f, breakMinutes: v }))}
                  keyboardType="numeric"
                  placeholder="0"
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                />
              </FieldGroup>
              <ThemedView style={[styles.switchRow, styles.flex1]}>
                <ThemedText type="small" themeColor="textSecondary">
                  休息時間計薪
                </ThemedText>
                <Switch
                  value={manualForm.breakPaid}
                  onValueChange={(v) => setManualForm((f) => ({ ...f, breakPaid: v }))}
                  trackColor={{ true: theme.primary }}
                />
              </ThemedView>
            </ThemedView>

            <SwitchRow
              label="深夜加給"
              value={manualForm.nightRateEnabled}
              onValueChange={(v) => setManualForm((f) => ({ ...f, nightRateEnabled: v }))}
            />
            <ThemedView style={[styles.subFields, !manualForm.nightRateEnabled && styles.disabledSection]}>
              <FieldGroup label="深夜倍率">
                <TextInput
                  editable={manualForm.nightRateEnabled}
                  value={manualForm.nightMultiplier}
                  onChangeText={(v) => setManualForm((f) => ({ ...f, nightMultiplier: v }))}
                  keyboardType="numeric"
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                />
              </FieldGroup>
              <ThemedView type="backgroundElement" style={styles.timeRow}>
                <FieldGroup label="開始時段" flex>
                  <TextInput
                    editable={manualForm.nightRateEnabled}
                    value={manualForm.nightStart}
                    onChangeText={(v) => setManualForm((f) => ({ ...f, nightStart: v }))}
                    placeholderTextColor={theme.textSecondary}
                    style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                  />
                </FieldGroup>
                <FieldGroup label="結束時段" flex>
                  <TextInput
                    editable={manualForm.nightRateEnabled}
                    value={manualForm.nightEnd}
                    onChangeText={(v) => setManualForm((f) => ({ ...f, nightEnd: v }))}
                    placeholderTextColor={theme.textSecondary}
                    style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                  />
                </FieldGroup>
              </ThemedView>
            </ThemedView>

            <SwitchRow
              label="假日加給"
              value={manualForm.holidayRateEnabled}
              onValueChange={(v) => setManualForm((f) => ({ ...f, holidayRateEnabled: v }))}
            />
            <ThemedView style={[styles.subFields, !manualForm.holidayRateEnabled && styles.disabledSection]}>
              <FieldGroup label="假日加成百分比">
                <TextInput
                  editable={manualForm.holidayRateEnabled}
                  value={manualForm.holidayPercent}
                  onChangeText={(v) => setManualForm((f) => ({ ...f, holidayPercent: v }))}
                  keyboardType="numeric"
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                />
              </FieldGroup>
            </ThemedView>

            <SwitchRow
              label="今天是國定假日"
              value={manualForm.isHoliday}
              onValueChange={(v) => setManualForm((f) => ({ ...f, isHoliday: v }))}
            />

            <FieldGroup label="備註(選填)">
              <TextInput
                value={manualForm.note}
                onChangeText={(v) => setManualForm((f) => ({ ...f, note: v }))}
                placeholder="例如:代班、教育訓練"
                placeholderTextColor={theme.textSecondary}
                style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              />
            </FieldGroup>

            <FieldGroup label="手動調整這筆金額(選填)">
              <TextInput
                value={manualForm.manualWageOverride}
                onChangeText={(v) => setManualForm((f) => ({ ...f, manualWageOverride: v }))}
                keyboardType="numeric"
                placeholder="留空則自動計算"
                placeholderTextColor={theme.textSecondary}
                style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              />
            </FieldGroup>

            {manualPreview && (
              <ThemedView style={[styles.previewCard, { backgroundColor: theme.primarySoft }]}>
                <ThemedText type="small" themeColor="textSecondary">
                  預估這班薪資
                </ThemedText>
                <ThemedText type="subtitle" style={{ color: theme.primary }}>
                  ${manualPreview.pay.toLocaleString()}
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  共 {manualPreview.hours.toFixed(1)} 小時
                </ThemedText>
              </ThemedView>
            )}

            <Pressable onPress={onSubmitManual}>
              <ThemedView style={[styles.submitButton, { backgroundColor: theme.primary }]}>
                <ThemedText style={styles.submitButtonText}>新增這筆班次</ThemedText>
              </ThemedView>
            </Pressable>

            <Pressable onPress={() => setPanel('list')}>
              <ThemedText themeColor="textSecondary" style={styles.centerText}>
                返回班別清單
              </ThemedText>
            </Pressable>
          </>
        )}

        {panel === 'newShiftType' && (
          <>
            <ThemedText type="smallBold">新增班別</ThemedText>

            <FieldGroup label="所屬工作地點">
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                {workplaces.map((wp) => {
                  const selected = shiftTypeForm.workplaceId === wp.id;
                  return (
                    <Pressable key={wp.id} onPress={() => setShiftTypeForm((f) => ({ ...f, workplaceId: wp.id }))}>
                      <ThemedView
                        style={[styles.chip, { backgroundColor: selected ? theme.primary : theme.backgroundElement }]}>
                        <ThemedText style={{ color: selected ? '#ffffff' : theme.text }}>{wp.name}</ThemedText>
                      </ThemedView>
                    </Pressable>
                  );
                })}
              </ScrollView>
            </FieldGroup>

            <FieldGroup label="班別名稱">
              <TextInput
                value={shiftTypeForm.name}
                onChangeText={(v) => setShiftTypeForm((f) => ({ ...f, name: v }))}
                placeholder="例如:早班"
                placeholderTextColor={theme.textSecondary}
                style={[styles.input, { color: theme.text, borderColor: theme.border }]}
              />
            </FieldGroup>

            <ThemedView type="backgroundElement" style={styles.timeRow}>
              <FieldGroup label="開始時間" flex>
                <TextInput
                  value={shiftTypeForm.startTime}
                  onChangeText={(v) => setShiftTypeForm((f) => ({ ...f, startTime: v }))}
                  placeholder="09:00"
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                />
              </FieldGroup>
              <FieldGroup label="結束時間" flex>
                <TextInput
                  value={shiftTypeForm.endTime}
                  onChangeText={(v) => setShiftTypeForm((f) => ({ ...f, endTime: v }))}
                  placeholder="17:00"
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                />
              </FieldGroup>
            </ThemedView>

            {newShiftTypeIsMonthly && (
              <ThemedText themeColor="textSecondary">月薪工作地點的班別只用來記出勤工時,不會另外計算逐班金額。</ThemedText>
            )}

            {newShiftTypeIsDaily && (
              <FieldGroup label="日薪金額(選填,留空套用工作預設薪資)">
                <TextInput
                  value={shiftTypeForm.dailyRate}
                  onChangeText={(v) => setShiftTypeForm((f) => ({ ...f, dailyRate: v }))}
                  keyboardType="numeric"
                  placeholder="例如 1600"
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                />
              </FieldGroup>
            )}

            {newShiftTypeIsHourly && (
              <FieldGroup label="時薪(選填,留空套用工作預設薪資)">
                <TextInput
                  value={shiftTypeForm.hourlyRate}
                  onChangeText={(v) => setShiftTypeForm((f) => ({ ...f, hourlyRate: v }))}
                  keyboardType="numeric"
                  placeholder="例如 183"
                  placeholderTextColor={theme.textSecondary}
                  style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                />
              </FieldGroup>
            )}

            {newShiftTypeIsHourly && (
              <>
                <ThemedView type="backgroundElement" style={styles.timeRow}>
                  <FieldGroup label="休息時間(分鐘)" flex>
                    <TextInput
                      value={shiftTypeForm.breakMinutes}
                      onChangeText={(v) => setShiftTypeForm((f) => ({ ...f, breakMinutes: v }))}
                      keyboardType="numeric"
                      placeholder="0"
                      placeholderTextColor={theme.textSecondary}
                      style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                    />
                  </FieldGroup>
                  <ThemedView style={[styles.switchRow, styles.flex1]}>
                    <ThemedText type="small" themeColor="textSecondary">
                      休息時間計薪
                    </ThemedText>
                    <Switch
                      value={shiftTypeForm.breakPaid}
                      onValueChange={(v) => setShiftTypeForm((f) => ({ ...f, breakPaid: v }))}
                      trackColor={{ true: theme.primary }}
                    />
                  </ThemedView>
                </ThemedView>

                <SwitchRow
                  label="深夜加給"
                  value={shiftTypeForm.nightRateEnabled}
                  onValueChange={(v) => setShiftTypeForm((f) => ({ ...f, nightRateEnabled: v }))}
                />
                <ThemedView style={[styles.subFields, !shiftTypeForm.nightRateEnabled && styles.disabledSection]}>
                  <FieldGroup label="深夜倍率">
                    <TextInput
                      editable={shiftTypeForm.nightRateEnabled}
                      value={shiftTypeForm.nightMultiplier}
                      onChangeText={(v) => setShiftTypeForm((f) => ({ ...f, nightMultiplier: v }))}
                      keyboardType="numeric"
                      placeholderTextColor={theme.textSecondary}
                      style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                    />
                  </FieldGroup>
                  <ThemedView type="backgroundElement" style={styles.timeRow}>
                    <FieldGroup label="開始時段" flex>
                      <TextInput
                        editable={shiftTypeForm.nightRateEnabled}
                        value={shiftTypeForm.nightStart}
                        onChangeText={(v) => setShiftTypeForm((f) => ({ ...f, nightStart: v }))}
                        placeholderTextColor={theme.textSecondary}
                        style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                      />
                    </FieldGroup>
                    <FieldGroup label="結束時段" flex>
                      <TextInput
                        editable={shiftTypeForm.nightRateEnabled}
                        value={shiftTypeForm.nightEnd}
                        onChangeText={(v) => setShiftTypeForm((f) => ({ ...f, nightEnd: v }))}
                        placeholderTextColor={theme.textSecondary}
                        style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                      />
                    </FieldGroup>
                  </ThemedView>
                </ThemedView>

                <SwitchRow
                  label="假日加給"
                  value={shiftTypeForm.holidayRateEnabled}
                  onValueChange={(v) => setShiftTypeForm((f) => ({ ...f, holidayRateEnabled: v }))}
                />
                <ThemedView style={[styles.subFields, !shiftTypeForm.holidayRateEnabled && styles.disabledSection]}>
                  <FieldGroup label="假日加成百分比">
                    <TextInput
                      editable={shiftTypeForm.holidayRateEnabled}
                      value={shiftTypeForm.holidayPercent}
                      onChangeText={(v) => setShiftTypeForm((f) => ({ ...f, holidayPercent: v }))}
                      keyboardType="numeric"
                      placeholderTextColor={theme.textSecondary}
                      style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                    />
                  </FieldGroup>
                </ThemedView>
              </>
            )}

            <Pressable onPress={onSubmitNewShiftType}>
              <ThemedView style={[styles.submitButton, { backgroundColor: theme.primary }]}>
                <ThemedText style={styles.submitButtonText}>建立班別</ThemedText>
              </ThemedView>
            </Pressable>

            <Pressable onPress={() => setPanel('list')}>
              <ThemedText themeColor="textSecondary" style={styles.centerText}>
                取消
              </ThemedText>
            </Pressable>
          </>
        )}
      </ScrollView>
    </ThemedView>
  );
}

function FieldGroup({ label, flex, children }: { label: string; flex?: boolean; children: React.ReactNode }) {
  return (
    <ThemedView style={[styles.fieldGroup, flex && styles.flex1]}>
      <ThemedText type="small" themeColor="textSecondary">
        {label}
      </ThemedText>
      {children}
    </ThemedView>
  );
}

function SwitchRow({
  label,
  value,
  onValueChange,
}: {
  label: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  const theme = useTheme();
  return (
    <ThemedView type="backgroundElement" style={styles.switchRow}>
      <ThemedText>{label}</ThemedText>
      <Switch value={value} onValueChange={onValueChange} trackColor={{ true: theme.primary }} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  sheet: {
    maxHeight: '55%',
    borderTopLeftRadius: CardRadius,
    borderTopRightRadius: CardRadius,
    borderWidth: 1,
    borderBottomWidth: 0,
    width: '100%',
    alignSelf: 'center',
    maxWidth: MaxContentWidth,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  headerLeft: {
    gap: 2,
  },
  exitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    borderWidth: 1,
    borderRadius: Spacing.five,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one,
  },
  sheetContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.five,
    gap: Spacing.three,
  },
  shiftTypeGroup: {
    gap: Spacing.two,
  },
  shiftTypeCard: {
    borderRadius: CardRadius,
    padding: Spacing.three,
    gap: 2,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderRadius: CardRadius,
    padding: Spacing.three,
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
  fieldGroup: {
    gap: Spacing.one,
  },
  flex1: {
    flex: 1,
  },
  chip: {
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    borderRadius: Spacing.five,
    marginRight: Spacing.two,
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
  centerText: {
    textAlign: 'center',
  },
});

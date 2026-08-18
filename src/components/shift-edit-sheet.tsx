import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, TextInput, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, MaxContentWidth, Spacing } from '@/constants/theme';
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

type TypedEditState = {
  startTime: string;
  endTime: string;
  note: string;
  isHoliday: boolean;
  manualWageOverride: string;
};

/**
 * 疊在 DayDetailSheet 上面的單筆班次編輯 sheet。有 shiftTypeId 的班次只能改時間/備註/國定假日/
 * 手動覆寫金額;手動輸入的臨時班次可以整筆改。刪除直接刪,不再二次確認(跟 DayDetailSheet 一致)。
 */
export function ShiftEditSheet() {
  const theme = useTheme();
  const editingShiftId = useUiStore((s) => s.editingShiftId);
  const closeShiftEdit = useUiStore((s) => s.closeShiftEdit);

  const shifts = useDataStore((s) => s.shifts);
  const shiftTypes = useDataStore((s) => s.shiftTypes);
  const workplaces = useDataStore((s) => s.workplaces);
  const updateShift = useDataStore((s) => s.updateShift);
  const deleteShift = useDataStore((s) => s.deleteShift);

  const shift = editingShiftId != null ? shifts.find((s) => s.id === editingShiftId) : undefined;
  const shiftType = shift?.shiftTypeId != null ? shiftTypes.find((st) => st.id === shift.shiftTypeId) : undefined;
  const shiftTypeWorkplace = shiftType ? workplaces.find((w) => w.id === shiftType.workplaceId) : undefined;
  const isTyped = shift?.shiftTypeId != null;

  const [typedEdit, setTypedEdit] = useState<TypedEditState>({
    startTime: '',
    endTime: '',
    note: '',
    isHoliday: false,
    manualWageOverride: '',
  });
  const [manualForm, setManualForm] = useState<ManualFormState>({
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
  });

  useEffect(() => {
    if (!shift) return;
    if (shift.shiftTypeId != null) {
      setTypedEdit({
        startTime: shift.startTime ?? '',
        endTime: shift.endTime ?? '',
        note: shift.note ?? '',
        isHoliday: shift.isHoliday,
        manualWageOverride: shift.manualWageOverride != null ? String(shift.manualWageOverride) : '',
      });
    } else {
      setManualForm({
        workplaceId: shift.workplaceId,
        startTime: shift.startTime ?? '',
        endTime: shift.endTime ?? '',
        note: shift.note ?? '',
        baseRate: shift.baseRate != null ? String(shift.baseRate) : '',
        breakMinutes: shift.breakMinutes != null ? String(shift.breakMinutes) : '',
        breakPaid: shift.breakPaid ?? false,
        nightRateEnabled: shift.nightRateEnabled ?? false,
        nightMultiplier: shift.nightMultiplier != null ? String(shift.nightMultiplier) : '1.34',
        nightStart: shift.nightStart ?? '22:00',
        nightEnd: shift.nightEnd ?? '06:00',
        holidayRateEnabled: shift.holidayRateEnabled ?? false,
        holidayPercent: shift.holidayPercent != null ? String(shift.holidayPercent) : '33',
        isHoliday: shift.isHoliday,
        manualWageOverride: shift.manualWageOverride != null ? String(shift.manualWageOverride) : '',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shift?.id]);

  const typedPreview = useMemo(() => {
    if (!shiftType || shiftTypeWorkplace?.wageType === 'monthly') return null;
    const manualOverride = typedEdit.manualWageOverride ? Number(typedEdit.manualWageOverride) : null;

    if (shiftTypeWorkplace?.wageType === 'daily') {
      const pay = manualOverride ?? shiftType.dailyRate ?? shiftTypeWorkplace?.defaultDailyRate ?? 0;
      return { hours: null, pay };
    }

    if (!timeRegex.test(typedEdit.startTime) || !timeRegex.test(typedEdit.endTime)) return null;
    const input: WageCalcInput = {
      startTime: typedEdit.startTime,
      endTime: typedEdit.endTime,
      baseRate: shiftType.hourlyRate ?? shiftTypeWorkplace?.defaultHourlyRate ?? 0,
      breakMinutes: shiftType.breakMinutes,
      breakPaid: shiftType.breakPaid,
      nightRateEnabled: shiftType.nightRateEnabled,
      nightMultiplier: shiftType.nightMultiplier,
      nightStart: shiftType.nightStart,
      nightEnd: shiftType.nightEnd,
      holidayRateEnabled: shiftType.holidayRateEnabled,
      holidayPercent: shiftType.holidayPercent,
      isHoliday: typedEdit.isHoliday,
      manualWageOverride: manualOverride,
    };
    return { hours: calculateShiftHours(input, input), pay: calculateShiftWage(input) };
  }, [shiftType, shiftTypeWorkplace, typedEdit]);

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

  if (!shift) return null;

  const onSubmitTyped = async () => {
    const isDaily = shiftTypeWorkplace?.wageType === 'daily';
    await updateShift(shift.id, {
      startTime: typedEdit.startTime,
      endTime: typedEdit.endTime,
      note: typedEdit.note || null,
      isHoliday: isDaily ? false : typedEdit.isHoliday,
      manualWageOverride: typedEdit.manualWageOverride ? Number(typedEdit.manualWageOverride) : null,
    });
    closeShiftEdit();
  };

  const onSubmitManual = async () => {
    await updateShift(shift.id, {
      startTime: manualForm.startTime,
      endTime: manualForm.endTime,
      note: manualForm.note || null,
      isHoliday: manualForm.isHoliday,
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
    closeShiftEdit();
  };

  const onDelete = async () => {
    await deleteShift(shift.id);
    closeShiftEdit();
  };

  return (
    <Modal transparent visible animationType="slide" onRequestClose={closeShiftEdit}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.overlay} onPress={closeShiftEdit} />
        <View style={styles.sheetWrapper}>
          <ThemedView style={[styles.sheet, { borderColor: theme.border }]}>
            <ThemedView style={[styles.grabber, { backgroundColor: theme.border }]} />
            <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
              {isTyped ? (
                <>
                  <ThemedText type="subtitle">{shiftType?.name ?? '編輯班次'}</ThemedText>
                  {shiftTypeWorkplace?.wageType === 'daily' && (
                    <ThemedText themeColor="textSecondary">
                      日薪班別,固定領 ${(shiftType?.dailyRate ?? shiftTypeWorkplace?.defaultDailyRate ?? 0).toLocaleString()},起訖時間只是記錄用不影響金額
                    </ThemedText>
                  )}

                  <ThemedView type="backgroundElement" style={styles.timeRow}>
                    <FieldGroup label="開始時間" flex>
                      <TextInput
                        value={typedEdit.startTime}
                        onChangeText={(v) => setTypedEdit((f) => ({ ...f, startTime: v }))}
                        placeholder="09:00"
                        placeholderTextColor={theme.textSecondary}
                        style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                      />
                    </FieldGroup>
                    <FieldGroup label="結束時間" flex>
                      <TextInput
                        value={typedEdit.endTime}
                        onChangeText={(v) => setTypedEdit((f) => ({ ...f, endTime: v }))}
                        placeholder="17:00"
                        placeholderTextColor={theme.textSecondary}
                        style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                      />
                    </FieldGroup>
                  </ThemedView>

                  <FieldGroup label="備註(選填)">
                    <TextInput
                      value={typedEdit.note}
                      onChangeText={(v) => setTypedEdit((f) => ({ ...f, note: v }))}
                      placeholder="例如:代班"
                      placeholderTextColor={theme.textSecondary}
                      style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                    />
                  </FieldGroup>

                  {shiftTypeWorkplace?.wageType === 'hourly' && (
                    <SwitchRow
                      label="今天是國定假日"
                      value={typedEdit.isHoliday}
                      onValueChange={(v) => setTypedEdit((f) => ({ ...f, isHoliday: v }))}
                    />
                  )}

                  <FieldGroup label="手動調整這筆金額(選填)">
                    <TextInput
                      value={typedEdit.manualWageOverride}
                      onChangeText={(v) => setTypedEdit((f) => ({ ...f, manualWageOverride: v }))}
                      keyboardType="numeric"
                      placeholder="留空則自動計算"
                      placeholderTextColor={theme.textSecondary}
                      style={[styles.input, { color: theme.text, borderColor: theme.border }]}
                    />
                  </FieldGroup>

                  {typedPreview && <PreviewCard hours={typedPreview.hours} pay={typedPreview.pay} />}

                  <Pressable onPress={onSubmitTyped}>
                    <ThemedView style={[styles.submitButton, { backgroundColor: theme.primary }]}>
                      <ThemedText style={styles.submitButtonText}>儲存變更</ThemedText>
                    </ThemedView>
                  </Pressable>
                </>
              ) : (
                <>
                  <ThemedText type="subtitle">編輯臨時班次</ThemedText>

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

                  {manualPreview && <PreviewCard hours={manualPreview.hours} pay={manualPreview.pay} />}

                  <Pressable onPress={onSubmitManual}>
                    <ThemedView style={[styles.submitButton, { backgroundColor: theme.primary }]}>
                      <ThemedText style={styles.submitButtonText}>儲存變更</ThemedText>
                    </ThemedView>
                  </Pressable>
                </>
              )}

              <Pressable onPress={onDelete}>
                <ThemedView style={[styles.deleteButton, { borderColor: theme.danger }]}>
                  <ThemedText style={{ color: theme.danger }}>刪除這筆班次</ThemedText>
                </ThemedView>
              </Pressable>
            </ScrollView>
          </ThemedView>
        </View>
      </View>
    </Modal>
  );
}

function PreviewCard({ hours, pay }: { hours: number | null; pay: number }) {
  const theme = useTheme();
  return (
    <ThemedView style={[styles.previewCard, { backgroundColor: theme.primarySoft }]}>
      <ThemedText type="small" themeColor="textSecondary">
        預估這班薪資
      </ThemedText>
      <ThemedText type="subtitle" style={{ color: theme.primary }}>
        ${pay.toLocaleString()}
      </ThemedText>
      {hours != null && (
        <ThemedText type="small" themeColor="textSecondary">
          共 {hours.toFixed(1)} 小時
        </ThemedText>
      )}
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
  modalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  sheetWrapper: {
    width: '100%',
    alignSelf: 'center',
    maxWidth: MaxContentWidth,
  },
  sheet: {
    maxHeight: '85%',
    borderTopLeftRadius: CardRadius,
    borderTopRightRadius: CardRadius,
    borderWidth: 1,
    borderBottomWidth: 0,
    paddingTop: Spacing.two,
  },
  grabber: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: Spacing.two,
  },
  sheetContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.five,
    gap: Spacing.three,
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
  deleteButton: {
    borderRadius: CardRadius,
    borderWidth: 1.5,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
});

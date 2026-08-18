import { Ionicons } from '@expo/vector-icons';
import { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { CardRadius, MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { calculateShiftHours, calculateShiftWage } from '@/lib/wage';
import { resolveShiftWageInput } from '@/lib/resolve-shift-wage-input';
import { useDataStore } from '@/store/data-store';
import { useUiStore } from '@/store/ui-store';

/**
 * 瀏覽狀態下點行事曆某一天彈出的清單 sheet:列出當天所有排班(含休息日標記)。
 * 「刪除」按鈕切換刪除模式,每筆項目多出一個垂圾桶圖示,點下去直接刪除不再二次確認。
 * 點項目本身(非刪除圖示)會開 ShiftEditSheet 疊在這張 sheet 上面。
 */
export function DayDetailSheet() {
  const theme = useTheme();
  const dayDetail = useUiStore((s) => s.dayDetail);
  const closeDayDetail = useUiStore((s) => s.closeDayDetail);
  const deleteModeActive = useUiStore((s) => s.deleteModeActive);
  const toggleDeleteMode = useUiStore((s) => s.toggleDeleteMode);
  const openShiftEdit = useUiStore((s) => s.openShiftEdit);

  const shifts = useDataStore((s) => s.shifts);
  const shiftTypes = useDataStore((s) => s.shiftTypes);
  const workplaces = useDataStore((s) => s.workplaces);
  const deleteShift = useDataStore((s) => s.deleteShift);

  const shiftTypesById = useMemo(() => new Map(shiftTypes.map((st) => [st.id, st])), [shiftTypes]);
  const workplacesById = useMemo(() => new Map(workplaces.map((w) => [w.id, w])), [workplaces]);

  const dayShifts = useMemo(
    () =>
      shifts
        .filter((s) => s.date === dayDetail.date)
        .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? '')),
    [shifts, dayDetail.date],
  );

  if (!dayDetail.visible) return null;

  return (
    <Modal transparent visible animationType="slide" onRequestClose={closeDayDetail}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.overlay} onPress={closeDayDetail} />
        <View style={styles.sheetWrapper}>
          <ThemedView style={[styles.sheet, { borderColor: theme.border }]}>
            <ThemedView style={[styles.grabber, { backgroundColor: theme.border }]} />
            <ThemedView style={styles.headerRow}>
              <Pressable onPress={closeDayDetail}>
                <ThemedText style={{ color: theme.primary }}>返回</ThemedText>
              </Pressable>
              <ThemedText type="smallBold">{dayDetail.date}</ThemedText>
              {dayShifts.length > 0 ? (
                <Pressable onPress={toggleDeleteMode}>
                  <ThemedText style={{ color: deleteModeActive ? theme.primary : theme.danger }}>
                    {deleteModeActive ? '完成' : '刪除'}
                  </ThemedText>
                </Pressable>
              ) : (
                <ThemedView style={styles.headerSpacer} />
              )}
            </ThemedView>

            <ScrollView contentContainerStyle={styles.sheetContent} showsVerticalScrollIndicator={false}>
              {dayShifts.length === 0 ? (
                <ThemedText themeColor="textSecondary">這天還沒有排班。</ThemedText>
              ) : (
                dayShifts.map((shift) => {
                  if (shift.isRestDay) {
                    return (
                      <ThemedView key={shift.id} type="backgroundElement" style={styles.restDayCard}>
                        <ThemedText type="smallBold">休息日</ThemedText>
                        {deleteModeActive && (
                          <Pressable onPress={() => deleteShift(shift.id)}>
                            <Ionicons name="trash-outline" size={20} color={theme.danger} />
                          </Pressable>
                        )}
                      </ThemedView>
                    );
                  }

                  const shiftType = shift.shiftTypeId != null ? shiftTypesById.get(shift.shiftTypeId) : undefined;
                  const workplace =
                    shiftType != null ? workplacesById.get(shiftType.workplaceId) : workplacesById.get(shift.workplaceId ?? -1);
                  const label = shiftType?.name ?? workplace?.name ?? '臨時班次';
                  const wageInput = resolveShiftWageInput(shift, shiftTypesById, workplacesById);
                  const hours =
                    shift.startTime && shift.endTime
                      ? calculateShiftHours(
                          { startTime: shift.startTime, endTime: shift.endTime },
                          { breakMinutes: shiftType?.breakMinutes ?? shift.breakMinutes, breakPaid: shiftType?.breakPaid ?? shift.breakPaid },
                        )
                      : 0;
                  const pay = wageInput ? calculateShiftWage(wageInput) : null;

                  return (
                    <Pressable
                      key={shift.id}
                      disabled={deleteModeActive}
                      onPress={() => openShiftEdit(shift.id)}>
                      <ThemedView type="backgroundElement" style={styles.shiftCard}>
                        <ThemedView type="backgroundElement" style={styles.shiftCardHeader}>
                          <ThemedText type="smallBold">{label}</ThemedText>
                          <ThemedView type="backgroundElement" style={styles.shiftCardRight}>
                            {pay != null && <ThemedText style={{ color: theme.primary }}>${pay.toLocaleString()}</ThemedText>}
                            {deleteModeActive && (
                              <Pressable onPress={() => deleteShift(shift.id)}>
                                <Ionicons name="trash-outline" size={20} color={theme.danger} />
                              </Pressable>
                            )}
                          </ThemedView>
                        </ThemedView>
                        <ThemedText themeColor="textSecondary">
                          {shift.startTime && shift.endTime
                            ? `${shift.startTime}–${shift.endTime}(${hours.toFixed(1)} 小時)`
                            : '全日'}
                        </ThemedText>
                        {shift.note && <ThemedText themeColor="textSecondary">{shift.note}</ThemedText>}
                      </ThemedView>
                    </Pressable>
                  );
                })
              )}
            </ScrollView>
          </ThemedView>
        </View>
      </View>
    </Modal>
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
    maxHeight: '70%',
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
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
  },
  headerSpacer: {
    width: 40,
  },
  sheetContent: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.five,
    gap: Spacing.three,
  },
  shiftCard: {
    borderRadius: CardRadius,
    padding: Spacing.four,
    gap: Spacing.half,
  },
  shiftCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  shiftCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  restDayCard: {
    borderRadius: CardRadius,
    padding: Spacing.four,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
});

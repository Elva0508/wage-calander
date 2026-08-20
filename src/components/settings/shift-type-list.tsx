import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { ShiftType } from '@/db/schema';
import { useTheme } from '@/hooks/use-theme';
import { useDataStore } from '@/store/data-store';

import { styles } from './shared';
import { ShiftTypeForm } from './shift-type-form';

export function ShiftTypeSettings() {
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
      <ScrollView contentContainerStyle={styles.scrollContent}>
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
      </ScrollView>
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

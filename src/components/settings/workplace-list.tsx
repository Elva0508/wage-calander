import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Alert, Pressable, ScrollView } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { useDataStore } from '@/store/data-store';

import { formatDateOnly, styles } from './shared';
import { WorkplaceForm } from './workplace-form';

export function WorkplaceSettings() {
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
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <WorkplaceForm
          key={editingId}
          initial={editing}
          onCancel={() => setEditingId(null)}
          onSubmit={async (values) => {
            const workplaceValues = {
              ...values,
              onboardDate: values.onboardDate ? formatDateOnly(values.onboardDate) : null,
            };
            if (typeof editingId === 'number') {
              await updateWorkplace(editingId, workplaceValues);
            } else {
              await addWorkplace(workplaceValues);
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
      </ScrollView>
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

import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';

import { styles } from './shared';
import { ShiftTypeSettings } from './shift-type-list';
import { WorkplaceSettings } from './workplace-list';

export function WorkplaceHub({ onBack }: { onBack: () => void }) {
  const [activeTab, setActiveTab] = useState<'workplace' | 'shiftType'>('workplace');

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.hubHeader}>
          <BackButton onPress={onBack} />
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

function BackButton({ onPress }: { onPress: () => void }) {
  const theme = useTheme();
  return (
    <Pressable onPress={onPress} hitSlop={12} style={styles.backPressable}>
      <ThemedView style={styles.backRow}>
        <Ionicons name="chevron-back" size={22} color={theme.primary} />
        <ThemedText style={{ color: theme.primary }}>設定</ThemedText>
      </ThemedView>
    </Pressable>
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

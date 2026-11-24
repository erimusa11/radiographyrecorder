import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { strings } from '@/constants/strings';
import { colors, gradients } from '@/theme';
import { haptic } from '@/utils/haptics';

import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';

export type TabKey = 'records' | 'reports' | 'stock';

const TABS: { key: TabKey; label: string; icon: IconName }[] = [
  { key: 'records', label: strings.tabs.records, icon: 'users' },
  { key: 'reports', label: strings.tabs.reports, icon: 'chart' },
  { key: 'stock', label: strings.tabs.stock, icon: 'package' },
];

const ROUTES = { records: '/', reports: '/reports', stock: '/stock' } as const;

/**
 * The bar at the bottom of the main pages. "navigate" brings an already-open page back instead of piling up
 * copies, so Android's back button behaves the way people expect.
 */
export function TabBar({ active }: { active: TabKey }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  function open(key: TabKey) {
    if (key === active) return;
    haptic.select();
    router.navigate(ROUTES[key]);
  }

  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom }]} accessibilityRole="tablist">
      {TABS.map((tab) => {
        const selected = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            onPress={() => open(tab.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={tab.label}
            style={styles.tab}>
            {selected ? (
              <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={styles.indicator} />
            ) : null}
            <Icon name={tab.icon} size={22} color={selected ? colors.aqua : colors.textSubtle} strokeWidth={selected ? 2 : 1.75} />
            <AppText variant="label" color={selected ? colors.aqua : colors.textSubtle}>
              {tab.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: '#1B1C1D',
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  tab: { flex: 1, minHeight: 62, alignItems: 'center', justifyContent: 'center', gap: 2 },
  indicator: { position: 'absolute', top: -1, width: 44, height: 3, borderRadius: 2 },
});

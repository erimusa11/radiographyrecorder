import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { LungMark } from '@/components/brand/LungMark';
import { BuyPanel } from '@/components/stock/BuyPanel';
import { StockPanel } from '@/components/stock/StockPanel';
import { AppText } from '@/components/ui/AppText';
import { Banner, type BannerTone } from '@/components/ui/Banner';
import { BrandLoader } from '@/components/ui/BrandLoader';
import { GradientButton } from '@/components/ui/GradientButton';
import { HudBar } from '@/components/ui/HudBar';
import { Screen } from '@/components/ui/Screen';
import { Segmented } from '@/components/ui/Segmented';
import { TabBar } from '@/components/ui/TabBar';
import { strings } from '@/constants/strings';
import { useStock } from '@/context/StockContext';
import { colors, space } from '@/theme';
import { stockLevel } from '@/utils/stock';

const { stock: text } = strings;

type Table = 'stock' | 'buy';

/** The Stoku tab: two tables, "Stoku" (what is in the store room) and "Lista për t'u blerë" (what has to be bought). */
export default function StockScreen() {
  const { stock, buy, status, loaded, error, load, refresh } = useStock();
  const [table, setTable] = useState<Table>('stock');
  const [message, setMessage] = useState<{ tone: BannerTone; text: string } | null>(null);

  // The lists are fetched the first time this tab opens.
  useEffect(() => {
    load();
  }, [load]);

  // A "saved" message disappears by itself; a problem stays until the next action.
  useEffect(() => {
    if (!message || message.tone === 'error') return;
    const timer = setTimeout(() => setMessage(null), 4500);
    return () => clearTimeout(timer);
  }, [message]);

  const toBuy = buy.filter((line) => !line.done).length;
  const running = stock.filter((item) => stockLevel(item) !== 'ok').length;
  const subtitle = loaded ? (running > 0 ? `${text.count(stock.length)}  ·  ${text.countLow(running)}` : text.count(stock.length)) : text.subtitle;

  function show(tone: BannerTone, line: string) {
    setMessage({ tone, text: line });
  }

  let body;
  if (!loaded && status === 'error') {
    body = (
      <View style={styles.problem}>
        <Banner tone="error" message={error ?? strings.errors.loadFailed} />
        <GradientButton variant="ghost" label={text.retry} onPress={refresh} />
      </View>
    );
  } else if (!loaded) {
    body = (
      <View style={styles.state}>
        <BrandLoader size={32} color={colors.aqua} />
        <AppText variant="caption" color={colors.textMuted}>
          {text.loading}
        </AppText>
      </View>
    );
  } else {
    body = table === 'stock' ? <StockPanel onMessage={show} /> : <BuyPanel onMessage={show} />;
  }

  return (
    <Screen bottomInset={false}>
      <HudBar />
      <View style={styles.top}>
        <View style={styles.header}>
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <LungMark width={44} variant="lit" />
          </View>
          <View style={styles.headerText}>
            <AppText variant="title" accessibilityRole="header">
              {text.title}
            </AppText>
            <AppText variant="caption" color={colors.textMuted}>
              {subtitle}
            </AppText>
          </View>
        </View>

        <Segmented
          options={[
            { key: 'stock', label: text.tabStock },
            { key: 'buy', label: text.tabBuy, badge: toBuy },
          ]}
          value={table}
          onChange={(next) => {
            setMessage(null);
            setTable(next);
          }}
        />

        {message ? <Banner tone={message.tone} message={message.text} /> : null}
      </View>

      <View style={styles.body}>{body}</View>
      <TabBar active="stock" />
    </Screen>
  );
}

const styles = StyleSheet.create({
  top: { paddingHorizontal: 20, paddingTop: 4, paddingBottom: 14, gap: 14 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  headerText: { flex: 1 },
  body: { flex: 1 },
  state: { alignItems: 'center', gap: space.lg, paddingTop: 24, paddingHorizontal: 20 },
  problem: { gap: space.lg, paddingTop: 24, paddingHorizontal: 20 },
});

import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ReduceMotion } from 'react-native-reanimated';

import { LungMark } from '@/components/brand/LungMark';
import { AppText } from '@/components/ui/AppText';
import { Banner } from '@/components/ui/Banner';
import { Card } from '@/components/ui/Card';
import { GradientButton } from '@/components/ui/GradientButton';
import { HudBar } from '@/components/ui/HudBar';
import { Screen } from '@/components/ui/Screen';
import { strings } from '@/constants/strings';
import { unlockWithDevice } from '@/lib/deviceLock';
import { colors } from '@/theme';
import { haptic } from '@/utils/haptics';

const { lock } = strings;

type Props = {
  /** Called once the person has proved who they are. */
  onUnlocked: () => void;
  /** Ends the sign-in on this phone (for someone who cannot unlock, or hands the phone over). */
  onSignOut: () => void;
};

/**
 * Covers the whole app while it is locked. The phone's own prompt (fingerprint, face, or PIN / pattern / password) opens
 * by itself; the button is for trying again after it was closed or failed.
 */
export function LockScreen({ onUnlocked, onSignOut }: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const asking = useRef(false);
  const done = useRef(onUnlocked);

  useEffect(() => {
    done.current = onUnlocked;
  }, [onUnlocked]);

  const ask = useCallback(async () => {
    // One prompt at a time: a second one would cancel the first.
    if (asking.current) return;
    asking.current = true;
    setBusy(true);
    setMessage(null);
    const result = await unlockWithDevice(lock.prompt, lock.cancel);
    asking.current = false;
    setBusy(false);
    if (result === 'success' || result === 'unavailable') {
      haptic.success();
      done.current();
      return;
    }
    if (result === 'locked-out') setMessage(lock.lockedOut);
    else if (result === 'failed') setMessage(lock.failed);
    if (result !== 'cancelled') haptic.error();
  }, []);

  // Open the phone's prompt by itself, a moment after the screen has been drawn so it never appears over a blank frame.
  useEffect(() => {
    const timer = setTimeout(() => void ask(), 200);
    return () => clearTimeout(timer);
  }, [ask]);

  return (
    <Screen>
      <HudBar />
      <View style={styles.center}>
        <Animated.View entering={FadeIn.duration(350).reduceMotion(ReduceMotion.System)} style={styles.stack}>
          <View style={styles.mark} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <LungMark width={132} variant="lit" />
          </View>
          <Card>
            <View>
              <AppText variant="title">{lock.title}</AppText>
              <AppText variant="caption" color={colors.textMuted}>
                {lock.subtitle}
              </AppText>
            </View>
            {message ? <Banner tone="error" message={message} /> : null}
            <GradientButton label={lock.unlock} loadingLabel={lock.unlocking} loading={busy} icon="lock" iconPosition="start" onPress={ask} />
            <GradientButton label={lock.signOut} variant="ghost" disabled={busy} onPress={onSignOut} />
          </Card>
        </Animated.View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', paddingHorizontal: 20 },
  stack: { gap: 22 },
  mark: { alignItems: 'center' },
});

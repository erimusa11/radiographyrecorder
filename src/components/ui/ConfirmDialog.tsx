import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { colors, radius, space } from '@/theme';

import { AppText } from './AppText';
import { Banner } from './Banner';
import { GradientButton } from './GradientButton';

type Props = {
  title: string;
  message: string;
  confirmLabel: string;
  busyLabel: string;
  cancelLabel: string;
  busy?: boolean;
  /** A problem from the last attempt, shown inside the dialog. */
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
};

/**
 * A "Are you sure?" box for actions that cannot be undone. Built with a Modal (not Alert.alert) so it looks the same
 * on Android, iPhone and the web preview. Mount it only while it should be visible.
 */
export function ConfirmDialog({ title, message, confirmLabel, busyLabel, cancelLabel, busy = false, error, onConfirm, onCancel }: Props) {
  return (
    <Modal transparent animationType="fade" onRequestClose={onCancel} statusBarTranslucent>
      <View style={styles.backdrop}>
        <Pressable style={StyleSheet.absoluteFill} onPress={busy ? undefined : onCancel} accessibilityRole="button" accessibilityLabel={cancelLabel} />
        <View style={styles.card} accessibilityViewIsModal>
          <AppText variant="heading">{title}</AppText>
          <AppText variant="body" color={colors.textMuted}>
            {message}
          </AppText>
          {error ? <Banner tone="error" message={error} /> : null}
          <View style={styles.actions}>
            <View style={styles.action}>
              <GradientButton variant="ghost" label={cancelLabel} onPress={onCancel} disabled={busy} />
            </View>
            <View style={styles.action}>
              <GradientButton variant="dangerSolid" label={confirmLabel} loadingLabel={busyLabel} loading={busy} onPress={onConfirm} />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'center', padding: space.xl },
  card: {
    backgroundColor: '#202122',
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    padding: space.xl,
    gap: space.lg,
  },
  actions: { flexDirection: 'row', gap: space.md, marginTop: space.xs },
  action: { flex: 1 },
});

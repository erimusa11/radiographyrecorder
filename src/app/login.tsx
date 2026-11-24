import { useRef, useState } from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  type TextInputInstance,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, {
  FadeIn,
  FadeInDown,
  ReduceMotion,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { BrandHero, type HeroStatus } from '@/components/brand/BrandHero';
import { Wordmark } from '@/components/brand/Wordmark';
import { AppText } from '@/components/ui/AppText';
import { Banner, type BannerTone } from '@/components/ui/Banner';
import { Card } from '@/components/ui/Card';
import { Checkbox } from '@/components/ui/Checkbox';
import { GlowField } from '@/components/ui/GlowField';
import { GradientButton } from '@/components/ui/GradientButton';
import { HudBar } from '@/components/ui/HudBar';
import { Icon } from '@/components/ui/Icon';
import { Screen } from '@/components/ui/Screen';
import { strings } from '@/constants/strings';
import { useAuth } from '@/context/AuthContext';
import { useKeyboardVisible } from '@/hooks/useKeyboardVisible';
import { colors, MIN_TARGET } from '@/theme';
import { authErrorMessage } from '@/utils/authErrors';
import { haptic } from '@/utils/haptics';
import { isValidEmail } from '@/utils/validation';

type Phase = 'idle' | 'signing-in' | 'resetting';
type FieldErrors = { email?: string; password?: string };

const { login, validation } = strings;

export default function LoginScreen() {
  const { signIn, resetPassword, configured } = useAuth();
  const { width, height } = useWindowDimensions();
  const reduce = useReducedMotion();
  const keyboardVisible = useKeyboardVisible();

  const emailRef = useRef<TextInputInstance>(null);
  const passwordRef = useRef<TextInputInstance>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  // On by default: staff open the app on the same device every day, so they stay signed in until they sign out.
  const [remember, setRemember] = useState(true);
  const [emailFocused, setEmailFocused] = useState(false);
  const [passwordFocused, setPasswordFocused] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [heroStatus, setHeroStatus] = useState<HeroStatus>('idle');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [banner, setBanner] = useState<{ tone: BannerTone; message: string } | null>(
    configured ? null : { tone: 'error', message: authErrorMessage({ code: 'not-configured' }) },
  );

  const shake = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  const markWidth = Math.min(224, Math.round(width * 0.58));
  const heroHeight = Math.round(Math.min(262, Math.max(156, height * 0.28)));
  const busy = phase !== 'idle';

  function triggerShake() {
    if (reduce) return;
    shake.set(
      withSequence(
        withTiming(-9, { duration: 55 }),
        withTiming(9, { duration: 90 }),
        withTiming(-6, { duration: 80 }),
        withTiming(4, { duration: 70 }),
        withTiming(0, { duration: 60 }),
      ),
    );
  }

  function failWith(message: string) {
    setBanner({ tone: 'error', message });
    haptic.error();
    triggerShake();
  }

  async function handleSignIn() {
    if (busy) return;
    setBanner(null);

    const errors: FieldErrors = {};
    if (!email.trim()) errors.email = validation.emailRequired;
    else if (!isValidEmail(email)) errors.email = validation.emailInvalid;
    if (!password) errors.password = validation.passwordRequired;
    setFieldErrors(errors);
    if (errors.email || errors.password) {
      haptic.error();
      triggerShake();
      (errors.email ? emailRef : passwordRef).current?.focus();
      return;
    }

    Keyboard.dismiss();
    setPhase('signing-in');
    setHeroStatus('loading');
    try {
      await signIn(email, password, remember);
      setHeroStatus('success');
      haptic.success();
      // Nothing else to do: the gate in _layout.tsx moves us to the app as soon as Firebase confirms the session.
    } catch (error) {
      setHeroStatus('error');
      failWith(authErrorMessage(error));
      setPhase('idle');
    }
  }

  async function handleForgotPassword() {
    if (busy) return;
    setBanner(null);

    if (!isValidEmail(email)) {
      setFieldErrors({ email: email.trim() ? validation.emailInvalid : validation.resetNeedsEmail });
      haptic.error();
      emailRef.current?.focus();
      return;
    }

    setFieldErrors({});
    setPhase('resetting');
    try {
      await resetPassword(email);
      setBanner({ tone: 'info', message: login.resetSent(email.trim()) });
      haptic.success();
    } catch (error) {
      failWith(authErrorMessage(error));
    } finally {
      setPhase('idle');
    }
  }

  function onEmailChange(text: string) {
    setEmail(text);
    if (fieldErrors.email) setFieldErrors((current) => ({ ...current, email: undefined }));
    if (banner?.tone === 'error') setBanner(null);
  }

  function onPasswordChange(text: string) {
    setPassword(text);
    if (fieldErrors.password) setFieldErrors((current) => ({ ...current, password: undefined }));
    if (banner?.tone === 'error') setBanner(null);
  }

  return (
    <Screen>
      <HudBar />
      <KeyboardAvoidingView behavior="padding" style={styles.flex}>
        <BrandHero
          markWidth={markWidth}
          height={heroHeight}
          compact={keyboardVisible}
          focused={emailFocused || passwordFocused}
          status={heroStatus}
        />

        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : Platform.OS === 'web' ? 'none' : 'on-drag'}
          showsVerticalScrollIndicator={false}
          overScrollMode="never">
          <Animated.View entering={FadeIn.delay(650).duration(700).reduceMotion(ReduceMotion.System)}>
            <Wordmark screenWidth={width} />
          </Animated.View>

          <Animated.View entering={FadeInDown.delay(900).duration(600).reduceMotion(ReduceMotion.System)}>
            <Animated.View style={shakeStyle}>
              <Card>
                <View>
                  <AppText variant="title">{login.title}</AppText>
                  <AppText variant="caption" color={colors.textMuted}>
                    {login.subtitle}
                  </AppText>
                </View>

                {banner ? <Banner tone={banner.tone} message={banner.message} /> : null}

                <View style={styles.fields}>
                  <GlowField
                    ref={emailRef}
                    label={login.emailLabel}
                    icon="mail"
                    value={email}
                    onChangeText={onEmailChange}
                    error={fieldErrors.email}
                    onFocusChange={setEmailFocused}
                    editable={!busy}
                    keyboardType="email-address"
                    inputMode="email"
                    autoCapitalize="none"
                    autoCorrect={false}
                    spellCheck={false}
                    autoComplete="email"
                    textContentType="username"
                    returnKeyType="next"
                    submitBehavior="submit"
                    onSubmitEditing={() => passwordRef.current?.focus()}
                  />
                  <GlowField
                    ref={passwordRef}
                    label={login.passwordLabel}
                    icon="lock"
                    value={password}
                    onChangeText={onPasswordChange}
                    error={fieldErrors.password}
                    onFocusChange={setPasswordFocused}
                    editable={!busy}
                    secureTextEntry={!showPassword}
                    autoCapitalize="none"
                    autoCorrect={false}
                    spellCheck={false}
                    autoComplete="current-password"
                    textContentType="password"
                    returnKeyType="go"
                    onSubmitEditing={handleSignIn}
                    trailing={
                      <Pressable
                        onPress={() => setShowPassword((visible) => !visible)}
                        hitSlop={4}
                        accessibilityRole="button"
                        accessibilityLabel={showPassword ? login.hidePassword : login.showPassword}
                        style={styles.eye}>
                        <Icon name={showPassword ? 'eye-off' : 'eye'} size={20} color={colors.textMuted} />
                      </Pressable>
                    }
                  />
                </View>

                <View style={styles.options}>
                  <Checkbox label={login.remember} checked={remember} onChange={setRemember} disabled={busy} />
                  <Pressable
                    onPress={handleForgotPassword}
                    disabled={busy}
                    hitSlop={{ top: 6, bottom: 6, left: 12, right: 12 }}
                    accessibilityRole="button"
                    accessibilityState={{ disabled: busy, busy: phase === 'resetting' }}
                    style={styles.forgot}>
                    <AppText variant="label" color={colors.aqua}>
                      {phase === 'resetting' ? login.sendingReset : login.forgot}
                    </AppText>
                  </Pressable>
                </View>

                <GradientButton
                  label={login.submit}
                  loadingLabel={login.submitting}
                  loading={phase === 'signing-in'}
                  disabled={phase === 'resetting'}
                  icon="arrow-right"
                  onPress={handleSignIn}
                />
              </Card>
            </Animated.View>
          </Animated.View>

          <View style={styles.spacer} />

          <Animated.View entering={FadeIn.delay(1300).duration(700).reduceMotion(ReduceMotion.System)} style={styles.footer}>
            <Icon name="lock" size={13} color={colors.textSubtle} />
            <AppText variant="hud" color={colors.textSubtle}>
              {strings.hud.staffOnly}
            </AppText>
          </Animated.View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 20, paddingTop: 2, paddingBottom: 18, gap: 18 },
  fields: { gap: 14 },
  eye: { width: MIN_TARGET, height: MIN_TARGET, alignItems: 'center', justifyContent: 'center' },
  // "Remember me" on the left, "Forgot password?" on the right; they wrap onto two lines on a very narrow screen.
  options: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', columnGap: 12, marginTop: -4 },
  // 36 + 6 of hit slop above and below = a 48dp touch target.
  forgot: { minHeight: 36, justifyContent: 'center' },
  spacer: { flexGrow: 1, minHeight: 4 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingTop: 6 },
});

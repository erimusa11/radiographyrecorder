import { Easing } from 'react-native-reanimated';

/** One place for the app's timing so every screen moves the same way. */
export const motion = {
  /** Fast in, gentle out: for things that arrive. */
  out: Easing.out(Easing.cubic),
  inOut: Easing.inOut(Easing.cubic),
  /** Smooth sine, for breathing loops. */
  breathe: Easing.inOut(Easing.sin),
  linear: Easing.linear,

  /** The "scan" that lights the lungs on arrival. */
  scanDelayMs: 250,
  scanMs: 1500,
  /** Half a breath (in), the other half is the way back out. */
  breathHalfMs: 2400,
  /** One lap of the orbiting light. */
  orbitMs: 12000,
} as const;

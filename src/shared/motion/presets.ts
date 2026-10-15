import {
  FadeIn,
  FadeInUp,
  FadeOut,
  LinearTransition,
} from 'react-native-reanimated';
import { duration, easing } from './tokens';

// docs/MOTION.md 4.6, 4.12, 4.15. Layout animations default to ReduceMotion.System (instant under RM).
export const fadeIn = FadeIn.duration(duration.base).easing(easing.enter);
export const fadeOut = FadeOut.duration(duration.fast).easing(easing.exit);
export const listLayout = LinearTransition.duration(duration.base).easing(
  easing.standard,
);
export const toastIn = FadeInUp.duration(duration.base)
  .easing(easing.enter)
  .withInitialValues({ opacity: 0, transform: [{ translateY: 16 }] });
export const toastOut = FadeOut.duration(duration.fast).easing(easing.exit);

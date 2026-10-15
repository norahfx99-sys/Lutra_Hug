import {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { spring } from './tokens';

const PRESSED_SCALE = 0.97;
const PRESSED_OPACITY = 0.7;

// docs/MOTION.md 4.7: scale 1 -> 0.97 with spring.press; reduced motion gets an instant opacity dim instead.
export function usePressScale() {
  const reduced = useReducedMotion();
  const pressed = useSharedValue(0);

  const animatedStyle = useAnimatedStyle(() =>
    reduced
      ? { opacity: pressed.value ? PRESSED_OPACITY : 1 }
      : { transform: [{ scale: 1 - (1 - PRESSED_SCALE) * pressed.value }] },
  );

  const to = (v: number) => {
    pressed.value = reduced ? v : withSpring(v, spring.press);
  };

  return { animatedStyle, onPressIn: () => to(1), onPressOut: () => to(0) };
}

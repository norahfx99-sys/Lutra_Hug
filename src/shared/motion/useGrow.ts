import { useEffect, useRef } from 'react';
import {
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { duration, easing } from './tokens';

// docs/MOTION.md 4.10/4.11/4.14/4.15: 0 -> target over `reveal` on mount, `base` tween on change.
// Under reduced motion it holds `target`.
export function useGrow(target: number): SharedValue<number> {
  const reduced = useReducedMotion();
  const value = useSharedValue(reduced ? target : 0);
  const mounted = useRef(false);

  useEffect(() => {
    value.value = reduced
      ? target
      : withTiming(
          target,
          mounted.current
            ? { duration: duration.base, easing: easing.standard }
            : { duration: duration.reveal, easing: easing.enter },
        );
    mounted.current = true;
  }, [target, reduced, value]);

  return value;
}

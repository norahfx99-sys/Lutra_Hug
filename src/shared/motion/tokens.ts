import { Easing } from 'react-native-reanimated';

// docs/MOTION.md section 2.
export const duration = {
  fast: 120,
  base: 200,
  slow: 300,
  reveal: 450,
} as const;

export const easing = {
  standard: Easing.bezier(0.2, 0, 0, 1),
  enter: Easing.bezier(0, 0, 0.2, 1),
  exit: Easing.bezier(0.4, 0, 1, 1),
} as const;

export const spring = {
  // Damping ratio 40 / (2 * sqrt(400 * 1)) = 1.0: critically damped, no overshoot.
  press: { damping: 40, stiffness: 400, mass: 1 },
} as const;

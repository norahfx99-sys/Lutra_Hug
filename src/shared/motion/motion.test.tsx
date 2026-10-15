import { useRef } from 'react';
import ReactTestRenderer from 'react-test-renderer';
import * as Reanimated from 'react-native-reanimated';
import { useGrow } from './useGrow';
import { usePressScale } from './usePressScale';

// Reanimated mock: animations resolve to their final value, so tests assert end states, never timing.
type Probe<T> = { current?: T };

function renderHook<T>(hook: () => T) {
  const probe: Probe<T> = {};
  function Host() {
    probe.current = hook();
    return null;
  }
  let root!: ReactTestRenderer.ReactTestRenderer;
  ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(<Host />);
  });
  return {
    probe,
    rerender: () => ReactTestRenderer.act(() => root.update(<Host />)),
  };
}

beforeEach(() => {
  // The mock's useSharedValue returns a fresh object every render; keep it stable like the real hook.
  jest
    .spyOn(Reanimated, 'useSharedValue')
    .mockImplementation(init => useRef({ value: init }).current as never);
});
afterEach(() => jest.restoreAllMocks());

test('useGrow lands on target and follows changes', () => {
  let target = 0.4;
  const { probe, rerender } = renderHook(() => useGrow(target));
  expect(probe.current!.value).toBe(0.4);
  target = 1;
  rerender();
  expect(probe.current!.value).toBe(1);
});

test('usePressScale scales to 0.97 while pressed', () => {
  const { probe, rerender } = renderHook(usePressScale);
  ReactTestRenderer.act(() => probe.current!.onPressIn());
  rerender();
  expect(probe.current!.animatedStyle).toEqual({
    transform: [{ scale: 0.97 }],
  });
  ReactTestRenderer.act(() => probe.current!.onPressOut());
  rerender();
  expect(probe.current!.animatedStyle).toEqual({ transform: [{ scale: 1 }] });
});

test('usePressScale never scales under reduced motion', () => {
  jest.spyOn(Reanimated, 'useReducedMotion').mockReturnValue(true);
  const { probe, rerender } = renderHook(usePressScale);
  ReactTestRenderer.act(() => probe.current!.onPressIn());
  rerender();
  expect(probe.current!.animatedStyle).toEqual({ opacity: 0.7 });
});

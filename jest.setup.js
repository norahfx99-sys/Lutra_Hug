/* eslint-env jest */
jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock'),
);
jest.mock(
  'react-native-safe-area-context',
  () => require('react-native-safe-area-context/jest/mock').default,
);
// Native DB + keychain are never loaded in Jest; tests inject a node:sqlite fake via setDb().
jest.mock('@op-engineering/op-sqlite', () => ({ open: jest.fn() }));
jest.mock('react-native-keychain', () => ({
  ACCESSIBLE: {},
  getGenericPassword: jest.fn(async () => false),
  setGenericPassword: jest.fn(async () => true),
  resetGenericPassword: jest.fn(async () => true),
}));

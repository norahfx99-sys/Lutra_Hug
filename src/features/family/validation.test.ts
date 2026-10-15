import {
  CHILD_NAME_REQUIRED,
  DEVICE_NAME_REQUIRED,
  validateChildName,
  validateDeviceName,
} from './validation';

test.each(['', '   ', '\n\t'])('blank child name %j is rejected', name => {
  expect(validateChildName(name)).toBe(CHILD_NAME_REQUIRED);
});

test.each(['Bin', '  Na  ', 'Tý'])('child name %j is accepted', name => {
  expect(validateChildName(name)).toBeNull();
});

test('device name follows the same required rule', () => {
  expect(validateDeviceName(' ')).toBe(DEVICE_NAME_REQUIRED);
  expect(validateDeviceName('Điện thoại của mẹ')).toBeNull();
});

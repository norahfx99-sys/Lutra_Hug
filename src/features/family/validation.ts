// Field rules for FAMILY_SETUP and CHILD_FORM. Returns the inline error text, or null when valid.

export const DEVICE_NAME_REQUIRED = 'Tên thiết bị không được để trống.';
export const CHILD_NAME_REQUIRED = 'Tên gọi không được để trống.';

export const validateDeviceName = (name: string) =>
  name.trim() ? null : DEVICE_NAME_REQUIRED;

export const validateChildName = (name: string) =>
  name.trim() ? null : CHILD_NAME_REQUIRED;

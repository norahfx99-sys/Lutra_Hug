import { Alert } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Boot } from '../../app/Boot';
import { newId, setDb } from '../care-cost/db';
import { installFakeDb } from '../care-cost/fakeDb.testutil';
import {
  createFamily,
  getFamily,
  getOnboarded,
  listChildren,
  saveChild,
  setOnboarded,
} from '../care-cost/repo';
import { PrivacyScreen } from './PrivacyScreen';
import { SettingsScreen } from './SettingsScreen';
import * as Keychain from 'react-native-keychain';
import { wipeLocalData } from './wipe';

const S = createNativeStackNavigator();
afterEach(() => {
  setDb(null);
  jest.restoreAllMocks();
});

const render = async (Screen: () => React.JSX.Element) => {
  let r!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    r = ReactTestRenderer.create(
      <Boot>
        <NavigationContainer>
          <S.Navigator>
            <S.Screen name="S" component={Screen} />
          </S.Navigator>
        </NavigationContainer>
      </Boot>,
    );
  });
  await ReactTestRenderer.act(async () => {
    await new Promise(res => setTimeout(res, 20));
  });
  return r;
};
const texts = (r: { findAllByType: (t: never) => { props: any }[] }) =>
  JSON.stringify(r.findAllByType('Text' as never).map(x => x.props.children));

async function seed() {
  const raw = await installFakeDb();
  await createFamily('Máy mẹ', await newId());
  await saveChild({ displayName: 'Bin' }, await newId());
  await setOnboarded();
  return raw;
}

test('wipe empties every table, keeps device_id, clears onboarded', async () => {
  const raw = await seed();
  raw.exec(
    "INSERT INTO chat_conversation (id, title, created_at, updated_at) VALUES ('c', 't', 1, 1)",
  );
  raw.exec(
    "INSERT INTO chat_message (id, conversation_id, role, content, created_at, status) VALUES ('m', 'c', 'user', 'hi', 1, 'sent')",
  );
  raw.exec("INSERT INTO meta (key, value) VALUES ('ai.model', 'x')");
  await wipeLocalData();
  expect(Keychain.resetGenericPassword).toHaveBeenCalled();
  for (const t of [
    'family',
    'device',
    'child',
    'expense',
    'expense_allocation',
    'monthly_budget',
    'change_log',
    'conflict',
    'chat_conversation',
    'chat_message',
  ])
    expect(raw.prepare(`SELECT 1 FROM ${t}`).all()).toEqual([]);
  expect(raw.prepare('SELECT key FROM meta').all()).toEqual([
    { key: 'device_id' },
  ]);
  expect(await getOnboarded()).toBe(false);
  expect(await getFamily()).toBeNull();
  await createFamily('Máy mới', await newId());
  expect(await getFamily()).not.toBeNull();
  expect(await listChildren()).toEqual([]);
});

test('settings shows the device name and the sections', async () => {
  await seed();
  const r = await render(SettingsScreen);
  const t = texts(r.root);
  expect(t).toContain('Máy mẹ');
  expect(t).toContain('Trợ lý AI');
  expect(t).not.toContain('Quản trị');
  expect(t).toContain('Đồng bộ gần');
  await ReactTestRenderer.act(async () => r.unmount());
});

test('privacy: wipe only runs after confirming in the dialog', async () => {
  await seed();
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const r = await render(PrivacyScreen);
  expect(texts(r.root)).toContain('Không có bản sao lưu đám mây');
  const btn = r.root.findAll(
    n =>
      n.props.accessibilityRole === 'button' &&
      n.props.onPress &&
      texts(n).includes('Xóa toàn bộ dữ liệu trên máy'),
  )[0];
  await ReactTestRenderer.act(async () => btn.props.onPress());
  expect(alert).toHaveBeenCalledTimes(1);
  expect(await getFamily()).not.toBeNull(); // not wiped by the first tap
  const buttons = alert.mock.calls[0][2]!;
  expect(buttons.map(b => b.text)).toEqual(['Hủy', 'Xóa']);
  await ReactTestRenderer.act(async () => {
    buttons[1].onPress!();
    await new Promise(res => setTimeout(res, 20));
  });
  expect(await getFamily()).toBeNull();
  await ReactTestRenderer.act(async () => r.unmount());
});

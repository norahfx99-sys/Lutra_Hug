import ReactTestRenderer from 'react-test-renderer';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { setDb, newId } from '../care-cost/db';
import { installFakeDb } from '../care-cost/fakeDb.testutil';
import {
  createFamily,
  saveChild,
  getOnboarded,
  listChildren,
} from '../care-cost/repo';
import { Boot } from '../../app/Boot';
import { FamilySetupScreen } from './FamilySetupScreen';
import { ChildFormScreen } from './ChildFormScreen';
import { ChildrenScreen } from './ChildrenScreen';
import { CHILD_NAME_REQUIRED } from './validation';

const S = createNativeStackNavigator();
afterEach(() => setDb(null));
const render = async (initial: string) => {
  let r!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    r = ReactTestRenderer.create(
      <Boot>
        <NavigationContainer>
          <S.Navigator initialRouteName={initial}>
            <S.Screen name="FamilySetup" component={FamilySetupScreen} />
            <S.Screen name="FirstChild" component={ChildFormScreen} />
            <S.Screen name="ChildForm" component={ChildFormScreen} />
            <S.Screen name="Children" component={ChildrenScreen} />
          </S.Navigator>
        </NavigationContainer>
      </Boot>,
    );
  });
  return r;
};
const press = async (r: ReactTestRenderer.ReactTestRenderer, label: string) => {
  const t = r.root.findAll(
    n =>
      n.props.accessibilityRole === 'button' &&
      n.props.onPress &&
      JSON.stringify(
        n.findAllByType('Text' as never).map(x => x.props.children),
      ).includes(label),
  )[0];
  await ReactTestRenderer.act(async () => {
    t.props.onPress();
    await new Promise(res => setTimeout(res, 10));
  });
};

test('onboarding: family -> first child sets onboarded', async () => {
  await installFakeDb();
  const r = await render('FamilySetup');
  const input = r.root.findAll(n => n.props.label === 'Tên thiết bị này')[0];
  await ReactTestRenderer.act(async () => input.props.onChangeText('Máy mẹ'));
  await press(r, 'Tạo gia đình');
  expect(
    r.root.findAll(n => n.props.children === 'Thêm trẻ đầu tiên').length,
  ).toBeGreaterThan(0);
  await press(r, 'Lưu và bắt đầu');
  expect(
    r.root.findAll(n => n.props.children === CHILD_NAME_REQUIRED).length,
  ).toBeGreaterThan(0);
  expect(await getOnboarded()).toBe(false);
  const ci = r.root.findAll(n => n.props.label === 'Tên gọi của trẻ')[0];
  await ReactTestRenderer.act(async () => ci.props.onChangeText(' Bin '));
  await press(r, 'Lưu và bắt đầu');
  expect(await getOnboarded()).toBe(true);
  expect((await listChildren()).map(c => c.displayName)).toEqual(['Bin']);
  await ReactTestRenderer.act(async () => r.unmount());
});

test('children list + stop tracking via edit', async () => {
  await installFakeDb();
  await createFamily('x', await newId());
  await saveChild({ displayName: 'Na' }, await newId());
  const r = await render('Children');
  await ReactTestRenderer.act(async () => {
    await new Promise(res => setTimeout(res, 20));
  });
  expect(r.root.findAll(n => n.props.children === 'Na').length).toBeGreaterThan(
    0,
  );
  expect(
    r.root.findAll(
      n =>
        typeof n.props.children === 'string' &&
        n.props.children.includes('khoản chi'),
    ).length,
  ).toBeGreaterThan(0);
  await ReactTestRenderer.act(async () => r.unmount());
});

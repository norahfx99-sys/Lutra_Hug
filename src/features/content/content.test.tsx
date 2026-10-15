import { Linking } from 'react-native';
import ReactTestRenderer from 'react-test-renderer';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ResourceListScreen } from './ResourceListScreen';
import { ServiceListScreen } from './ServiceListScreen';
import { UrgentScreen } from './UrgentScreen';

const S = createNativeStackNavigator();

async function render(name: string, component: () => React.JSX.Element) {
  let r!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    r = ReactTestRenderer.create(
      <NavigationContainer>
        <S.Navigator>
          <S.Screen name={name} component={component} />
        </S.Navigator>
      </NavigationContainer>,
    );
  });
  return r;
}

const texts = (r: ReactTestRenderer.ReactTestRenderer) =>
  r.root
    .findAllByType('Text' as never)
    .map(x => [x.props.children].flat(Infinity).join(''))
    .join('\n');

test('resource list shows sample label, source line and filters by search', async () => {
  const r = await render('ResourceList', ResourceListScreen);
  expect(texts(r)).toContain('Nội dung mẫu');
  expect(texts(r)).toContain(
    'Nguồn: Nhóm biên tập Lutra Hug (mẫu) · Rà soát ngày 12/09/2026',
  );

  const input = r.root.findByProps({ accessibilityLabel: 'Tìm tài liệu' });
  await ReactTestRenderer.act(async () => input.props.onChangeText('zzzxyz'));
  expect(texts(r)).toContain('Không có tài liệu phù hợp');

  await ReactTestRenderer.act(async () =>
    input.props.onChangeText('nha truong'),
  );
  expect(texts(r)).toContain('Trao đổi với nhà trường');
});

test('service list filters by kind', async () => {
  const r = await render('ServiceList', ServiceListScreen);
  expect(texts(r)).toContain('Tư vấn từ xa Ví Dụ A');
  const chip = r.root.find(
    n =>
      n.props.accessibilityRole === 'button' &&
      n.props.onPress &&
      texts({ root: n } as never) === 'Đường dây hỗ trợ',
  );
  await ReactTestRenderer.act(async () => chip.props.onPress());
  expect(texts(r)).toContain('Đường dây lắng nghe Ví Dụ E');
  expect(texts(r)).not.toContain('Tư vấn từ xa Ví Dụ A');
});

test('urgent screen only opens tel: 115 / 111 / 113 and says it is not an emergency service', async () => {
  const open = jest
    .spyOn(Linking, 'openURL')
    .mockResolvedValue(undefined as never);
  const r = await render('Urgent', UrgentScreen);
  expect(texts(r)).toContain('không phải dịch vụ cấp cứu');

  const buttons = r.root.findAll(
    n =>
      typeof n.props.accessibilityLabel === 'string' &&
      n.props.accessibilityLabel.startsWith('Gọi ') &&
      n.props.onPress,
  );
  expect(buttons).toHaveLength(3);
  for (const b of buttons) {
    await ReactTestRenderer.act(async () => b.props.onPress());
  }
  const urls = open.mock.calls.map(c => c[0]).sort();
  expect(urls).toEqual(['tel:111', 'tel:113', 'tel:115']);

  // No other digit run of 3+ in any visible text.
  const runs = texts(r).match(/\d{3,}/g) ?? [];
  expect(runs.every(n => ['111', '113', '115'].includes(n))).toBe(true);
  open.mockRestore();
});

test('urgent screen shows an error when the dialer cannot open', async () => {
  const open = jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('x'));
  const r = await render('Urgent', UrgentScreen);
  const b = r.root.findAll(
    n =>
      n.props.accessibilityLabel === 'Gọi 115, Cấp cứu y tế' && n.props.onPress,
  )[0];
  await ReactTestRenderer.act(async () => b.props.onPress());
  expect(texts(r)).toContain('Không mở được ứng dụng gọi điện');
  open.mockRestore();
});

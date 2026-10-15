/**
 * @format
 */

import ReactTestRenderer from 'react-test-renderer';
import App from '../App';
import { setDb } from '../src/features/care-cost/db';
import { installFakeDb } from '../src/features/care-cost/fakeDb.testutil';

beforeEach(installFakeDb);
afterEach(() => setDb(null));

test('opens on the welcome screen', async () => {
  let root!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(<App />);
  });
  expect(root.root.findAllByProps({ children: 'Bắt đầu' })).not.toHaveLength(0);
  await ReactTestRenderer.act(() => root.unmount());
});

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
    await new Promise(res => setTimeout(res, 30));
  });
};
const type = async (
  r: ReactTestRenderer.ReactTestRenderer,
  label: string,
  value: string,
) => {
  const f = r.root.findAll(n => n.props.label === label)[0];
  await ReactTestRenderer.act(async () => f.props.onChangeText(value));
};

// Regression: after the first child, the stack must swap to Main, not stay on the add-child form.
test('finishing onboarding lands on Home', async () => {
  let root!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(() => {
    root = ReactTestRenderer.create(<App />);
  });
  await press(root, 'Bắt đầu');
  await press(root, 'Bỏ qua');
  await type(root, 'Tên thiết bị này', 'Máy mẹ');
  await press(root, 'Tạo gia đình');
  await type(root, 'Tên gọi của trẻ', 'Bin');
  await press(root, 'Lưu và bắt đầu');
  await ReactTestRenderer.act(async () => {
    await new Promise(res => setTimeout(res, 50));
  });
  const has = (t: string) =>
    root.root.findAll(n => n.props.children === t).length > 0;
  expect(has('Thêm trẻ đầu tiên')).toBe(false);
  expect(has('Thêm trẻ')).toBe(false);
  expect(has('Thêm chi phí')).toBe(true);
  await ReactTestRenderer.act(() => root.unmount());
});

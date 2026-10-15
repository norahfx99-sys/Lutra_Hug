import ReactTestRenderer from 'react-test-renderer';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Boot } from '../../app/Boot';
import { getDb, newId, setDb } from '../care-cost/db';
import { splitEvenly } from '../care-cost/domain';
import { installFakeDb } from '../care-cost/fakeDb.testutil';
import {
  createFamily,
  getFamily,
  saveChild,
  saveExpense,
} from '../care-cost/repo';
import { ConflictsScreen } from './ConflictsScreen';
import { applyRemote, type Link, type Msg } from './engine';
import type { NearbyTransport } from './session';
import { SyncDevicesScreen } from './SyncDevicesScreen';

const S = createNativeStackNavigator();
const mounted: ReactTestRenderer.ReactTestRenderer[] = [];
afterEach(() => {
  // Unmount first: a live tree would get the store notification of the next test's writes.
  ReactTestRenderer.act(() => mounted.splice(0).forEach(r => r.unmount()));
  setDb(null);
});

const texts = (r: { root: ReactTestRenderer.ReactTestInstance }) =>
  JSON.stringify(
    r.root.findAllByType('Text' as never).map(x => x.props.children),
  );

async function render(transport?: NearbyTransport) {
  let r!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    r = ReactTestRenderer.create(
      <Boot>
        <NavigationContainer>
          <S.Navigator>
            <S.Screen name="SyncDevices">
              {() => <SyncDevicesScreen transport={transport} />}
            </S.Screen>
            <S.Screen name="SyncConflicts" component={ConflictsScreen} />
          </S.Navigator>
        </NavigationContainer>
      </Boot>,
    );
  });
  mounted.push(r);
  return r;
}
const press = async (r: ReactTestRenderer.ReactTestRenderer, label: string) => {
  const t = r.root.findAll(
    n =>
      n.props.accessibilityRole === 'button' &&
      n.props.onPress &&
      (n.props.accessibilityLabel === label ||
        texts({ root: n }).includes(label)),
  )[0];
  await ReactTestRenderer.act(async () => {
    t.props.onPress();
    await new Promise(res => setTimeout(res, 10));
  });
};

test('idle states: no family, then a family with one phone, then paired with last sync', async () => {
  const raw = await installFakeDb();
  let r = await render();
  expect(texts(r)).toContain('Máy này chưa có gia đình');
  expect(texts(r)).toContain('Tham gia gia đình');
  expect(texts(r)).toContain('tối đa 2 điện thoại');

  await ReactTestRenderer.act(async () =>
    createFamily('Máy mẹ', await newId()),
  );
  r = await render();
  expect(texts(r)).toContain('Mời điện thoại thứ hai');

  raw.exec(
    `INSERT INTO device (id, family_id, display_name, last_sync_at)
     VALUES ('peer', '${(await getFamily())!.id}', 'Máy ba', ${new Date(
      2026,
      2,
      15,
      9,
      5,
    ).getTime()})`,
  );
  r = await render();
  expect(texts(r)).toContain('Đã ghép với Máy ba');
  expect(texts(r)).toContain('Đồng bộ lần cuối: 09:05, 15/03/2026');
  expect(texts(r)).toContain('Đồng bộ ngay');
});

test('without the native module, starting sync shows an honest error and no devices', async () => {
  await installFakeDb();
  await createFamily('Máy mẹ', await newId());
  const r = await render();
  await press(r, 'Mời điện thoại thứ hai');
  expect(texts(r)).toContain('Chưa có kết nối Nearby');
  expect(texts(r)).toContain('Bản này chưa có kết nối Nearby');
  expect(texts(r)).not.toContain('Thử lại'); // retrying cannot help
});

test('a mismatching code ends in the interrupted state without exchanging data', async () => {
  await installFakeDb();
  await createFamily('Máy mẹ', await newId());
  let emit!: Parameters<NearbyTransport['start']>[0];
  const r = await render({
    start: async on => {
      emit = on;
      on({ type: 'peers', peers: [{ id: 'p', name: 'Máy kia' }] });
    },
    connect: async () => {},
    accept: () => new Promise(() => {}),
    disconnect: async () => {},
  });
  await press(r, 'Mời điện thoại thứ hai');
  expect(texts(r)).toContain('Máy kia');
  await press(r, 'Kết nối với Máy kia');
  await ReactTestRenderer.act(async () =>
    emit({ type: 'code', peer: { id: 'p', name: 'Máy kia' }, code: '482913' }),
  );
  expect(texts(r)).toContain('482913');
  await press(r, 'Mã không khớp');
  expect(texts(r)).toContain('Mã không khớp');
  expect(texts(r)).toContain('chưa trao đổi dữ liệu nào');
  expect(texts(r)).toContain('Thử lại');
});

test('a finished sync shows the applied count and links to the open conflicts', async () => {
  await installFakeDb();
  const family = await (async () => {
    await createFamily('Máy mẹ', await newId());
    return (await getFamily())!.id;
  })();
  const kid = await saveChild({ displayName: 'An' }, await newId());
  const base = {
    amountVnd: 100000,
    spentOn: '2026-03-15',
    category: 'medical' as const,
    note: null,
    allocations: splitEvenly(100000, [kid]),
  };
  const id = await saveExpense(
    { ...base, description: 'Gốc' },
    await newId(),
    '2026-03-31',
  );
  await saveExpense(
    { ...base, id, description: 'Máy này' },
    await newId(),
    '2026-03-31',
  );
  const remote = (operationId: string, description: string) => ({
    operationId,
    deviceId: 'peer',
    entityType: 'expense' as const,
    entityId: id,
    baseVersion: 1,
    op: 'upsert' as const,
    payload: { ...base, id, description },
    createdAt: Date.now(),
  });
  await applyRemote(getDb(), [remote('r1', 'Máy kia')]); // leaves one open conflict

  // The other phone sends one more, unrelated change: a new child.
  const child = {
    operationId: 'r2',
    deviceId: 'peer',
    entityType: 'child' as const,
    entityId: 'c2',
    baseVersion: null,
    op: 'upsert' as const,
    payload: { id: 'c2', displayName: 'Bin', isActive: true },
    createdAt: Date.now(),
  };
  const inbox: Msg[] = [
    {
      t: 'hello',
      familyId: family,
      deviceId: 'peer',
      name: 'Máy kia',
      devices: [],
      ops: [],
    },
    { t: 'changes', changes: [child] },
  ];
  const link: Link = {
    send: async () => {},
    receive: async () => inbox.shift()!,
  };
  let emit!: Parameters<NearbyTransport['start']>[0];
  const r = await render({
    start: async on => {
      emit = on;
      on({ type: 'peers', peers: [{ id: 'p', name: 'Máy kia' }] });
    },
    connect: async () => {},
    accept: async () => link,
    disconnect: async () => {},
  });
  await press(r, 'Mời điện thoại thứ hai');
  await press(r, 'Kết nối với Máy kia');
  await ReactTestRenderer.act(async () =>
    emit({ type: 'code', peer: { id: 'p', name: 'Máy kia' }, code: '111222' }),
  );
  await press(r, 'Mã khớp');

  expect(texts(r)).toContain('Đồng bộ xong');
  expect(texts(r)).toContain('Đã áp dụng 1 thay đổi');
  expect(texts(r)).toContain('Còn 1 xung đột cần chọn');
  await press(r, 'Giải quyết xung đột');
  expect(texts(r)).toContain('Máy kia');
});

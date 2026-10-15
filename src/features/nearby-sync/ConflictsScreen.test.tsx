import ReactTestRenderer from 'react-test-renderer';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Boot } from '../../app/Boot';
import { newId, getDb, setDb } from '../care-cost/db';
import { splitEvenly } from '../care-cost/domain';
import { installFakeDb } from '../care-cost/fakeDb.testutil';
import {
  createFamily,
  listExpenses,
  saveChild,
  saveExpense,
} from '../care-cost/repo';
import { ConflictsScreen } from './ConflictsScreen';
import { applyRemote } from './engine';

const S = createNativeStackNavigator();
afterEach(() => setDb(null));

const texts = (r: ReactTestRenderer.ReactTestRenderer) =>
  JSON.stringify(
    r.root.findAllByType('Text' as never).map(x => x.props.children),
  );

test('conflict screen lists both sides and keeping one resolves it', async () => {
  await installFakeDb();
  await createFamily('A', await newId());
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
  // The other phone edited the same version 1.
  await applyRemote(getDb(), [
    {
      operationId: 'remote-1',
      deviceId: 'other',
      entityType: 'expense',
      entityId: id,
      baseVersion: 1,
      op: 'upsert',
      payload: { ...base, id, description: 'Máy kia' },
      createdAt: Date.now(),
    },
  ]);

  let r!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    r = ReactTestRenderer.create(
      <Boot>
        <NavigationContainer>
          <S.Navigator>
            <S.Screen name="SyncConflicts" component={ConflictsScreen} />
          </S.Navigator>
        </NavigationContainer>
      </Boot>,
    );
  });
  expect(texts(r)).toContain('Máy này');
  expect(texts(r)).toContain('Máy kia');

  const keepRemote = r.root.findAll(
    n =>
      n.props.accessibilityRole === 'button' &&
      n.props.onPress &&
      texts({ root: n } as never).includes('Giữ bản trên máy kia'),
  )[0];
  await ReactTestRenderer.act(async () => {
    keepRemote.props.onPress();
    await new Promise(res => setTimeout(res, 10));
  });
  expect(texts(r)).toContain('Không còn xung đột');
  expect((await listExpenses('2026-03'))[0].description).toBe('Máy kia');
});

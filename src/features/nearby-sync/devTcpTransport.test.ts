/// <reference types="node" />
import net from 'net';
import { newId, setDb, type Sql } from '../care-cost/db';
import { splitEvenly } from '../care-cost/domain';
import { makeFakeDb } from '../care-cost/fakeDb.testutil';
import {
  createFamily,
  listChildren,
  listExpenses,
  saveChild,
  saveExpense,
} from '../care-cost/repo';
import {
  createDevTcpTransport,
  deriveCode,
  lineSplitter,
  type TcpLib,
} from './devTcpTransport';
import { createSession, type SyncState } from './session';

const tcp = net as unknown as TcpLib;

test('deriveCode is symmetric and 6 digits', () => {
  expect(deriveCode('a', 'b')).toBe(deriveCode('b', 'a'));
  expect(deriveCode('a', 'b')).toMatch(/^\d{6}$/);
  expect(deriveCode('a', 'b')).not.toBe(deriveCode('a', 'c'));
});

test('lineSplitter reassembles split and merged writes and drops corrupt lines', () => {
  const got: unknown[] = [];
  const feed = lineSplitter(f => got.push(f));
  feed('{"t":"hi","id":"1"');
  feed(',"name":"x"}\n{"t":"bye"}\nnot json\n{"t"');
  feed(':"accept"}\n');
  expect(got).toEqual([
    { t: 'hi', id: '1', name: 'x' },
    { t: 'bye' },
    { t: 'accept' },
  ]);
});

/** Two phones joined by real TCP sockets on loopback, each dialling the other's port. */
function phone(listenPort: number, dialPort: number | null, db: Sql) {
  let state: SyncState = { step: 'idle' };
  const waiting: (() => void)[] = [];
  const transport = createDevTcpTransport({
    tcp,
    name: `phone-${listenPort}`,
    listenPort,
    dial: dialPort === null ? [] : [{ host: '127.0.0.1', port: dialPort }],
    retryMs: 50,
  });
  const session = createSession({
    transport,
    db,
    onState: s => {
      state = s;
      waiting.splice(0).forEach(w => w());
    },
  });
  const until = (pred: (s: SyncState) => boolean) =>
    new Promise<SyncState>((res, rej) => {
      const t = setTimeout(
        () => rej(new Error(`timeout in ${JSON.stringify(state)}`)),
        12000,
      );
      const check = () => {
        if (pred(state)) {
          clearTimeout(t);
          res(state);
        } else waiting.push(check);
      };
      check();
    });
  return { session, until, transport };
}

/** Two ports the OS just handed out, so parallel or back-to-back runs never collide. */
async function freePorts(): Promise<[number, number]> {
  const one = () =>
    new Promise<number>(res => {
      const srv = net.createServer();
      srv.listen(0, '127.0.0.1', () => {
        const { port } = srv.address() as net.AddressInfo;
        srv.close(() => res(port));
      });
    });
  const a = await one();
  let b = await one();
  while (b === a) b = await one();
  return [a, b];
}

let A: Sql;
let B: Sql;
beforeEach(async () => {
  A = (await makeFakeDb()).db;
  B = (await makeFakeDb()).db;
});
afterEach(() => setDb(null));

async function seedFamilyOnA() {
  setDb(A);
  await createFamily('Máy mẹ', await newId());
  const kid = await saveChild({ displayName: 'Bin' }, await newId());
  await saveExpense(
    {
      amountVnd: 90000,
      spentOn: '2026-03-10',
      description: 'Trị liệu',
      category: 'medical',
      note: null,
      allocations: splitEvenly(90000, [kid]),
    },
    await newId(),
    '2026-03-31',
  );
}

test('first pairing over real TCP sockets copies the family to the empty phone', async () => {
  await seedFamilyOnA();
  const [p1, p2] = await freePorts();
  const a = phone(p1, p2, A);
  const b = phone(p2, p1, B);
  await Promise.all([a.session.start(), b.session.start()]);

  const found = (await a.until(
    s => s.step === 'searching' && s.peers.length === 1,
  )) as Extract<SyncState, { step: 'searching' }>;
  await b.until(s => s.step === 'searching' && s.peers.length === 1);
  await a.session.connect(found.peers[0].id);

  const [va, vb] = (await Promise.all([
    a.until(s => s.step === 'verifying'),
    b.until(s => s.step === 'verifying'),
  ])) as Extract<SyncState, { step: 'verifying' }>[];
  expect(va.code).toBe(vb.code);

  await Promise.all([a.session.confirm(true), b.session.confirm(true)]);
  const [da, db] = (await Promise.all([
    a.until(s => s.step === 'done' || s.step === 'error'),
    b.until(s => s.step === 'done' || s.step === 'error'),
  ])) as Extract<SyncState, { step: 'done' }>[];
  expect(da.step).toBe('done');
  expect(db.step).toBe('done');
  expect(db.firstPairing).toBe(true);

  setDb(B);
  expect((await listChildren()).map(c => c.displayName)).toEqual(['Bin']);
  expect(await listExpenses('2026-03')).toHaveLength(1);

  a.session.dispose();
  b.session.dispose();
  await new Promise(r => setTimeout(r, 600)); // let the lingering sockets close
}, 30000);

test('refusing the code on one phone moves no data', async () => {
  await seedFamilyOnA();
  const [p1, p2] = await freePorts();
  const a = phone(p1, p2, A);
  const b = phone(p2, p1, B);
  await Promise.all([a.session.start(), b.session.start()]);
  const found = (await a.until(
    s => s.step === 'searching' && s.peers.length === 1,
  )) as Extract<SyncState, { step: 'searching' }>;
  await b.until(s => s.step === 'searching' && s.peers.length === 1);
  await a.session.connect(found.peers[0].id);
  await Promise.all([
    a.until(s => s.step === 'verifying'),
    b.until(s => s.step === 'verifying'),
  ]);

  await b.session.confirm(false);
  await a.session.confirm(true);
  const sa = await a.until(s => s.step === 'error');
  const sb = await b.until(s => s.step === 'error');
  expect(sb).toMatchObject({ reason: 'mismatch' });
  expect(sa.step === 'error' && ['rejected', 'dropped']).toContain(
    sa.step === 'error' ? sa.reason : '',
  );
  setDb(B);
  expect(await listChildren()).toEqual([]);

  a.session.dispose();
  b.session.dispose();
  await new Promise(r => setTimeout(r, 300));
}, 30000);

// The adb setup opens a single direction; whichever phone has the smaller id, they must still pair.
test.each([
  ['first phone dials', true],
  ['second phone dials', false],
])(
  'one-way link pairs when the %s',
  async (_name, firstDials) => {
    const [p1, p2] = await freePorts();
    const a = phone(p1, firstDials ? p2 : null, A);
    const b = phone(p2, firstDials ? null : p1, B);
    await Promise.all([a.session.start(), b.session.start()]);
    await a.until(s => s.step === 'searching' && s.peers.length === 1);
    await b.until(s => s.step === 'searching' && s.peers.length === 1);
    a.session.dispose();
    b.session.dispose();
    await new Promise(r => setTimeout(r, 200));
  },
  30000,
);

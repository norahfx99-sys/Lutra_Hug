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
import type { Link, Msg } from './engine';
import { listConflicts } from './engine';
import {
  createSession,
  NearbyPermissionError,
  PeerRejectedError,
  PROTOCOL_STEPS,
  readSyncInfo,
  unavailableTransport,
  type NearbyTransport,
  type Session,
  type SyncState,
  type TransportEvent,
} from './session';

const MONTH = '2026-03';

/** In-memory radio between two phones. reset() starts a fresh connection round. */
function fakeNet() {
  let closed = false;
  let codes = ['482913', '482913'];
  let failReceive: Record<number, number> = {};
  let calls = [0, 0];
  let accepted = [false, false];
  let handlers: (((e: TransportEvent) => void) | undefined)[] = [];
  let q: Msg[][] = [[], []];
  let rx: { res: (m: Msg) => void; rej: (e: Error) => void }[][] = [[], []];
  let acceptWaiters: ((go: boolean) => void)[] = [];
  const peer = (j: number) => ({ id: `peer-${j}`, name: `Máy ${j}` });

  const link = (me: number): Link => ({
    async send(m) {
      if (closed) throw new Error('closed');
      const w = rx[1 - me].shift();
      if (w) w.res(m);
      else q[1 - me].push(m);
    },
    receive: () =>
      new Promise((res, rej) => {
        calls[me]++;
        if (closed || failReceive[me] === calls[me])
          return rej(new Error('lost'));
        const m = q[me].shift();
        if (m) res(m);
        else rx[me].push({ res, rej });
      }),
  });
  const transport = (me: number): NearbyTransport => ({
    async start(cb) {
      handlers[me] = cb;
      if (handlers[0] && handlers[1]) {
        handlers[0]({ type: 'peers', peers: [peer(1)] });
        handlers[1]({ type: 'peers', peers: [peer(0)] });
      }
    },
    async connect() {
      handlers[0]?.({ type: 'code', peer: peer(1), code: codes[0] });
      handlers[1]?.({ type: 'code', peer: peer(0), code: codes[1] });
    },
    accept: () =>
      new Promise((res, rej) => {
        if (closed) return rej(new PeerRejectedError());
        accepted[me] = true;
        acceptWaiters[me] = go =>
          go ? res(link(me)) : rej(new PeerRejectedError());
        if (accepted[0] && accepted[1]) acceptWaiters.forEach(w => w(true));
      }),
    async disconnect() {
      closed = true;
      rx.flat().forEach(w => w.rej(new Error('closed')));
      rx = [[], []];
      acceptWaiters.forEach(w => w?.(false));
    },
  });
  return {
    t: [transport(0), transport(1)] as const,
    reset(o: { codes?: string[]; failReceive?: Record<number, number> } = {}) {
      closed = false;
      codes = o.codes ?? ['482913', '482913'];
      failReceive = o.failReceive ?? {};
      calls = [0, 0];
      accepted = [false, false];
      handlers = [];
      q = [[], []];
      rx = [[], []];
      acceptWaiters = [];
    },
  };
}

/** Both users open the screen, A taps the found phone, then each confirms with its verdict. */
async function flow(sa: Session, sb: Session, verdict = [true, true]) {
  await Promise.all([sa.start(), sb.start()]);
  await sa.connect('peer-1');
  await Promise.all([sa.confirm(verdict[0]), sb.confirm(verdict[1])]);
}

const steps = (log: SyncState[]) => log.map(s => s.step);
const last = (log: SyncState[]) => log[log.length - 1];

let A: Sql;
let B: Sql;
let kid: string;
let net: ReturnType<typeof fakeNet>;
let la: SyncState[];
let lb: SyncState[];
let sa: Session;
let sb: Session;

/** Run `fn` as if `db` were this phone's database (repo.ts reads the global). */
async function on<T>(db: Sql, fn: () => Promise<T>) {
  setDb(db);
  return fn();
}
const exp = (amountVnd: number, description: string) => ({
  amountVnd,
  spentOn: '2026-03-15',
  description,
  category: 'medical' as const,
  note: null,
  allocations: splitEvenly(amountVnd, [kid]),
});
const expenses = (db: Sql) => on(db, () => listExpenses(MONTH));

beforeEach(async () => {
  A = (await makeFakeDb()).db;
  B = (await makeFakeDb()).db;
  await on(A, async () => {
    await createFamily('Điện thoại của mẹ', await newId());
    kid = await saveChild({ displayName: 'An' }, await newId());
    await saveExpense(exp(100000, 'Trị liệu'), await newId());
  });
  net = fakeNet();
  net.reset();
  la = [];
  lb = [];
  sa = createSession({ transport: net.t[0], db: A, onState: s => la.push(s) });
  sb = createSession({ transport: net.t[1], db: B, onState: s => lb.push(s) });
});
afterEach(() => setDb(null));

test('first pairing: matching codes copy the family, progress is made of real counts', async () => {
  await flow(sa, sb);

  expect(steps(la)).toEqual([
    'searching',
    'searching',
    'searching',
    'verifying',
    'verifying',
    ...Array(PROTOCOL_STEPS + 1).fill('transferring'),
    'done',
  ]);
  const progress = lb.flatMap(s =>
    s.step === 'transferring' ? [s.progress] : [],
  );
  expect(progress.map(p => p.step)).toEqual([0, 1, 2, 3, 4]);
  const done = last(lb);
  if (done.step !== 'done') throw new Error('B did not finish');
  expect(done).toMatchObject({ firstPairing: true, conflictsLeft: 0 });
  // The counts shown while transferring are exactly what was applied afterwards.
  expect(progress[4]).toMatchObject({ sent: 0, received: done.applied });
  expect(done.applied).toBeGreaterThan(0);

  expect((await on(B, listChildren)).map(c => c.displayName)).toEqual(['An']);
  expect(await expenses(B)).toEqual(await expenses(A));
  expect(await readSyncInfo(B)).toMatchObject({
    hasFamily: true,
    peer: { name: 'Điện thoại của mẹ' },
  });
  expect((await readSyncInfo(A)).peer?.lastSyncAt).toEqual(expect.any(Number));
});

test('wrong code: nothing is applied and the joining phone stays unpaired', async () => {
  net.reset({ codes: ['482913', '482914'] });
  await flow(sa, sb, [false, true]);

  expect(last(la)).toEqual({ step: 'error', reason: 'mismatch' });
  expect(last(lb)).toEqual({ step: 'error', reason: 'rejected' });
  expect(steps(lb)).not.toContain('transferring');
  expect(await readSyncInfo(B)).toMatchObject({ hasFamily: false, peer: null });
  const log = await B.execute('SELECT COUNT(*) AS n FROM change_log');
  expect(Number(log.rows[0].n)).toBe(0);
});

test('interruption mid-transfer rolls back, and a retry succeeds', async () => {
  net.reset({ failReceive: { 1: 2 } }); // B loses the link while waiting for the changes
  await flow(sa, sb);

  expect(last(lb)).toEqual({ step: 'error', reason: 'dropped' });
  // A already had everything it needed from B, so it may finish; the protocol has no final ack.
  expect(await readSyncInfo(B)).toMatchObject({ hasFamily: false, peer: null });
  expect(await on(B, listChildren)).toEqual([]);

  net.reset();
  await flow(sa, sb); // start() is allowed again from the error state
  expect(last(lb).step).toBe('done');
  expect(await expenses(B)).toEqual(await expenses(A));
});

test('a later sync reports the real number of open conflicts', async () => {
  await flow(sa, sb);
  const [row] = await expenses(A);
  await on(A, async () =>
    saveExpense({ ...exp(80000, 'A sửa'), id: row.id }, await newId()),
  );
  await on(B, async () =>
    saveExpense({ ...exp(90000, 'B sửa'), id: row.id }, await newId()),
  );

  net.reset();
  await flow(sa, sb);
  for (const l of [la, lb]) {
    expect(last(l)).toMatchObject({
      step: 'done',
      applied: 0,
      conflictsLeft: 1,
      firstPairing: false,
    });
  }
  expect(await listConflicts(A)).toHaveLength(1);
  expect((await readSyncInfo(B)).openConflicts).toBe(1);
});

test('a third phone is refused and receives nothing', async () => {
  await flow(sa, sb);
  const C = (await makeFakeDb()).db;
  const lc: SyncState[] = [];
  const net2 = fakeNet();
  net2.reset();
  const sa2 = createSession({ transport: net2.t[0], db: A, onState: () => {} });
  const sc = createSession({
    transport: net2.t[1],
    db: C,
    onState: s => lc.push(s),
  });
  await flow(sa2, sc);

  expect(last(lc)).toEqual({ step: 'error', reason: 'limit' });
  expect(await readSyncInfo(C)).toMatchObject({ hasFamily: false });
});

test('without the native module the session fails honestly', async () => {
  const log: SyncState[] = [];
  const s = createSession({
    transport: unavailableTransport,
    db: A,
    onState: x => log.push(x),
  });
  await s.start();
  expect(steps(log)).toEqual(['searching', 'error']);
  expect(last(log)).toEqual({ step: 'error', reason: 'unavailable' });
});

test('a denied permission is reported as such', async () => {
  const log: SyncState[] = [];
  const s = createSession({
    transport: {
      ...unavailableTransport,
      start: () => Promise.reject(new NearbyPermissionError()),
    },
    db: A,
    onState: x => log.push(x),
  });
  await s.start();
  expect(last(log)).toEqual({ step: 'error', reason: 'permission' });
});

test('cancel while verifying returns to idle', async () => {
  await Promise.all([sa.start(), sb.start()]);
  await sa.connect('peer-1');
  await sa.cancel();
  expect(last(la)).toEqual({ step: 'idle' });
});

import { newId, setDb } from '../../care-cost/db';
import { splitEvenly } from '../../care-cost/domain';
import { installFakeDb } from '../../care-cost/fakeDb.testutil';
import { createFamily, saveChild, saveExpense } from '../../care-cost/repo';
import {
  answerTurn,
  beginRetry,
  beginTurn,
  resolveProvider,
  setProviderForTests,
} from './chat';
import { listConversations, listMessages } from './chatRepo';
import { AiError, type AiProvider, type AiRequest } from './providers';
import { saveSettings, DEFAULT_SETTINGS } from './secure';

// No key stored: the real provider path must refuse.
jest.mock('react-native-keychain', () => ({
  ACCESSIBLE: {},
  getGenericPassword: jest.fn(async () => false),
}));

beforeEach(async () => {
  await installFakeDb();
  await createFamily('T', await newId());
  const kid = await saveChild({ displayName: 'Tên Thật' }, await newId());
  await saveExpense(
    {
      amountVnd: 120_000,
      spentOn: new Date().toISOString().slice(0, 10),
      description: 'Mô tả riêng tư',
      category: 'medical',
      note: null,
      allocations: splitEvenly(120_000, [kid]),
    },
    await newId(),
    '2999-01-01',
  );
});
afterEach(() => {
  setDb(null);
  setProviderForTests(null);
});

const recorder = (reply: string | Error) => {
  const calls: AiRequest[] = [];
  const provider: AiProvider = {
    chat: async req => {
      calls.push(req);
      if (reply instanceof Error) throw reply;
      return reply;
    },
  };
  return { provider, calls };
};

test('without a key or model the real path refuses with no_key', async () => {
  await expect(resolveProvider()).rejects.toMatchObject({ kind: 'no_key' });
});

test('a turn stores the question, calls the provider with data + question, stores the answer', async () => {
  const { provider, calls } = recorder('Bạn chi 120.000 đ.');
  setProviderForTests(provider);
  const t = await beginTurn(null, 'Tháng này chi bao nhiêu?');
  expect((await listMessages(t.conversationId))[0].status).toBe('pending');
  await answerTurn({ ...t, question: 'Tháng này chi bao nhiêu?' });

  const msgs = await listMessages(t.conversationId);
  expect(msgs.map(m => [m.role, m.status, m.content])).toEqual([
    ['user', 'sent', 'Tháng này chi bao nhiêu?'],
    ['assistant', 'sent', 'Bạn chi 120.000 đ.'],
  ]);
  expect((await listConversations())[0].title).toBe('Tháng này chi bao nhiêu?');

  expect(calls).toHaveLength(1);
  expect(calls[0].system).toContain('120.000 đ');
  expect(calls[0].messages).toEqual([
    { role: 'user', content: 'Tháng này chi bao nhiêu?' },
  ]);
  // Default privacy: no real child name, no description.
  expect(calls[0].system).not.toContain('Tên Thật');
  expect(calls[0].system).not.toContain('Mô tả riêng tư');
});

test('privacy toggles on: the same turn now carries names and descriptions', async () => {
  await saveSettings({
    ...DEFAULT_SETTINGS,
    model: 'm',
    shareChildNames: true,
    shareDescriptions: true,
  });
  const { provider, calls } = recorder('ok');
  setProviderForTests(provider);
  const t = await beginTurn(null, 'Q');
  await answerTurn({ ...t, question: 'Q' });
  expect(calls[0].system).toContain('Tên Thật');
  expect(calls[0].system).toContain('Mô tả riêng tư');
});

test('later turns send the earlier exchange as history', async () => {
  const { provider, calls } = recorder('A');
  setProviderForTests(provider);
  const t1 = await beginTurn(null, 'Q1');
  await answerTurn({ ...t1, question: 'Q1' });
  const t2 = await beginTurn(t1.conversationId, 'Q2');
  await answerTurn({ ...t2, question: 'Q2' });
  expect(calls[1].messages).toEqual([
    { role: 'user', content: 'Q1' },
    { role: 'assistant', content: 'A' },
    { role: 'user', content: 'Q2' },
  ]);
});

test('failure marks the question failed, keeps it, and surfaces a typed error', async () => {
  setProviderForTests(recorder(new AiError('rate_limited')).provider);
  const t = await beginTurn(null, 'Q');
  await expect(answerTurn({ ...t, question: 'Q' })).rejects.toMatchObject({
    kind: 'rate_limited',
  });
  const msgs = await listMessages(t.conversationId);
  expect(msgs).toHaveLength(1);
  expect(msgs[0]).toMatchObject({
    role: 'user',
    status: 'failed',
    content: 'Q',
  });
});

test('unknown errors become a generic AiError that carries no detail', async () => {
  setProviderForTests(recorder(new Error('Bearer sk-leak')).provider);
  const t = await beginTurn(null, 'Q');
  const err = await answerTurn({ ...t, question: 'Q' }).catch(e => e);
  expect(err).toBeInstanceOf(AiError);
  expect(err.message).not.toContain('sk-leak');
});

test('retry replaces the failed question: no duplicate, answer follows', async () => {
  setProviderForTests(recorder(new AiError('network')).provider);
  const t = await beginTurn(null, 'Q');
  await answerTurn({ ...t, question: 'Q' }).catch(() => {});

  const ok = recorder('Đây rồi');
  setProviderForTests(ok.provider);
  const r = await beginRetry(t.conversationId, t.messageId);
  expect(r.question).toBe('Q');
  await answerTurn(r);
  const msgs = await listMessages(t.conversationId);
  expect(msgs.map(m => [m.role, m.status, m.content])).toEqual([
    ['user', 'sent', 'Q'],
    ['assistant', 'sent', 'Đây rồi'],
  ]);
  // The failed copy is not in the history sent on retry.
  expect(ok.calls[0].messages).toEqual([{ role: 'user', content: 'Q' }]);
});

test('Stop: aborting the signal reaches the provider and ends the turn as aborted', async () => {
  let seen: AbortSignal | undefined;
  setProviderForTests({
    chat: ({ signal }) =>
      new Promise((_res, rej) => {
        seen = signal as AbortSignal;
        signal?.addEventListener('abort', () => rej(new AiError('aborted')));
      }),
  });
  const t = await beginTurn(null, 'Q');
  const ctl = new AbortController();
  const done = answerTurn({ ...t, question: 'Q', signal: ctl.signal as never });
  await new Promise(r => setTimeout(r, 20));
  expect(seen).toBe(ctl.signal);
  ctl.abort();
  await expect(done).rejects.toMatchObject({ kind: 'aborted' });
  expect((await listMessages(t.conversationId))[0].status).toBe('failed');
});

test('after enough turns the older ones are summarised in the background', async () => {
  const { provider, calls } = recorder('A');
  setProviderForTests(provider);
  await saveSettings({ ...DEFAULT_SETTINGS, model: 'm', historyWindow: 4 });
  let id: string | null = null;
  for (let i = 0; i < 4; i++) {
    const t = await beginTurn(id, `Q${i}`);
    id = t.conversationId;
    await answerTurn({ ...t, question: `Q${i}` });
  }
  await new Promise(r => setTimeout(r, 30));
  // 8 messages, window 4: the summarisation call is the extra one after the 3rd/4th turn.
  const summaryCalls = calls.filter(c =>
    c.system.includes('tóm tắt cuộc trò chuyện'),
  );
  expect(summaryCalls.length).toBeGreaterThan(0);
});

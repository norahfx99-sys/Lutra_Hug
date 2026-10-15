import { setDb } from '../../care-cost/db';
import { installFakeDb } from '../../care-cost/fakeDb.testutil';
import {
  appendMessage,
  completeTurn,
  createConversation,
  deleteAllConversations,
  deleteConversation,
  deleteMessage,
  getConversation,
  listConversations,
  listMessages,
  setMessageStatus,
  setSummary,
} from './chatRepo';

let raw: Awaited<ReturnType<typeof installFakeDb>>;
beforeEach(async () => {
  raw = await installFakeDb();
});
afterEach(() => setDb(null));

const count = (table: string) =>
  Number(
    (raw.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number })
      .n,
  );

test('create + append + list keeps insertion order even within one millisecond', async () => {
  const id = await createConversation('  Chi phí thuốc  ', 1000);
  await appendMessage(
    { conversationId: id, role: 'user', content: 'a', status: 'pending' },
    2000,
  );
  await appendMessage(
    { conversationId: id, role: 'assistant', content: 'b', status: 'sent' },
    2000,
  );
  await appendMessage(
    { conversationId: id, role: 'user', content: 'c', status: 'sent' },
    2000,
  );
  expect((await listMessages(id)).map(m => m.content)).toEqual(['a', 'b', 'c']);
  const c = await getConversation(id);
  expect(c).toMatchObject({
    title: 'Chi phí thuốc',
    createdAt: 1000,
    updatedAt: 2000,
    summary: null,
    summarizedUpto: 0,
  });
});

test('title is capped and never empty', async () => {
  const long = await createConversation('x'.repeat(200));
  expect((await getConversation(long))?.title).toHaveLength(60);
  const blank = await createConversation('   ');
  expect((await getConversation(blank))?.title).toBe('Cuộc trò chuyện');
});

test('conversations list newest activity first', async () => {
  const a = await createConversation('A', 1);
  const b = await createConversation('B', 2);
  await appendMessage(
    { conversationId: a, role: 'user', content: 'x', status: 'sent' },
    3,
  );
  expect((await listConversations()).map(c => c.id)).toEqual([a, b]);
  expect(await listConversations(1)).toHaveLength(1);
});

test('status flips, completeTurn is one unit, delete message', async () => {
  const id = await createConversation('T');
  const q = await appendMessage({
    conversationId: id,
    role: 'user',
    content: 'q',
    status: 'pending',
  });
  await setMessageStatus(q, 'failed');
  expect((await listMessages(id))[0].status).toBe('failed');
  await setMessageStatus(q, 'pending');
  await completeTurn(id, q, 'answer');
  const msgs = await listMessages(id);
  expect(msgs.map(m => [m.role, m.status])).toEqual([
    ['user', 'sent'],
    ['assistant', 'sent'],
  ]);
  await deleteMessage(msgs[1].id);
  expect(await listMessages(id)).toHaveLength(1);
});

test('summary and covered index are stored together', async () => {
  const id = await createConversation('T');
  await setSummary(id, 'Tóm tắt', 4);
  expect(await getConversation(id)).toMatchObject({
    summary: 'Tóm tắt',
    summarizedUpto: 4,
  });
});

test('delete one conversation removes its messages only; delete all empties both tables', async () => {
  const a = await createConversation('A');
  const b = await createConversation('B');
  await appendMessage({
    conversationId: a,
    role: 'user',
    content: 'x',
    status: 'sent',
  });
  await appendMessage({
    conversationId: b,
    role: 'user',
    content: 'y',
    status: 'sent',
  });
  await deleteConversation(a);
  expect(await getConversation(a)).toBeNull();
  expect(count('chat_message')).toBe(1);
  await deleteAllConversations();
  expect(count('chat_conversation')).toBe(0);
  expect(count('chat_message')).toBe(0);
});

test('device-local: chat never touches change_log', async () => {
  const before = count('change_log');
  const id = await createConversation('T');
  const q = await appendMessage({
    conversationId: id,
    role: 'user',
    content: 'q',
    status: 'pending',
  });
  await completeTurn(id, q, 'a');
  await setSummary(id, 's', 2);
  await deleteConversation(id);
  expect(count('change_log')).toBe(before);
});

test('role and status are constrained by the schema', async () => {
  const id = await createConversation('T');
  expect(() =>
    raw
      .prepare(
        "INSERT INTO chat_message VALUES ('m', ?, 'system', 'x', 1, 'sent')",
      )
      .run(id),
  ).toThrow();
  expect(() =>
    raw
      .prepare(
        "INSERT INTO chat_message VALUES ('m', ?, 'user', 'x', 1, 'weird')",
      )
      .run(id),
  ).toThrow();
});

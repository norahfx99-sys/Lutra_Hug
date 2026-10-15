import { setDb } from '../../care-cost/db';
import { installFakeDb } from '../../care-cost/fakeDb.testutil';
import {
  appendMessage,
  createConversation,
  getConversation,
  setMessageStatus,
} from './chatRepo';
import type { AiProvider, AiRequest, ChatTurn } from './providers';
import {
  SUMMARY_SYSTEM,
  fallbackSummary,
  foldSummary,
  summarizeIfNeeded,
} from './summary';

afterEach(() => setDb(null));

const fake = (reply: string | Error) => {
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

const turns: ChatTurn[] = [
  { role: 'user', content: 'Tháng này chi bao nhiêu?' },
  { role: 'assistant', content: 'Tổng 400.000 đ.' },
];

describe('foldSummary', () => {
  test('uses one provider call with the summarisation prompt, previous summary and new turns', async () => {
    const { provider, calls } = fake('  Đã chi 400.000 đ.  ');
    const r = await foldSummary(provider, 'Trước đó: hỏi về thuốc.', turns);
    expect(r).toEqual({ summary: 'Đã chi 400.000 đ.', fallback: false });
    expect(calls).toHaveLength(1);
    expect(calls[0].system).toBe(SUMMARY_SYSTEM);
    expect(SUMMARY_SYSTEM).toMatch(/150 từ/);
    expect(calls[0].messages).toHaveLength(1);
    const body = calls[0].messages[0].content;
    expect(body).toContain('Trước đó: hỏi về thuốc.');
    expect(body).toContain('Phụ huynh: Tháng này chi bao nhiêu?');
    expect(body).toContain('Trợ lý: Tổng 400.000 đ.');
  });

  test.each([
    ['provider throws', new Error('boom')],
    ['empty reply', '   '],
  ])('falls back deterministically when %s', async (_n, reply) => {
    const { provider } = fake(reply);
    const r = await foldSummary(provider, 'Cũ.', turns);
    expect(r.fallback).toBe(true);
    expect(r.summary).toBe(fallbackSummary('Cũ.', turns));
    expect(r.summary).toContain('Cũ.');
    expect(r.summary).toContain('Phụ huynh: Tháng này chi bao nhiêu?');
  });
});

describe('fallbackSummary', () => {
  test('is capped, drops the oldest lines first and clips long lines', () => {
    const many: ChatTurn[] = Array.from({ length: 60 }, (_, i) => ({
      role: i % 2 ? 'assistant' : 'user',
      content: `lượt-${i} ${'z'.repeat(300)}`,
    }));
    const s = fallbackSummary(null, many);
    expect(s.length).toBeLessThanOrEqual(1200);
    expect(s).toContain('lượt-59');
    expect(s).not.toContain('lượt-0 ');
    expect(fallbackSummary(null, many)).toBe(s);
  });
});

async function conversationWith(n: number) {
  await installFakeDb();
  const id = await createConversation('T');
  for (let i = 0; i < n; i++)
    await appendMessage(
      {
        conversationId: id,
        role: i % 2 ? 'assistant' : 'user',
        content: `m${i}`,
        status: 'sent',
      },
      1000 + i,
    );
  return id;
}

describe('summarizeIfNeeded', () => {
  test('does nothing while everything fits in the last K', async () => {
    const id = await conversationWith(6);
    const { provider, calls } = fake('S');
    expect(await summarizeIfNeeded(id, provider, 6)).toBe(false);
    expect(calls).toHaveLength(0);
  });

  test('folds only what is older than the last K and remembers how far it got', async () => {
    const id = await conversationWith(10);
    const { provider, calls } = fake('Tóm tắt 1');
    expect(await summarizeIfNeeded(id, provider, 6)).toBe(true);
    expect(await getConversation(id)).toMatchObject({
      summary: 'Tóm tắt 1',
      summarizedUpto: 4,
    });
    const sent = calls[0].messages[0].content;
    expect(sent).toContain('m0');
    expect(sent).toContain('m3');
    expect(sent).not.toContain('m4'); // still inside the verbatim window

    // Already covered: no second call until another full exchange falls out of the window.
    expect(await summarizeIfNeeded(id, provider, 6)).toBe(false);
    expect(calls).toHaveLength(1);
  });

  test('second fold gets the previous summary and only the new turns', async () => {
    const id = await conversationWith(10);
    const first = fake('Tóm tắt 1');
    await summarizeIfNeeded(id, first.provider, 6);
    for (const [i, role] of [
      [10, 'user'],
      [11, 'assistant'],
    ] as const)
      await appendMessage(
        {
          conversationId: id,
          role: i === 10 ? 'user' : role,
          content: `m${i}`,
          status: 'sent',
        },
        1000 + i,
      );
    const second = fake('Tóm tắt 2');
    expect(await summarizeIfNeeded(id, second.provider, 6)).toBe(true);
    const body = second.calls[0].messages[0].content;
    expect(body).toContain('Tóm tắt 1');
    expect(body).toContain('m4');
    expect(body).toContain('m5');
    expect(body).not.toContain('m3');
    expect((await getConversation(id))?.summarizedUpto).toBe(6);
  });

  test('provider failure: deterministic summary is stored, index advances, nothing throws', async () => {
    const id = await conversationWith(10);
    const { provider } = fake(new Error('offline'));
    await expect(summarizeIfNeeded(id, provider, 6)).resolves.toBe(true);
    const c = await getConversation(id);
    expect(c?.summarizedUpto).toBe(4);
    expect(c?.summary).toContain('Phụ huynh: m0');
    expect(c?.summary).toContain('Trợ lý: m3');
  });

  test('failed and pending messages are not part of the history', async () => {
    const id = await conversationWith(10);
    const extra = await appendMessage(
      {
        conversationId: id,
        role: 'user',
        content: 'never answered',
        status: 'pending',
      },
      5000,
    );
    await setMessageStatus(extra, 'failed');
    const { provider, calls } = fake('S');
    await summarizeIfNeeded(id, provider, 6);
    expect(calls[0].messages[0].content).not.toContain('never answered');
    expect((await getConversation(id))?.summarizedUpto).toBe(4);
  });

  test('unknown conversation is a no-op', async () => {
    await installFakeDb();
    expect(await summarizeIfNeeded('nope', fake('S').provider, 6)).toBe(false);
  });
});

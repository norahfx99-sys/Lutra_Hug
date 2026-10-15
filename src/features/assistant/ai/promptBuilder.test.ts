import {
  DATA_CLOSE,
  DATA_OPEN,
  SUMMARY_HEADING,
  SYSTEM_PROMPT,
  buildRequest,
  estimateTokens,
  normalizeTurns,
} from './promptBuilder';
import type { ChatTurn } from './providers';

const turn = (role: ChatTurn['role'], content: string): ChatTurn => ({
  role,
  content,
});
const sections = ['TOTALS', 'BUDGET', 'PREV', 'CHILDREN', 'RECENT'];

test('estimate is chars / 3.5, rounded up', () => {
  expect(estimateTokens('a'.repeat(7))).toBe(2);
  expect(estimateTokens('a'.repeat(8))).toBe(3);
  expect(estimateTokens('')).toBe(0);
});

test('system prompt carries the rules: data only, no medical advice, 115 / 111, Vietnamese', () => {
  expect(SYSTEM_PROMPT).toMatch(/Chỉ dùng số liệu/);
  expect(SYSTEM_PROMPT).toMatch(/Không chẩn đoán/);
  expect(SYSTEM_PROMPT).toMatch(/115/);
  expect(SYSTEM_PROMPT).toMatch(/111/);
  expect(SYSTEM_PROMPT).toMatch(/tiếng Việt/);
});

test('order: system rules, data block, summary, recent turns, then the question last', () => {
  const r = buildRequest({
    context: sections,
    summary: 'Đã bàn về thuốc.',
    turns: [turn('user', 'Q1'), turn('assistant', 'A1')],
    question: 'Q2',
  });
  const s = r.system;
  expect(s.indexOf(SYSTEM_PROMPT)).toBe(0);
  expect(s.indexOf(DATA_OPEN)).toBeGreaterThan(s.indexOf(SYSTEM_PROMPT));
  expect(s.indexOf(DATA_CLOSE)).toBeGreaterThan(s.indexOf('RECENT'));
  expect(s.indexOf(SUMMARY_HEADING)).toBeGreaterThan(s.indexOf(DATA_CLOSE));
  expect(s).toContain('Đã bàn về thuốc.');
  expect(r.messages).toEqual([
    turn('user', 'Q1'),
    turn('assistant', 'A1'),
    turn('user', 'Q2'),
  ]);
});

test('no summary section when there is no summary', () => {
  const r = buildRequest({
    context: sections,
    summary: '  ',
    turns: [],
    question: 'Q',
  });
  expect(r.system).not.toContain(SUMMARY_HEADING);
});

test('turns are normalized: leading assistant dropped, repeats merged, still ends on the question', () => {
  expect(
    normalizeTurns([
      turn('assistant', 'orphan'),
      turn('user', 'a'),
      turn('user', 'b'),
      turn('assistant', 'c'),
    ]),
  ).toEqual([turn('user', 'a\n\nb'), turn('assistant', 'c')]);
  const r = buildRequest({
    context: [],
    summary: null,
    turns: [turn('user', 'failed earlier')],
    question: 'again',
  });
  expect(r.messages).toEqual([turn('user', 'failed earlier\n\nagain')]);
});

describe('token budget', () => {
  const longSection = (name: string) => `${name} ${'x'.repeat(700)}`;
  const ctx = [
    'TOTALS',
    longSection('BUDGET'),
    longSection('PREV'),
    longSection('RECENT'),
  ];
  const turns = Array.from({ length: 6 }, (_, i) =>
    turn(i % 2 ? 'assistant' : 'user', `turn-${i} ${'y'.repeat(200)}`),
  );

  test('fits as is: nothing dropped', () => {
    const r = buildRequest({
      context: ctx,
      summary: 'S',
      turns,
      question: 'Q',
      maxInputTokens: 100_000,
    });
    expect(r.dropped).toEqual({ sections: 0, turns: 0, summary: false });
  });

  test('data block shrinks from the end BEFORE any recent turn is dropped', () => {
    const full = buildRequest({
      context: ctx,
      summary: null,
      turns,
      question: 'Q',
      maxInputTokens: 100_000,
    });
    const max = full.tokens - 250; // forces trimming roughly one long section
    const r = buildRequest({
      context: ctx,
      summary: null,
      turns,
      question: 'Q',
      maxInputTokens: max,
    });
    expect(r.tokens).toBeLessThanOrEqual(max);
    expect(r.dropped.sections).toBeGreaterThan(0);
    expect(r.dropped.turns).toBe(0);
    expect(r.system).toContain('TOTALS');
    expect(r.system).not.toContain('RECENT');
    expect(r.messages).toHaveLength(7);
  });

  test('then the oldest turns go, the newest and the question stay', () => {
    const r = buildRequest({
      context: ['TOTALS'],
      summary: null,
      turns,
      question: 'Q',
      maxInputTokens: estimateTokens(SYSTEM_PROMPT) + 220,
    });
    expect(r.dropped.turns).toBeGreaterThan(0);
    expect(r.messages[r.messages.length - 1]).toEqual(turn('user', 'Q'));
    expect(r.messages[0].role).toBe('user');
    expect(JSON.stringify(r.messages)).not.toContain('turn-0 ');
    expect(JSON.stringify(r.messages)).toContain('turn-5 ');
  });

  test('extreme budget still returns a request ending with the question', () => {
    const r = buildRequest({
      context: ctx,
      summary: 'S'.repeat(2000),
      turns,
      question: 'Q',
      maxInputTokens: estimateTokens(SYSTEM_PROMPT) + 5,
    });
    expect(r.tokens).toBeLessThanOrEqual(estimateTokens(SYSTEM_PROMPT) + 5);
    expect(r.dropped.summary).toBe(true);
    expect(r.messages).toEqual([turn('user', 'Q')]);
  });
});

test('hidden fields and keys never appear: only what the caller passes is rendered', () => {
  const r = buildRequest({
    context: ['Trẻ 1 100.000 đ'],
    summary: null,
    turns: [],
    question: 'Chi tiêu thế nào?',
  });
  const all = JSON.stringify(r);
  expect(all).not.toMatch(/sk-|api[_-]?key|Authorization|Bearer/i);
  expect(all).not.toContain('Nguyễn'); // a child's real name was never handed to the builder
});

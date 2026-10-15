import { getConversation, listMessages, setSummary } from './chatRepo';
import type { AiProvider, ChatTurn } from './providers';

// Rolling summary: turns older than the last K are folded into one running summary.

export const SUMMARY_SYSTEM = `Bạn tóm tắt cuộc trò chuyện giữa phụ huynh và trợ lý chăm sóc trẻ.
Viết tối đa 150 từ bằng tiếng Việt. Giữ lại sự kiện, con số, quyết định và việc còn dang dở. Không thêm thông tin mới. Chỉ trả về bản tóm tắt.`;

const SUMMARY_MAX_CHARS = 1200;
const LINE_MAX_CHARS = 160;

const clip = (s: string, n: number) =>
  s.length > n ? `${s.slice(0, n - 1)}…` : s;
const speaker = (t: ChatTurn) => (t.role === 'user' ? 'Phụ huynh' : 'Trợ lý');
const flat = (s: string) => s.replace(/\s+/g, ' ').trim();

/** Deterministic: previous summary + one clipped line per turn, oldest lines dropped past the cap. */
export function fallbackSummary(previous: string | null, older: ChatTurn[]) {
  const lines = [
    ...(previous ? previous.split('\n') : []),
    ...older.map(
      t => `${speaker(t)}: ${clip(flat(t.content), LINE_MAX_CHARS)}`,
    ),
  ];
  while (lines.length > 1 && lines.join('\n').length > SUMMARY_MAX_CHARS)
    lines.shift();
  return clip(lines.join('\n'), SUMMARY_MAX_CHARS);
}

export async function foldSummary(
  provider: AiProvider,
  previous: string | null,
  older: ChatTurn[],
  signal?: AbortSignal,
): Promise<{ summary: string; fallback: boolean }> {
  try {
    const text = await provider.chat({
      system: SUMMARY_SYSTEM,
      messages: [
        {
          role: 'user',
          content: `Tóm tắt hiện có:\n${
            previous ?? '(chưa có)'
          }\n\nCác lượt mới cần gộp vào:\n${older
            .map(t => `${speaker(t)}: ${clip(flat(t.content), 1500)}`)
            .join('\n')}`,
        },
      ],
      signal,
    });
    const summary = clip(text.trim(), SUMMARY_MAX_CHARS);
    if (!summary) throw new Error('empty');
    return { summary, fallback: false };
  } catch {
    // Any failure (network, key, bad JSON) must not cost the user their context.
    return { summary: fallbackSummary(previous, older), fallback: true };
  }
}

/**
 * Folds history[summarizedUpto : len-keep] into the summary. Waits for at least one full exchange
 * so it costs one extra call per exchange, not per message. Returns whether the summary advanced.
 */
export async function summarizeIfNeeded(
  conversationId: string,
  provider: AiProvider,
  keep: number,
  signal?: AbortSignal,
) {
  const c = await getConversation(conversationId);
  if (!c) return false;
  const history = (await listMessages(conversationId)).filter(
    m => m.status === 'sent',
  );
  const upto = history.length - keep;
  if (upto - c.summarizedUpto < 2) return false;
  const older = history
    .slice(c.summarizedUpto, upto)
    .map(m => ({ role: m.role, content: m.content }));
  const { summary } = await foldSummary(provider, c.summary, older, signal);
  await setSummary(conversationId, summary, upto);
  return true;
}

import {
  appendMessage,
  completeTurn,
  createConversation,
  deleteMessage,
  getConversation,
  listMessages,
  setMessageStatus,
} from './chatRepo';
import { buildContext } from './context';
import { buildRequest } from './promptBuilder';
import {
  AiError,
  createProvider,
  toAiError,
  type AiProvider,
} from './providers';
import { getApiKey, isConfigured, loadSettings } from './secure';
import { summarizeIfNeeded } from './summary';

// One turn = persist the question, build the request from on-device data, call the provider,
// persist the answer. The screen owns state; this owns the sequence.

let override: AiProvider | null = null;
/** Test seam: replaces the real network provider (and the key check). Pass null to restore. */
export const setProviderForTests = (p: AiProvider | null) => {
  override = p;
};
export const hasProviderOverride = () => override !== null;

export async function resolveProvider(): Promise<AiProvider> {
  if (override) return override;
  const [settings, key] = await Promise.all([loadSettings(), getApiKey()]);
  if (!key || !isConfigured(settings, true)) throw new AiError('no_key');
  return createProvider({
    kind: settings.provider,
    baseUrl: settings.baseUrl,
    model: settings.model.trim(),
    apiKey: key,
  });
}

/** Stores the question as 'pending'. A null conversation starts a new one titled by the question. */
export async function beginTurn(
  conversationId: string | null,
  question: string,
) {
  const id = conversationId ?? (await createConversation(question));
  const messageId = await appendMessage({
    conversationId: id,
    role: 'user',
    content: question,
    status: 'pending',
  });
  return { conversationId: id, messageId };
}

/** Retry replaces the failed message with a fresh one at the end: no duplicate question. */
export async function beginRetry(conversationId: string, failedId: string) {
  const failed = (await listMessages(conversationId)).find(
    m => m.id === failedId && m.role === 'user',
  );
  if (!failed) throw new Error('Message not found');
  await deleteMessage(failedId);
  return {
    question: failed.content,
    ...(await beginTurn(conversationId, failed.content)),
  };
}

export async function answerTurn(t: {
  conversationId: string;
  messageId: string;
  question: string;
  signal?: AbortSignal;
}) {
  let provider: AiProvider;
  let keep: number;
  try {
    provider = await resolveProvider();
    const settings = await loadSettings();
    keep = settings.historyWindow;
    const conv = await getConversation(t.conversationId);
    const history = (await listMessages(t.conversationId))
      .filter(m => m.status === 'sent')
      .map(m => ({ role: m.role, content: m.content }));
    const req = buildRequest({
      context: await buildContext(settings),
      summary: conv?.summary ?? null,
      turns: history.slice(conv?.summarizedUpto ?? 0),
      question: t.question,
    });
    const answer = await provider.chat({
      system: req.system,
      messages: req.messages,
      signal: t.signal,
    });
    await completeTurn(t.conversationId, t.messageId, answer);
  } catch (e) {
    await setMessageStatus(t.messageId, 'failed').catch(() => {});
    throw toAiError(e);
  }
  // Best effort and off the critical path: the answer is already on screen.
  summarizeIfNeeded(t.conversationId, provider, keep).catch(() => {});
}

// Which conversation the Conversation screen opens (route params carry only `prompt`).
// Callers set it right before navigating; null = a new conversation.
let openId: string | null = null;
export const openConversation = (id: string | null) => {
  openId = id;
};
export const peekOpenConversation = () => openId;

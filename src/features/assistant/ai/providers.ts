// Two fetch-based adapters. The family's own key goes straight from the phone to their provider.
// Never log request/response bodies, headers or the key anywhere in this file.

export type ChatTurn = { role: 'user' | 'assistant'; content: string };
export type AiRequest = {
  system: string;
  messages: ChatTurn[];
  signal?: AbortSignal;
};
export interface AiProvider {
  chat(req: AiRequest): Promise<string>;
}

export type AiErrorKind =
  | 'no_key'
  | 'unauthorized'
  | 'rate_limited'
  | 'network'
  | 'timeout'
  | 'bad_response'
  | 'aborted';

export const AI_ERROR_MESSAGES: Record<AiErrorKind, string> = {
  no_key: 'Chưa có khóa API. Hãy thiết lập trợ lý AI trước.',
  unauthorized: 'Khóa API không được chấp nhận. Hãy kiểm tra lại khóa.',
  rate_limited:
    'Nhà cung cấp AI đang giới hạn lượt gọi hoặc hết hạn mức. Hãy chờ một lát rồi thử lại.',
  network: 'Không kết nối được tới dịch vụ AI. Hãy kiểm tra mạng rồi thử lại.',
  timeout: 'Dịch vụ AI trả lời quá lâu. Hãy thử lại.',
  bad_response:
    'Dịch vụ AI trả về phản hồi không dùng được. Hãy kiểm tra địa chỉ máy chủ và tên mô hình.',
  aborted: 'Đã dừng. Bạn có thể thử lại.',
};

export class AiError extends Error {
  constructor(public kind: AiErrorKind) {
    super(AI_ERROR_MESSAGES[kind]);
    this.name = 'AiError';
  }
}

/** Anything thrown that is not already an AiError becomes a generic, non-leaking one. */
export const toAiError = (e: unknown) =>
  e instanceof AiError ? e : new AiError('bad_response');

export type ProviderKind = 'openai' | 'anthropic';

export const DEFAULT_BASE_URL: Record<ProviderKind, string> = {
  openai: 'https://api.openai.com/v1',
  anthropic: 'https://api.anthropic.com',
};

export const HTTPS_MESSAGE =
  'Địa chỉ máy chủ phải bắt đầu bằng https:// (Android chặn kết nối không mã hóa).';

/** null = valid. */
export function validateBaseUrl(url: string): string | null {
  const u = url.trim();
  if (!u) return 'Vui lòng nhập địa chỉ máy chủ.';
  if (!/^https:\/\/[^\s/]+/i.test(u)) return HTTPS_MESSAGE;
  if (/\s/.test(u)) return 'Địa chỉ máy chủ không được chứa khoảng trắng.';
  return null;
}

export type ProviderConfig = {
  kind: ProviderKind;
  baseUrl: string;
  model: string;
  apiKey: string;
  timeoutMs?: number;
  maxTokens?: number;
};

const DEFAULT_TIMEOUT_MS = 60_000;

const trimSlash = (s: string) => s.trim().replace(/\/+$/, '');

/** fetch + timeout + caller abort, with every failure mapped to an AiError. */
async function post(
  url: string,
  headers: Record<string, string>,
  body: unknown,
  signal: AbortSignal | undefined,
  timeoutMs: number,
): Promise<unknown> {
  if (signal?.aborted) throw new AiError('aborted');
  const ctl = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    ctl.abort();
  }, timeoutMs);
  const onAbort = () => ctl.abort();
  signal?.addEventListener('abort', onAbort);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify(body),
      signal: ctl.signal as RequestInit['signal'],
    });
    if (res.status === 401 || res.status === 403)
      throw new AiError('unauthorized');
    if (res.status === 429) throw new AiError('rate_limited');
    if (res.status >= 500) throw new AiError('network');
    if (!res.ok) throw new AiError('bad_response');
    try {
      return await res.json();
    } catch (e) {
      // An abort/timeout while the body streams in must not read as "bad JSON".
      if (ctl.signal.aborted) throw e;
      throw new AiError('bad_response');
    }
  } catch (e) {
    if (e instanceof AiError) throw e;
    if (timedOut) throw new AiError('timeout');
    if (signal?.aborted || ctl.signal.aborted) throw new AiError('aborted');
    throw new AiError('network');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null;

function nonEmpty(text: string) {
  const t = text.trim();
  if (!t) throw new AiError('bad_response');
  return t;
}

function openAiText(json: unknown): string {
  const choices = isObj(json) ? json.choices : null;
  const msg =
    Array.isArray(choices) && isObj(choices[0]) ? choices[0].message : null;
  const content = isObj(msg) ? msg.content : null;
  if (typeof content === 'string') return nonEmpty(content);
  // Some gateways return content parts.
  if (Array.isArray(content))
    return nonEmpty(
      content
        .map(p => (isObj(p) && typeof p.text === 'string' ? p.text : ''))
        .join(''),
    );
  throw new AiError('bad_response');
}

function anthropicText(json: unknown): string {
  const blocks = isObj(json) ? json.content : null;
  if (!Array.isArray(blocks)) throw new AiError('bad_response');
  return nonEmpty(
    blocks
      .map(b =>
        isObj(b) && b.type === 'text' && typeof b.text === 'string'
          ? b.text
          : '',
      )
      .join(''),
  );
}

/** OpenAI-compatible /chat/completions: OpenAI, OpenRouter, Gemini's compat endpoint, gateways. */
export function createOpenAiProvider(c: ProviderConfig): AiProvider {
  const base = trimSlash(c.baseUrl);
  return {
    async chat({ system, messages, signal }) {
      const json = await post(
        `${base}/chat/completions`,
        { Authorization: `Bearer ${c.apiKey}` },
        {
          model: c.model,
          messages: [{ role: 'system', content: system }, ...messages],
        },
        signal,
        c.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      );
      return openAiText(json);
    },
  };
}

/** Anthropic Messages API. Base may be given with or without a trailing /v1. */
export function createAnthropicProvider(c: ProviderConfig): AiProvider {
  const base = trimSlash(c.baseUrl);
  const url = base.endsWith('/v1') ? `${base}/messages` : `${base}/v1/messages`;
  return {
    async chat({ system, messages, signal }) {
      const json = await post(
        url,
        { 'x-api-key': c.apiKey, 'anthropic-version': '2023-06-01' },
        {
          model: c.model,
          max_tokens: c.maxTokens ?? 1024,
          system,
          messages,
        },
        signal,
        c.timeoutMs ?? DEFAULT_TIMEOUT_MS,
      );
      return anthropicText(json);
    },
  };
}

export function createProvider(c: ProviderConfig): AiProvider {
  const bad = validateBaseUrl(c.baseUrl);
  if (bad) throw new AiError('bad_response');
  return c.kind === 'anthropic'
    ? createAnthropicProvider(c)
    : createOpenAiProvider(c);
}

import {
  AI_ERROR_MESSAGES,
  AiError,
  HTTPS_MESSAGE,
  createAnthropicProvider,
  createOpenAiProvider,
  createProvider,
  validateBaseUrl,
  type AiErrorKind,
} from './providers';

const KEY = 'sk-secret-key-123';
const base = { model: 'm', apiKey: KEY };
const req = {
  system: 'SYS',
  messages: [{ role: 'user' as const, content: 'xin chào' }],
};

const fetchMock = () => global.fetch as unknown as jest.Mock;
const reply = (status: number, body: unknown, badJson = false) =>
  fetchMock().mockResolvedValueOnce({
    status,
    ok: status >= 200 && status < 300,
    json: async () => {
      if (badJson) throw new SyntaxError('bad json');
      return body;
    },
  });
const kindOf = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return e instanceof AiError ? e.kind : `other:${String(e)}`;
  }
  return 'resolved';
};

beforeEach(() => {
  global.fetch = jest.fn() as unknown as typeof fetch;
});

describe('OpenAI-compatible adapter', () => {
  const p = createOpenAiProvider({
    ...base,
    kind: 'openai',
    baseUrl: 'https://api.example.com/v1/',
  });

  test('success: url, bearer auth, system message first, no Anthropic header', async () => {
    reply(200, { choices: [{ message: { content: ' Chào bạn ' } }] });
    expect(await p.chat(req)).toBe('Chào bạn');
    const [url, init] = fetchMock().mock.calls[0];
    expect(url).toBe('https://api.example.com/v1/chat/completions');
    expect(init.headers.Authorization).toBe(`Bearer ${KEY}`);
    expect(init.headers['x-api-key']).toBeUndefined();
    const body = JSON.parse(init.body);
    expect(body.model).toBe('m');
    expect(body.messages).toEqual([
      { role: 'system', content: 'SYS' },
      { role: 'user', content: 'xin chào' },
    ]);
  });

  test('accepts content given as parts', async () => {
    reply(200, {
      choices: [{ message: { content: [{ text: 'a' }, { text: 'b' }] } }],
    });
    expect(await p.chat(req)).toBe('ab');
  });

  test.each<[number, AiErrorKind]>([
    [401, 'unauthorized'],
    [403, 'unauthorized'],
    [429, 'rate_limited'],
    [503, 'network'],
    [404, 'bad_response'],
  ])('HTTP %i -> %s', async (status, kind) => {
    reply(status, {});
    expect(await kindOf(p.chat(req))).toBe(kind);
  });

  test('network failure', async () => {
    fetchMock().mockRejectedValueOnce(new TypeError('Network request failed'));
    expect(await kindOf(p.chat(req))).toBe('network');
  });

  test('bad JSON and wrong shapes are bad_response', async () => {
    reply(200, null, true);
    expect(await kindOf(p.chat(req))).toBe('bad_response');
    reply(200, { choices: [] });
    expect(await kindOf(p.chat(req))).toBe('bad_response');
    reply(200, { choices: [{ message: { content: '   ' } }] });
    expect(await kindOf(p.chat(req))).toBe('bad_response');
  });
});

describe('Anthropic adapter', () => {
  const make = (baseUrl: string) =>
    createAnthropicProvider({ ...base, kind: 'anthropic', baseUrl });

  test('success: x-api-key, version header, system at top level', async () => {
    reply(200, {
      content: [
        { type: 'text', text: 'Xin ' },
        { type: 'tool_use' },
        { type: 'text', text: 'chào' },
      ],
    });
    expect(await make('https://api.anthropic.com').chat(req)).toBe('Xin chào');
    const [url, init] = fetchMock().mock.calls[0];
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(init.headers['x-api-key']).toBe(KEY);
    expect(init.headers['anthropic-version']).toBe('2023-06-01');
    expect(init.headers.Authorization).toBeUndefined();
    const body = JSON.parse(init.body);
    expect(body.system).toBe('SYS');
    expect(body.messages).toEqual(req.messages);
    expect(body.max_tokens).toBeGreaterThan(0);
  });

  test('base URL already ending in /v1 is not doubled', async () => {
    reply(200, { content: [{ type: 'text', text: 'ok' }] });
    await make('https://gw.example.com/v1').chat(req);
    expect(fetchMock().mock.calls[0][0]).toBe(
      'https://gw.example.com/v1/messages',
    );
  });

  test('errors map the same way', async () => {
    const p = make('https://api.anthropic.com');
    reply(401, {});
    expect(await kindOf(p.chat(req))).toBe('unauthorized');
    reply(200, { content: 'nope' });
    expect(await kindOf(p.chat(req))).toBe('bad_response');
  });
});

describe('abort and timeout', () => {
  const p = createOpenAiProvider({
    ...base,
    kind: 'openai',
    baseUrl: 'https://api.example.com/v1',
    timeoutMs: 30,
  });
  // A fetch that never answers; it rejects the way real fetch does once its signal aborts.
  const hang = () =>
    fetchMock().mockImplementationOnce(
      (_u: string, init: { signal: AbortSignal }) =>
        new Promise((_res, rej) =>
          init.signal.addEventListener('abort', () =>
            rej(new Error('Aborted')),
          ),
        ),
    );

  test('caller signal aborts an in-flight request', async () => {
    hang();
    const ctl = new AbortController();
    const pending = kindOf(p.chat({ ...req, signal: ctl.signal as never }));
    ctl.abort();
    expect(await pending).toBe('aborted');
  });

  test('already-aborted signal never calls fetch', async () => {
    const ctl = new AbortController();
    ctl.abort();
    expect(await kindOf(p.chat({ ...req, signal: ctl.signal as never }))).toBe(
      'aborted',
    );
    expect(fetchMock()).not.toHaveBeenCalled();
  });

  test('no answer within the timeout', async () => {
    hang();
    expect(await kindOf(p.chat(req))).toBe('timeout');
  });
});

describe('https only', () => {
  test('validateBaseUrl', () => {
    expect(validateBaseUrl('https://api.openai.com/v1')).toBeNull();
    expect(validateBaseUrl('HTTPS://x.example')).toBeNull();
    expect(validateBaseUrl('http://10.0.0.5:11434/v1')).toBe(HTTPS_MESSAGE);
    expect(validateBaseUrl('api.openai.com')).toBe(HTTPS_MESSAGE);
    expect(validateBaseUrl('https://')).toBe(HTTPS_MESSAGE);
    expect(validateBaseUrl('  ')).toMatch(/nhập/);
    expect(HTTPS_MESSAGE).toMatch(/https/);
  });

  test('createProvider refuses cleartext', () => {
    expect(() =>
      createProvider({ ...base, kind: 'openai', baseUrl: 'http://x.example' }),
    ).toThrow(AiError);
  });
});

test('every error kind has a Vietnamese message and the key is never in it', () => {
  for (const kind of Object.keys(AI_ERROR_MESSAGES) as AiErrorKind[]) {
    expect(new AiError(kind).message.length).toBeGreaterThan(10);
    expect(new AiError(kind).message).not.toContain(KEY);
  }
});

test('nothing is logged while calling the provider', async () => {
  const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map(m =>
    jest.spyOn(console, m).mockImplementation(() => {}),
  );
  const p = createOpenAiProvider({
    ...base,
    kind: 'openai',
    baseUrl: 'https://api.example.com/v1',
  });
  reply(200, { choices: [{ message: { content: 'ok' } }] });
  await p.chat(req);
  reply(401, {});
  await kindOf(p.chat(req));
  for (const s of spies) expect(s).not.toHaveBeenCalled();
  spies.forEach(s => s.mockRestore());
});

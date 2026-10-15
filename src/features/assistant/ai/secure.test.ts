import * as Keychain from 'react-native-keychain';
import { getDb, setDb } from '../../care-cost/db';
import { installFakeDb } from '../../care-cost/fakeDb.testutil';
import {
  DEFAULT_SETTINGS,
  clearApiKey,
  consentScope,
  getApiKey,
  giveConsent,
  hasApiKey,
  hasConsent,
  isConfigured,
  loadSettings,
  saveApiKey,
  saveSettings,
} from './secure';

// In-memory keychain: one slot per service, like the real one.
jest.mock('react-native-keychain', () => {
  const store = new Map<string, { username: string; password: string }>();
  return {
    ACCESSIBLE: {
      AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY:
        'AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY',
    },
    getGenericPassword: jest.fn(
      async ({ service }: { service: string }) => store.get(service) ?? false,
    ),
    setGenericPassword: jest.fn(
      async (username: string, password: string, o: { service: string }) => {
        store.set(o.service, { username, password });
        return { service: o.service, storage: 'mock' };
      },
    ),
    resetGenericPassword: jest.fn(async ({ service }: { service: string }) => {
      store.delete(service);
      return true;
    }),
    __store: store,
  };
});

const KEY = 'sk-live-very-secret';
let raw: Awaited<ReturnType<typeof installFakeDb>>;
beforeEach(async () => {
  raw = await installFakeDb();
  await clearApiKey();
  jest.clearAllMocks();
});
afterEach(() => setDb(null));

test('key round-trips through the keychain with the dedicated service and the db-key policy', async () => {
  expect(await hasApiKey()).toBe(false);
  await saveApiKey(`  ${KEY}  `);
  expect(await hasApiKey()).toBe(true);
  expect(await getApiKey()).toBe(KEY);
  expect(Keychain.setGenericPassword).toHaveBeenCalledWith('ai', KEY, {
    service: 'lutra-hug.ai-key',
    accessible: 'AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY',
  });
  await clearApiKey();
  expect(await hasApiKey()).toBe(false);
  expect(await getApiKey()).toBeNull();
});

test('an empty key is refused', async () => {
  await expect(saveApiKey('   ')).rejects.toThrow();
  expect(await hasApiKey()).toBe(false);
});

test('the key never reaches SQLite, even after settings are saved', async () => {
  await saveApiKey(KEY);
  await saveSettings({
    ...DEFAULT_SETTINGS,
    model: 'gpt-x',
    shareChildNames: true,
  });
  await giveConsent(await loadSettings());
  const tables = raw
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all() as { name: string }[];
  for (const { name } of tables)
    expect(
      JSON.stringify(raw.prepare(`SELECT * FROM ${name}`).all()),
    ).not.toContain(KEY);
});

test('defaults: aggregate totals only, nothing else shared', async () => {
  const s = await loadSettings();
  expect(s).toEqual(DEFAULT_SETTINGS);
  expect(s.shareChildNames).toBe(false);
  expect(s.shareDescriptions).toBe(false);
  expect(s.baseUrl).toMatch(/^https:/);
  expect(s.model).toBe('');
});

test('non-secret settings live in meta under the ai. prefix and round-trip', async () => {
  const s = {
    provider: 'anthropic' as const,
    baseUrl: ' https://api.anthropic.com ',
    model: ' some-model ',
    shareChildNames: true,
    shareDescriptions: true,
    historyWindow: 10,
  };
  await saveSettings(s);
  expect(await loadSettings()).toEqual({
    ...s,
    baseUrl: 'https://api.anthropic.com',
    model: 'some-model',
  });
  const keys = (
    await getDb().execute("SELECT key FROM meta WHERE key LIKE 'ai.%'")
  ).rows.map(r => r.key);
  expect(keys.sort()).toEqual(
    [
      'ai.baseUrl',
      'ai.historyWindow',
      'ai.model',
      'ai.provider',
      'ai.shareChildNames',
      'ai.shareDescriptions',
    ].sort(),
  );
});

test('garbage stored values fall back to defaults', async () => {
  await getDb().execute(
    "INSERT INTO meta (key, value) VALUES ('ai.provider', 'x'), ('ai.historyWindow', '999')",
  );
  const s = await loadSettings();
  expect(s.provider).toBe('openai');
  expect(s.historyWindow).toBe(6);
});

test('configured needs key, model and an https base URL', () => {
  const ok = { ...DEFAULT_SETTINGS, model: 'm' };
  expect(isConfigured(ok, true)).toBe(true);
  expect(isConfigured(ok, false)).toBe(false);
  expect(isConfigured({ ...ok, model: ' ' }, true)).toBe(false);
  expect(isConfigured({ ...ok, baseUrl: 'http://x.example' }, true)).toBe(
    false,
  );
});

test('consent is bound to what is shared and where it goes', async () => {
  const s = { ...DEFAULT_SETTINGS, model: 'm' };
  expect(await hasConsent(s)).toBe(false);
  await giveConsent(s);
  expect(await hasConsent(s)).toBe(true);
  expect(await hasConsent({ ...s, model: 'other-model' })).toBe(true); // model is not a scope change
  expect(await hasConsent({ ...s, shareChildNames: true })).toBe(false);
  expect(await hasConsent({ ...s, shareDescriptions: true })).toBe(false);
  expect(
    await hasConsent({ ...s, baseUrl: 'https://elsewhere.example/v1' }),
  ).toBe(false);
  expect(consentScope(s)).not.toContain('sk-');
});

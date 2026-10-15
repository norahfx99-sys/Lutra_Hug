import * as Keychain from 'react-native-keychain';
import { emit, getDb } from '../../care-cost/db';
import {
  DEFAULT_BASE_URL,
  validateBaseUrl,
  type ProviderKind,
} from './providers';

// The API key lives ONLY in the keychain. Everything else (non-secret) is in `meta` under 'ai.*'.
// Neither this file nor its callers may put the key in SQLite, state, logs or prompts.

const KEY_SERVICE = 'lutra-hug.ai-key';

export async function getApiKey(): Promise<string | null> {
  const saved = await Keychain.getGenericPassword({ service: KEY_SERVICE });
  return saved ? saved.password : null;
}

export async function hasApiKey() {
  return (await getApiKey()) !== null;
}

export async function saveApiKey(key: string) {
  const k = key.trim();
  if (!k) throw new Error('Empty key');
  const ok = await Keychain.setGenericPassword('ai', k, {
    service: KEY_SERVICE,
    accessible: Keychain.ACCESSIBLE.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  });
  if (!ok) throw new Error('Could not store API key');
  emit();
}

export async function clearApiKey() {
  await Keychain.resetGenericPassword({ service: KEY_SERVICE });
  emit();
}

export type AiSettings = {
  provider: ProviderKind;
  baseUrl: string;
  model: string;
  shareChildNames: boolean;
  shareDescriptions: boolean;
  /** Recent messages sent verbatim; older ones are folded into the rolling summary. */
  historyWindow: number;
};

export const HISTORY_WINDOWS = [4, 6, 10] as const;

export const DEFAULT_SETTINGS: AiSettings = {
  provider: 'openai',
  baseUrl: DEFAULT_BASE_URL.openai,
  model: '',
  shareChildNames: false,
  shareDescriptions: false,
  historyWindow: 6,
};

const P = 'ai.';

export async function loadSettings(): Promise<AiSettings> {
  const { rows } = await getDb().execute(
    `SELECT key, value FROM meta WHERE key LIKE 'ai.%'`,
  );
  const m = new Map(rows.map(r => [String(r.key), String(r.value)]));
  const d = DEFAULT_SETTINGS;
  const provider = m.get(`${P}provider`);
  const win = Number(m.get(`${P}historyWindow`));
  return {
    provider: provider === 'anthropic' ? 'anthropic' : d.provider,
    baseUrl: m.get(`${P}baseUrl`) ?? d.baseUrl,
    model: m.get(`${P}model`) ?? d.model,
    shareChildNames: m.get(`${P}shareChildNames`) === '1',
    shareDescriptions: m.get(`${P}shareDescriptions`) === '1',
    historyWindow: (HISTORY_WINDOWS as readonly number[]).includes(win)
      ? win
      : d.historyWindow,
  };
}

export async function saveSettings(s: AiSettings) {
  const entries: [string, string][] = [
    ['provider', s.provider],
    ['baseUrl', s.baseUrl.trim()],
    ['model', s.model.trim()],
    ['shareChildNames', s.shareChildNames ? '1' : '0'],
    ['shareDescriptions', s.shareDescriptions ? '1' : '0'],
    ['historyWindow', String(s.historyWindow)],
  ];
  await getDb().transaction(async tx => {
    for (const [k, v] of entries)
      await tx.execute(
        'INSERT OR REPLACE INTO meta (key, value) VALUES (?, ?)',
        [P + k, v],
      );
  });
  emit();
}

export const isConfigured = (s: AiSettings, hasKey: boolean) =>
  hasKey && s.model.trim() !== '' && validateBaseUrl(s.baseUrl) === null;

// Consent covers exactly one scope: what is shared and where it goes. Changing either asks again.
export const consentScope = (s: AiSettings) =>
  JSON.stringify([
    s.baseUrl.trim().toLowerCase(),
    s.shareChildNames,
    s.shareDescriptions,
  ]);

export async function hasConsent(s: AiSettings) {
  const { rows } = await getDb().execute(
    "SELECT value FROM meta WHERE key = 'ai.consent'",
  );
  return rows[0] !== undefined && String(rows[0].value) === consentScope(s);
}

export async function giveConsent(s: AiSettings) {
  await getDb().execute(
    "INSERT OR REPLACE INTO meta (key, value) VALUES ('ai.consent', ?)",
    [consentScope(s)],
  );
  emit();
}

import { useQuery } from '../../care-cost/hooks';
import { hasProviderOverride } from './chat';
import { listConversations, listMessages } from './chatRepo';
import { loadSnapshot } from './context';
import { hasApiKey, hasConsent, isConfigured, loadSettings } from './secure';

export const useAiSetup = () =>
  useQuery(async () => {
    const [settings, hasKey] = await Promise.all([loadSettings(), hasApiKey()]);
    return {
      settings,
      hasKey,
      ready: hasProviderOverride() || isConfigured(settings, hasKey),
      consented: await hasConsent(settings),
    };
  }, []);

export const useConversations = () => useQuery(() => listConversations(), []);

export const useMessages = (conversationId: string | null) =>
  useQuery(
    async () => (conversationId ? listMessages(conversationId) : []),
    [conversationId],
  );

export const useSnapshot = () => useQuery(() => loadSnapshot(new Date()), []);

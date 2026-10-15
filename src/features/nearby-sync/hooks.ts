import { getDb } from '../care-cost/db';
import { useQuery } from '../care-cost/hooks';
import { listConflicts } from './engine';
import { readSyncInfo } from './session';

export const useConflicts = () => useQuery(() => listConflicts(getDb()), []);
export const useSyncInfo = () => useQuery(() => readSyncInfo(getDb()), []);

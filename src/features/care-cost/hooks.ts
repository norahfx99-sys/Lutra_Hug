import { useEffect, useState, useSyncExternalStore } from 'react';
import { getRevision, openDb, subscribe } from './db';
import { forChild, type Month } from './domain';
import {
  childAllocationCounts,
  getFamily,
  getMonthlyBudget,
  getOnboarded,
  listChildren,
  listExpenses,
} from './repo';

/** Re-runs `load` whenever a write commits (emit) or `deps` change. data is undefined while loading. */
export function useQuery<T>(load: () => Promise<T>, deps: unknown[]) {
  const revision = useSyncExternalStore(subscribe, getRevision);
  const [state, setState] = useState<{ data?: T; error?: unknown }>({});
  useEffect(() => {
    let live = true;
    openDb()
      .then(load)
      .then(
        data => live && setState({ data }),
        error => live && setState({ error }),
      );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revision, ...deps]);
  return state;
}

export const useOnboarded = () => useQuery(getOnboarded, []);
export const useFamily = () => useQuery(getFamily, []);
export const useChildren = () => useQuery(listChildren, []);
export const useMonthlyBudget = (month: Month) =>
  useQuery(() => getMonthlyBudget(month), [month]);

/** Expenses of a month; with childId, only those allocated to that child (use amountFor for the share). */
export const useExpenses = (month: Month, childId?: string) =>
  useQuery(
    async () => forChild(await listExpenses(month), childId),
    [month, childId],
  );
export const useAllocationCounts = () => useQuery(childAllocationCounts, []);

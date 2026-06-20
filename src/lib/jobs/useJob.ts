"use client";

import useSWR from "swr";

const jsonFetcher = (url: string) =>
  fetch(url).then((r) => {
    if (!r.ok) throw new Error(`Request failed: ${r.status}`);
    return r.json();
  });

/**
 * Polls a status endpoint on an interval, automatically halting once `isDone`
 * returns true (SWR `refreshInterval` returns 0). Pass `url = null` to pause.
 */
export function useJob<T>(
  url: string | null,
  isDone: (data: T) => boolean,
  intervalMs = 3000,
) {
  const { data, error } = useSWR<T>(url, jsonFetcher, {
    refreshInterval: (latest) => (latest && isDone(latest) ? 0 : intervalMs),
    revalidateOnFocus: false,
  });
  return { data, error, done: !!data && isDone(data) };
}

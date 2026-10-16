import { useCallback, useEffect, useRef, useState } from 'react';
import { subscribe } from '../services';

interface State<T> { data?: T; error?: string; loading: boolean }

/** Loads async data, exposes loading/error state, and refetches when any store changes. */
export function useQuery<T>(fetcher: () => Promise<T>, deps: unknown[] = []) {
  const [state, setState] = useState<State<T>>({ loading: true });
  const seq = useRef(0);
  const fetchRef = useRef(fetcher);
  fetchRef.current = fetcher;

  const run = useCallback((silent: boolean) => {
    const id = ++seq.current;
    if (!silent) setState((s) => ({ data: s.data, loading: true }));
    fetchRef.current().then(
      (data) => id === seq.current && setState({ data, loading: false }),
      (e: unknown) => id === seq.current && setState({ error: e instanceof Error ? e.message : String(e), loading: false }),
    );
  }, []);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { run(false); }, [run, ...deps]);
  useEffect(() => subscribe(() => run(true)), [run]);
  return { ...state, reload: () => run(false) };
}

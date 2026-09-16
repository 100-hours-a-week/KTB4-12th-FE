import { useCallback, useEffect, useRef, useState } from 'react';

import type { CursorPage } from '../api/pagination';

export function useCursorList<T>(
  loader: (cursor: string | null) => Promise<CursorPage<T>>,
  resetKey: string,
) {
  const [items, setItems] = useState<T[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasNext, setHasNext] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestId = useRef(0);

  const load = useCallback(
    async (reset = false) => {
      if (loading || (!reset && !hasNext)) return;
      const currentRequest = ++requestId.current;
      setLoading(true);
      setError(null);
      try {
        const page = await loader(reset ? null : cursor);
        if (currentRequest !== requestId.current) return;
        setItems((current) => (reset ? page.items : [...current, ...page.items]));
        setCursor(page.pagination.nextCursor);
        setHasNext(page.pagination.hasNext);
      } catch (reason) {
        if (currentRequest !== requestId.current) return;
        setError(reason instanceof Error ? reason.message : '목록을 불러오지 못했습니다.');
      } finally {
        if (currentRequest === requestId.current) setLoading(false);
      }
    },
    [cursor, hasNext, loader, loading],
  );

  useEffect(() => {
    const currentRequest = ++requestId.current;
    setItems([]);
    setCursor(null);
    setHasNext(true);
    setError(null);
    const timer = window.setTimeout(async () => {
      setLoading(true);
      try {
        const page = await loader(null);
        if (currentRequest !== requestId.current) return;
        setItems(page.items);
        setCursor(page.pagination.nextCursor);
        setHasNext(page.pagination.hasNext);
      } catch (reason) {
        if (currentRequest !== requestId.current) return;
        setError(reason instanceof Error ? reason.message : '목록을 불러오지 못했습니다.');
      } finally {
        if (currentRequest === requestId.current) setLoading(false);
      }
    }, 180);
    return () => {
      window.clearTimeout(timer);
      requestId.current += 1;
    };
  }, [loader, resetKey]);

  return {
    items,
    hasNext,
    loading,
    error,
    loadMore: () => void load(false),
    retry: () => void load(items.length === 0),
  };
}

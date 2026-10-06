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
  const [committedResetKey, setCommittedResetKey] = useState(resetKey);

  // resetKey(검색어/정렬/필터 조합)가 바뀌면 렌더 중에 즉시 cursor/loading을 리셋한다.
  // 이 리셋을 effect에서 하면 "새 loader + 이전 cursor"가 함께 커밋되는 렌더가 한 번
  // 생기고, 그 사이 하단 센티널이 loadMore를 부르면 새 필터/정렬 조건에 이전 cursor가
  // 섞여 400 에러가 난다. 렌더 중 리셋은 같은 렌더 패스에서 끝나 그런 중간 상태가
  // 커밋되거나 effect/ref에 노출될 일이 없다. (ref 대신 state로 이전 값을 추적해야
  // 렌더 중 접근/변경이 금지된 react-hooks/refs 규칙에 걸리지 않는다.)
  if (committedResetKey !== resetKey) {
    setCommittedResetKey(resetKey);
    setItems([]);
    setCursor(null);
    setHasNext(true);
    setError(null);
    setLoading(true);
  }

  const load = useCallback(
    async (reset = false) => {
      if (loading || (!reset && !hasNext)) return;
      const currentRequest = ++requestId.current;
      setLoading(true);
      setError(null);
      try {
        const page = await loader(reset ? null : cursor);
        if (currentRequest !== requestId.current) return;
        const items = Array.isArray(page?.items) ? page.items : [];
        const pagination = page?.pagination ?? { nextCursor: null, hasNext: false };
        setItems((current) => (reset ? items : [...current, ...items]));
        setCursor(pagination.nextCursor);
        setHasNext(pagination.hasNext);
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
    // cursor/loading 리셋은 이미 렌더 중에 끝났다. 여기서는 리셋된 이후의 requestId를
    // 그대로 이어받아, 디바운스 대기 중 더 최신 resetKey가 들어오면 무효화되게 한다.
    const currentRequest = requestId.current;
    const timer = window.setTimeout(async () => {
      if (currentRequest !== requestId.current) return;
      try {
        const page = await loader(null);
        if (currentRequest !== requestId.current) return;
        const items = Array.isArray(page?.items) ? page.items : [];
        const pagination = page?.pagination ?? { nextCursor: null, hasNext: false };
        setItems(items);
        setCursor(pagination.nextCursor);
        setHasNext(pagination.hasNext);
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

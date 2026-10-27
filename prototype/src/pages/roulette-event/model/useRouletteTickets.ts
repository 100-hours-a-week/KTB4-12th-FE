import { useCallback, useEffect, useRef, useState } from 'react';

import {
  attendRoulette,
  fetchRouletteStatus,
  type RouletteStatus,
} from '../../../entities/roulette';
import { ApiError } from '../../../shared/api/client';

export function useRouletteTickets() {
  const [status, setStatus] = useState<RouletteStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const mounted = useRef(false);
  const busy = useRef(false);
  const queued = useRef(false);
  const resetTimer = useRef<number | undefined>(undefined);

  const refresh = useCallback(async function refreshTickets() {
    if (!mounted.current) return;
    if (busy.current) {
      queued.current = true;
      return;
    }
    busy.current = true;
    window.clearTimeout(resetTimer.current);
    setLoading(true);
    setError('');
    try {
      await attendRoulette();
      const next = await fetchRouletteStatus();
      if (!mounted.current) return;
      setStatus(next);
      const delay = Date.parse(next.nextResetAt) - Date.parse(next.serverTime);
      if (Number.isFinite(delay) && delay > 0) {
        resetTimer.current = window.setTimeout(() => void refreshTickets(), delay + 1000);
      }
    } catch (reason) {
      if (!mounted.current) return;
      setStatus(null);
      const disabled = reason instanceof ApiError && reason.status === 503;
      setError(
        disabled
          ? '룰렛 이벤트를 준비 중이에요.'
          : reason instanceof Error
            ? reason.message
            : '참여권을 확인하지 못했어요. 다시 시도해 주세요.',
      );
    } finally {
      busy.current = false;
      if (mounted.current) {
        setLoading(false);
        if (queued.current) {
          queued.current = false;
          void refreshTickets();
        }
      }
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    const timer = window.setTimeout(() => void refresh(), 0);
    let visible = document.visibilityState === 'visible';
    const onVisible = () => {
      const next = document.visibilityState === 'visible';
      if (next && !visible) void refresh();
      visible = next;
    };
    const onPageHide = () => {
      visible = false;
    };
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('pageshow', onVisible);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      mounted.current = false;
      window.clearTimeout(timer);
      window.clearTimeout(resetTimer.current);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('pageshow', onVisible);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, [refresh]);

  return { status, loading, error, refresh };
}

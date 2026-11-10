import { useEffect, useRef, useState } from 'react';

import { type RouletteStatus, spinRoulette } from '../../../entities/roulette';
import { ApiError } from '../../../shared/api/client';
import { getSessionVersion } from '../../../shared/api/session';
import { clearPendingSpin, prepareSpin, readPendingSpin } from './pendingSpin';
import {
  hasRouletteBoard,
  nextRouletteRotation,
  rouletteBoundaryCount,
  type RouletteGeometry,
  rouletteGeometry,
  type RouletteResult,
  rouletteResult,
} from './rewards';
import { createRouletteSound } from './sound';

export function useRoulette({
  userId,
  status,
  refresh,
}: {
  userId: number | null;
  status: RouletteStatus | null;
  refresh: () => Promise<void>;
}) {
  const wheel = useRef<HTMLDivElement>(null);
  const labels = useRef<HTMLDivElement>(null);
  const rotation = useRef(0);
  const busy = useRef(false);
  const request = useRef<AbortController | null>(null);
  const mounted = useRef(true);
  const animations = useRef<Animation[]>([]);
  const frame = useRef(0);
  const sound = useRef<ReturnType<typeof createRouletteSound> | null>(null);
  const soundOn = useRef(true);
  const [spinning, setSpinning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [result, setResult] = useState<RouletteResult | null>(null);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(() => {
    try {
      return userId !== null && readPendingSpin(userId) !== null;
    } catch {
      return true;
    }
  });
  const boardReady = hasRouletteBoard(status);
  const currentGeometry = rouletteGeometry(
    boardReady ? status!.segments!.map((segment) => segment.probability) : [1, 1, 1, 1, 1, 1],
  );
  const [spinGeometry, setSpinGeometry] = useState<RouletteGeometry | null>(null);
  const geometry = spinGeometry ?? currentGeometry;
  const canSpin = userId !== null && (pending || (boardReady && status!.remaining > 0));

  useEffect(() => {
    mounted.current = true;
    const onVisibility = () => sound.current?.updateGain();
    const onPageHide = () => sound.current?.dispose();
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', onPageHide);
    return () => {
      mounted.current = false;
      request.current?.abort();
      cancelAnimationFrame(frame.current);
      animations.current.forEach((animation) => animation.cancel());
      sound.current?.dispose();
      sound.current = null;
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', onPageHide);
    };
  }, []);

  function getSound() {
    sound.current ??= createRouletteSound();
    sound.current.setEnabled(soundOn.current);
    return sound.current;
  }

  function toggleSound() {
    soundOn.current = !soundOn.current;
    const audio = getSound();
    if (soundOn.current && !audio.unlock()) soundOn.current = false;
    audio.setEnabled(soundOn.current);
    setSoundEnabled(soundOn.current);
  }

  async function spin() {
    if (!canSpin || busy.current || !wheel.current || !labels.current) return;
    const version = getSessionVersion();
    const isCurrent = () => mounted.current && version === getSessionVersion();
    const activeGeometry = currentGeometry;
    setSpinGeometry(activeGeometry);
    busy.current = true;
    setSpinning(true);
    setResult(null);
    setError('');
    try {
      const audio = getSound();
      if (soundOn.current && !audio.unlock()) {
        soundOn.current = false;
        setSoundEnabled(false);
      }
      const key = prepareSpin(userId!);
      setPending(true);
      const controller = new AbortController();
      request.current = controller;
      const timeout = window.setTimeout(() => controller.abort(), 30_000);
      let response;
      try {
        response = await spinRoulette(key, controller.signal);
      } finally {
        window.clearTimeout(timeout);
        request.current = null;
      }
      if (!isCurrent()) return;
      const reward = rouletteResult(response);
      void refresh();
      const from = rotation.current;
      const target = nextRouletteRotation(from, reward.index, activeGeometry);
      const options: KeyframeAnimationOptions = {
        duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 150 : 5200,
        easing: 'cubic-bezier(.12,.68,.12,1)',
        fill: 'forwards',
      };
      const frames = [{ transform: `rotate(${from}deg)` }, { transform: `rotate(${target}deg)` }];
      const captions = Array.from(
        labels.current.querySelectorAll<HTMLElement>('.roulette-prize-label'),
      );
      animations.current = [
        wheel.current.animate(frames, options),
        labels.current.animate(frames, options),
        ...captions.map((caption) =>
          caption.animate(
            [
              { transform: `translate(-50%,-50%) rotate(${-from}deg)` },
              { transform: `translate(-50%,-50%) rotate(${-target}deg)` },
            ],
            options,
          ),
        ),
      ];
      const animation = animations.current[0];
      let previous = rouletteBoundaryCount(from, activeGeometry);
      function tick() {
        const progress = animation.effect?.getComputedTiming().progress;
        if (progress != null) {
          const sector = rouletteBoundaryCount(from + (target - from) * progress, activeGeometry);
          if (sector !== previous) {
            audio.tick();
            previous = sector;
          }
        }
        if (animation.playState === 'running') frame.current = requestAnimationFrame(tick);
      }
      frame.current = requestAnimationFrame(tick);
      await animation.finished;
      if (!isCurrent()) return;
      rotation.current = target;
      wheel.current.style.transform = `rotate(${target}deg)`;
      labels.current.style.transform = `rotate(${target}deg)`;
      captions.forEach((caption) => {
        caption.style.transform = `translate(-50%,-50%) rotate(${-target}deg)`;
      });
      setResult(reward);
      if (reward.won) audio.win();
    } catch (reason) {
      if (!isCurrent()) return;
      const rejected =
        reason instanceof ApiError &&
        (reason.code === 'ROULETTE_TICKET_NOT_AVAILABLE' || reason.code === 'INVALID_REQUEST');
      if (rejected && userId !== null) {
        try {
          clearPendingSpin(userId);
          setPending(false);
        } catch {
          /* 같은 키를 유지한다. */
        }
        void refresh();
      }
      setSpinGeometry(null);
      setError(
        reason instanceof Error && reason.name === 'AbortError'
          ? '응답이 지연되고 있어요. 결과 다시 확인을 눌러 주세요.'
          : reason instanceof ApiError
            ? reason.status === 503
              ? '룰렛 이벤트를 준비 중이에요. 잠시 후 다시 확인해 주세요.'
              : rejected
                ? reason.message
                : '실행 결과를 확인하지 못했어요. 결과 다시 확인을 눌러 주세요.'
            : reason instanceof Error
              ? reason.message
              : '룰렛 결과를 다시 확인해 주세요.',
      );
    } finally {
      cancelAnimationFrame(frame.current);
      animations.current.forEach((animation) => animation.cancel());
      animations.current = [];
      busy.current = false;
      if (isCurrent()) setSpinning(false);
    }
  }

  function dismissResult() {
    if (userId !== null) {
      try {
        clearPendingSpin(userId);
      } catch {
        setError('결과 확인을 저장하지 못했어요. 다시 확인해 주세요.');
        return;
      }
    }
    setPending(false);
    setResult(null);
    setSpinGeometry(null);
  }

  return {
    canSpin,
    pending,
    boardReady,
    geometry,
    wheel,
    labels,
    spinning,
    soundEnabled,
    toggleSound,
    spin,
    result,
    error,
    dismissResult,
  };
}

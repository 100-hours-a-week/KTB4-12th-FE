import { type RefObject, useCallback, useEffect, useState } from 'react';

import { useKeyboard } from '../../../mobile';
import { Toast } from '../../../shared/ui';
import { captureScreen } from '../captureScreen';
import { formatErrorsAsText, getCollectedErrors } from '../errorCollector';
import { sendBugReport } from '../sendBugReport';
import { BugReportModal } from './BugReportModal';

type BugReportWidgetProps = {
  /** 캡처·토스트의 기준이 되는 앱 화면 요소. 생략하면 document.body를 캡처한다. */
  containerRef?: RefObject<HTMLElement | null>;
  /** true면 production 빌드에서도 위젯을 렌더링한다. */
  enabledInProduction?: boolean;
  /** true면 하단 탭바 위로 버튼을 띄운다. false면 화면 최하단 우측에 붙는다. */
  raised?: boolean;
};

export function BugReportWidget({
  containerRef,
  enabledInProduction = false,
  raised = false,
}: BugReportWidgetProps) {
  const enabled = import.meta.env.DEV || enabledInProduction;
  const keyboard = useKeyboard();
  const [open, setOpen] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [screenshot, setScreenshot] = useState<Blob | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  // 캡처는 모달을 열기 전에 끝낸다 — 모달이 스크린샷에 찍히면 안 된다.
  const openReport = useCallback(async () => {
    keyboard.hide();
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    setCapturing(true);
    const shot = await captureScreen(containerRef?.current ?? document.body);
    setScreenshot(shot);
    setCapturing(false);
    setOpen(true);
  }, [keyboard, containerRef]);

  useEffect(() => {
    if (!enabled) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || !event.shiftKey) return;
      if (event.key.toLowerCase() !== 'b') return;
      event.preventDefault();
      if (!open && !capturing) void openReport();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, open, capturing, openReport]);

  const handleSubmit = async (message: string, includeScreenshot: boolean): Promise<boolean> => {
    try {
      await sendBugReport({
        message,
        screenshot: includeScreenshot ? screenshot : null,
        errorsText: formatErrorsAsText(),
        context: {
          pageUrl: window.location.href,
          route: window.location.pathname + window.location.hash,
          viewport: `${window.innerWidth} x ${window.innerHeight}`,
          userAgent: navigator.userAgent,
          reportedAt: new Date().toISOString(),
          errorCount: getCollectedErrors().length,
        },
      });
      setToast('버그 제보가 전송됐어요. 고마워요!');
      return true;
    } catch (error) {
      setToast(error instanceof Error ? error.message : '전송에 실패했어요. 다시 시도해 주세요.');
      return false;
    }
  };

  if (!enabled) return null;

  return (
    <>
      <button
        type="button"
        className={raised ? 'bug-report-fab raised' : 'bug-report-fab'}
        data-bug-report-widget
        aria-label="버그 제보"
        disabled={capturing}
        onClick={() => void openReport()}
      >
        {capturing ? <span className="loading-dot" /> : '🐞'}
      </button>
      {open ? (
        <BugReportModal
          screenshot={screenshot}
          onClose={() => setOpen(false)}
          onSubmit={handleSubmit}
        />
      ) : null}
      <Toast message={toast} container={containerRef?.current} />
    </>
  );
}

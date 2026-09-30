import { type CSSProperties, type RefObject, useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

import { useKeyboard, useMobileDevice } from '../../../mobile';
import { Toast } from '../../../shared/ui';
import { captureScreen } from '../captureScreen';
import { formatErrorsAsText, getCollectedErrors } from '../errorCollector';
import { type ReportCategory, sendBugReport } from '../sendBugReport';
import { BugReportModal } from './BugReportModal';

type BugReportWidgetProps = {
  route: string;
  /** 캡처·토스트의 기준이 되는 앱 화면 요소. 생략하면 document.body를 캡처한다. */
  containerRef?: RefObject<HTMLElement | null>;
  /** true면 production 빌드에서도 위젯을 렌더링한다. */
  enabledInProduction?: boolean;
  /** true면 하단 탭바 위로 버튼을 띄운다. false면 화면 최하단 우측에 붙는다. */
  raised?: boolean;
};

export function BugReportWidget({
  route,
  containerRef,
  enabledInProduction = false,
  raised = false,
}: BugReportWidgetProps) {
  const enabled = import.meta.env.DEV || enabledInProduction;
  const keyboard = useKeyboard();
  const { device } = useMobileDevice();
  const [open, setOpen] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [screenshot, setScreenshot] = useState<Blob | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [screenContainer, setScreenContainer] = useState<HTMLElement | null>(null);
  const [sheetContainer, setSheetContainer] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const screen = containerRef?.current;
    if (!screen) return;

    const updateSheetContainer = () => {
      setScreenContainer((current) => (current === screen ? current : screen));
      setSheetContainer(
        screen.querySelector<HTMLElement>('[data-testid="bottom-sheet"][data-state="open"]'),
      );
    };
    const observer = new MutationObserver(updateSheetContainer);
    updateSheetContainer();
    observer.observe(screen, {
      attributes: true,
      attributeFilter: ['data-state'],
      childList: true,
      subtree: true,
    });
    return () => observer.disconnect();
  }, [containerRef]);

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

  const handleSubmit = async (
    category: ReportCategory,
    message: string,
    includeScreenshot: boolean,
  ): Promise<boolean> => {
    try {
      await sendBugReport({
        category,
        message,
        screenshot: includeScreenshot ? screenshot : null,
        errorsText: formatErrorsAsText(),
        context: {
          reportId: crypto.randomUUID(),
          pageUrl: window.location.href,
          route,
          viewport: `${window.innerWidth} x ${window.innerHeight}`,
          userAgent: navigator.userAgent,
          reportedAt: new Date().toISOString(),
          errorCount: getCollectedErrors().length,
        },
      });
      setToast('소중한 의견 감사해요!');
      return true;
    } catch (error) {
      setToast(error instanceof Error ? error.message : '전송에 실패했어요. 다시 시도해 주세요.');
      return false;
    }
  };

  if (!enabled) return null;

  const trigger = (
    <button
      type="button"
      className={raised ? 'bug-report-fab raised' : 'bug-report-fab'}
      style={
        {
          '--app-safe-area-height': `${
            device.platform === 'ios' ? device.geometry.safeArea.bottom : 0
          }px`,
        } as CSSProperties
      }
      data-bug-report-widget
      aria-label="의견 남기기"
      disabled={capturing}
      onClick={() => void openReport()}
    >
      {capturing ? <span className="loading-dot" /> : '💬'}
    </button>
  );

  return (
    <>
      {sheetContainer ? createPortal(trigger, sheetContainer) : trigger}
      {open ? (
        <BugReportModal
          screenshot={screenshot}
          container={screenContainer}
          onClose={() => setOpen(false)}
          onSubmit={handleSubmit}
        />
      ) : null}
      <Toast message={toast} container={screenContainer} />
    </>
  );
}

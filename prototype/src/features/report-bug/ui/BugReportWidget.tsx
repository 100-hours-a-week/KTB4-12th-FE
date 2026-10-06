import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';

import { useKeyboard } from '../../../mobile';
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
  /** 선물 탭에서 AI 챗봇과 버그 리포트를 하나의 메뉴로 묶는다. */
  showAiAction?: boolean;
  onOpenAi?: () => void;
};

export function BugReportWidget({
  route,
  containerRef,
  enabledInProduction = false,
  raised = false,
  showAiAction = false,
  onOpenAi,
}: BugReportWidgetProps) {
  const enabled = import.meta.env.DEV || enabledInProduction;
  const keyboard = useKeyboard();
  const [open, setOpen] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [screenshot, setScreenshot] = useState<Blob | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!showAiAction || !menuOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (event.target instanceof Node && !menuRef.current?.contains(event.target)) {
        setMenuOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [menuOpen, showAiAction]);

  // 모달을 먼저 열고 캡처 결과는 뒤늦게 채운다. 캡처 필터가 위젯/모달을 제외한다.
  const openReport = useCallback(async () => {
    keyboard.hide();
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    setOpen(true);
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

  useEffect(() => {
    if (!enabled) return;
    const handleOpenRequest = () => {
      if (!open && !capturing) void openReport();
    };
    window.addEventListener('prototype:open-report', handleOpenRequest);
    return () => window.removeEventListener('prototype:open-report', handleOpenRequest);
  }, [capturing, enabled, open, openReport]);

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

  return (
    <>
      {showAiAction ? (
        <div
          ref={menuRef}
          className={raised ? 'floating-action-menu raised' : 'floating-action-menu'}
          data-bug-report-widget
        >
          {menuOpen ? (
            <div className="floating-action-options">
              <button
                type="button"
                className="floating-action-option ai"
                onClick={() => {
                  setMenuOpen(false);
                  onOpenAi?.();
                }}
              >
                🤖
              </button>
              <button
                type="button"
                className="floating-action-option report"
                disabled={capturing}
                onClick={() => {
                  setMenuOpen(false);
                  void openReport();
                }}
              >
                🐞
              </button>
            </div>
          ) : null}
          <button
            type="button"
            className="floating-action-toggle"
            aria-label={menuOpen ? '빠른 메뉴 닫기' : 'AI 챗봇 및 버그 리포트 열기'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((openState) => !openState)}
          >
            {menuOpen ? '×' : '🤖'}
          </button>
        </div>
      ) : (
        <button
          type="button"
          className={raised ? 'bug-report-fab raised' : 'bug-report-fab'}
          data-bug-report-widget
          aria-label="의견 남기기"
          disabled={capturing}
          onClick={() => void openReport()}
        >
          {capturing ? (
            <span className="loading-dot" />
          ) : (
            <>
              <span aria-hidden="true">🐞</span>
            </>
          )}
        </button>
      )}
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

import { type RefObject, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

import { useKeyboard } from '../../../mobile';
import { SUNJALAL_BOT_IMAGE, SUNJALAL_REPORT_IMAGE } from '../../../shared/config/assets';
import { Toast } from '../../../shared/ui';
import { type BugReportPayload, type ReportCategory, sendBugReport } from '../sendBugReport';
import { BugReportModal } from './BugReportModal';

type BugReportWidgetProps = {
  route: string;
  inline?: boolean;
  /** 모달·토스트의 기준이 되는 앱 화면 요소. */
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
  inline = false,
  containerRef,
  enabledInProduction = false,
  raised = false,
  showAiAction = false,
  onOpenAi,
}: BugReportWidgetProps) {
  const enabled = import.meta.env.DEV || enabledInProduction;
  const keyboard = useKeyboard();
  const [open, setOpen] = useState(false);
  const [modalHost, setModalHost] = useState<HTMLElement | null>(null);
  const pendingReport = useRef<BugReportPayload | null>(null);
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

  const openReport = useCallback(() => {
    keyboard.hide();
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    setModalHost(containerRef?.current ?? document.body);
    pendingReport.current = null;
    setOpen(true);
  }, [keyboard, containerRef]);

  useEffect(() => {
    if (!enabled) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || !event.shiftKey) return;
      if (event.key.toLowerCase() !== 'b') return;
      event.preventDefault();
      if (!open) void openReport();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [enabled, open, openReport]);

  useEffect(() => {
    if (!enabled) return;
    const handleOpenRequest = () => {
      if (!open) void openReport();
    };
    window.addEventListener('prototype:open-report', handleOpenRequest);
    return () => window.removeEventListener('prototype:open-report', handleOpenRequest);
  }, [enabled, open, openReport]);

  const handleSubmit = async (category: ReportCategory, message: string): Promise<boolean> => {
    if (
      !pendingReport.current ||
      pendingReport.current.category !== category ||
      pendingReport.current.description !== message
    ) {
      pendingReport.current = {
        reportId: crypto.randomUUID(),
        description: message,
        category,
        pageUrl: window.location.href,
        route,
        viewport: `${window.innerWidth} x ${window.innerHeight}`,
        userAgent: navigator.userAgent,
        reportedAt: new Date().toISOString(),
      };
    }
    try {
      await sendBugReport(pendingReport.current);
      pendingReport.current = null;
      setToast('의견이 접수됐어요. 감사합니다!');
      return true;
    } catch (error) {
      setToast(
        error instanceof Error ? error.message : '접수를 확인하지 못했어요. 다시 시도해 주세요.',
      );
      return false;
    }
  };

  if (!enabled) return null;

  return (
    <>
      <div className={inline ? 'feedback-inline' : undefined}>
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
                  aria-label="선잘알 봇 열기"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenAi?.();
                  }}
                >
                  <img src={SUNJALAL_BOT_IMAGE} alt="" draggable={false} />
                  <span className="floating-action-label" aria-hidden="true">
                    AI 선물 추천
                  </span>
                </button>
                <button
                  type="button"
                  className="floating-action-option report"
                  aria-label="의견 남기기"
                  onClick={() => {
                    setMenuOpen(false);
                    void openReport();
                  }}
                >
                  <img src={SUNJALAL_REPORT_IMAGE} alt="" draggable={false} />
                  <span className="floating-action-label" aria-hidden="true">
                    의견 보내기
                  </span>
                </button>
              </div>
            ) : null}
            <button
              type="button"
              className="floating-action-toggle"
              aria-label={menuOpen ? '빠른 메뉴 닫기' : '선잘알 봇 및 의견 메뉴 열기'}
              aria-expanded={menuOpen}
              onClick={() => {
                keyboard.hide();
                setMenuOpen((openState) => !openState);
              }}
            >
              {menuOpen ? '×' : <img src={SUNJALAL_BOT_IMAGE} alt="" draggable={false} />}
            </button>
          </div>
        ) : (
          <button
            type="button"
            className={`bug-report-fab${raised ? ' raised' : ''}${['login', 'signup', 'terms'].includes(route) ? ' auth' : ''}`}
            data-bug-report-widget
            aria-label="의견 남기기"
            onClick={() => void openReport()}
          >
            <img src={SUNJALAL_REPORT_IMAGE} alt="" draggable={false} />
          </button>
        )}
      </div>
      {open && modalHost
        ? createPortal(
            <BugReportModal onClose={() => setOpen(false)} onSubmit={handleSubmit} />,
            modalHost,
          )
        : null}
      <Toast message={toast} container={containerRef?.current} />
    </>
  );
}

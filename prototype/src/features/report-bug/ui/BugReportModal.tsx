import * as Dialog from '@radix-ui/react-dialog';
import { useEffect, useRef, useState } from 'react';

import { KeyboardTextarea } from '../../../mobile';
import type { ReportCategory } from '../sendBugReport';

const CATEGORIES: { id: ReportCategory; label: string }[] = [
  { id: 'bug', label: '🐞 버그' },
  { id: 'suggestion', label: '💡 제안' },
  { id: 'help', label: '🙋 도움' },
];

const PLACEHOLDERS: Record<ReportCategory, string> = {
  bug: '어떤 문제가 있었는지 구체적으로 적어주세요.\n\n예시)\n- 화면/영역: 선물 목록 > 우측 상단 필터 버튼\n- 재현: 필터 버튼을 눌렀더니 아무 반응이 없음\n- 기대 동작: 필터 시트가 열려야 함',
  suggestion:
    '이런 기능이 있으면 좋겠다 싶은 점을 자유롭게 적어주세요.\n\n예시)\n받은 선물을 평가할 때 사진도 남기고 싶어요',
  help: '무엇을 도와드릴까요?\n궁금한 점이나 막힌 점을 편하게 적어주세요.\n\n예시)\n- 아이디/비밀번호를 까먹었어요\n- 탈퇴하고 싶어요',
};

type BugReportModalProps = {
  screenshot: Blob | null;
  container?: HTMLElement | null;
  onClose: () => void;
  onSubmit: (
    category: ReportCategory,
    message: string,
    includeScreenshot: boolean,
  ) => Promise<boolean>;
};

export function BugReportModal({ screenshot, container, onClose, onSubmit }: BugReportModalProps) {
  const [category, setCategory] = useState<ReportCategory>('bug');
  const [message, setMessage] = useState('');
  const [includeScreenshot, setIncludeScreenshot] = useState(true);
  const [sending, setSending] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const overlayRef = useRef<HTMLDivElement>(null);

  // 도움 카테고리는 스크린샷을 받지 않는다 — 토글도 그리지 않는다.
  const showScreenshotRow = category !== 'help' && Boolean(screenshot);

  // object URL은 StrictMode 이중 마운트에서 revoke된 채 재사용될 수 있으므로
  // useMemo가 아니라 effect 안에서 생성·해제한다.
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!screenshot) return;
    const url = URL.createObjectURL(screenshot);
    // Object URL 생성·해제는 브라우저 외부 자원과의 동기화이므로 effect에서 관리한다.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [screenshot]);

  const submit = async () => {
    const trimmed = message.trim();
    if (!trimmed || sending) return;
    setSending(true);
    // 실패 시 false를 반환하고 모달은 닫지 않는다 — 입력한 내용이 그대로 유지된다.
    const succeeded = await onSubmit(
      category,
      trimmed,
      showScreenshotRow && includeScreenshot && Boolean(screenshot),
    );
    setSending(false);
    if (succeeded) {
      setMessage('');
      onClose();
    }
  };

  return (
    <Dialog.Root
      open
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <Dialog.Portal container={container ?? undefined}>
        <Dialog.Content
          asChild
          aria-describedby={undefined}
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            window.requestAnimationFrame(() =>
              overlayRef.current
                ?.querySelector<HTMLTextAreaElement>('.bug-report-textarea')
                ?.focus({ preventScroll: true }),
            );
          }}
          onEscapeKeyDown={(event) => {
            if (!lightboxOpen) return;
            event.preventDefault();
            setLightboxOpen(false);
          }}
        >
          <div
            ref={overlayRef}
            className="bug-report-overlay"
            data-bug-report-widget
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) onClose();
            }}
          >
            <section className="bug-report-modal">
              <Dialog.Title asChild>
                <h2>의견 남기기</h2>
              </Dialog.Title>
              <div className="bug-report-categories" role="group" aria-label="의견 종류">
                {CATEGORIES.map(({ id, label }) => (
                  <button
                    key={id}
                    type="button"
                    className={category === id ? 'bug-report-chip selected' : 'bug-report-chip'}
                    aria-pressed={category === id}
                    onClick={() => setCategory(id)}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <KeyboardTextarea
                className="bug-report-textarea"
                autoFocus
                rows={6}
                maxLength={4000}
                placeholder={PLACEHOLDERS[category]}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
              />
              {showScreenshotRow ? (
                <div className="bug-report-screenshot-row">
                  <label className="bug-report-screenshot-toggle">
                    <input
                      type="checkbox"
                      checked={includeScreenshot}
                      onChange={(event) => setIncludeScreenshot(event.target.checked)}
                    />
                    <span>스크린샷 첨부</span>
                  </label>
                  {includeScreenshot && previewUrl ? (
                    <button
                      type="button"
                      className="bug-report-thumbnail"
                      aria-label="스크린샷 크게 보기"
                      onClick={() => setLightboxOpen(true)}
                    >
                      <img src={previewUrl} alt="캡처된 화면 미리보기" />
                    </button>
                  ) : null}
                </div>
              ) : null}
              {lightboxOpen && previewUrl ? (
                <div
                  className="bug-report-lightbox"
                  role="dialog"
                  aria-modal="true"
                  aria-label="스크린샷 크게 보기"
                  onMouseDown={(event) => {
                    if (event.target === event.currentTarget) setLightboxOpen(false);
                  }}
                >
                  <img src={previewUrl} alt="캡처된 화면 전체 보기" />
                  <button
                    type="button"
                    className="bug-report-lightbox-close"
                    aria-label="닫기"
                    onClick={() => setLightboxOpen(false)}
                  >
                    ✕
                  </button>
                </div>
              ) : null}
              <div className="dialog-actions">
                <button type="button" className="secondary" onClick={onClose} disabled={sending}>
                  취소
                </button>
                <button
                  type="button"
                  className="primary"
                  disabled={!message.trim() || sending}
                  onClick={() => void submit()}
                >
                  {sending ? '전송 중…' : '전송'}
                </button>
              </div>
            </section>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

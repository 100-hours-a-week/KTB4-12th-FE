import { useEffect, useState } from 'react';

import { KeyboardTextarea } from '../../../mobile';

type BugReportModalProps = {
  screenshot: Blob | null;
  onClose: () => void;
  onSubmit: (message: string, includeScreenshot: boolean) => Promise<boolean>;
};

export function BugReportModal({ screenshot, onClose, onSubmit }: BugReportModalProps) {
  const [message, setMessage] = useState('');
  const [includeScreenshot, setIncludeScreenshot] = useState(true);
  const [sending, setSending] = useState(false);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  // object URL은 StrictMode 이중 마운트에서 revoke된 채 재사용될 수 있으므로
  // useMemo가 아니라 effect 안에서 생성·해제한다.
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!screenshot) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(screenshot);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [screenshot]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      // 라이트박스가 열려 있으면 라이트박스만 닫고 모달은 유지한다.
      if (lightboxOpen) {
        setLightboxOpen(false);
        return;
      }
      onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, lightboxOpen]);

  const submit = async () => {
    const trimmed = message.trim();
    if (!trimmed || sending) return;
    setSending(true);
    // 실패 시 false를 반환하고 모달은 닫지 않는다 — 입력한 내용이 그대로 유지된다.
    const succeeded = await onSubmit(trimmed, includeScreenshot && Boolean(screenshot));
    setSending(false);
    if (succeeded) {
      setMessage('');
      onClose();
    }
  };

  return (
    <div
      className="bug-report-overlay"
      data-bug-report-widget
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        className="bug-report-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bug-report-title"
      >
        <h2 id="bug-report-title">버그 제보</h2>
        <KeyboardTextarea
          className="bug-report-textarea"
          autoFocus
          rows={6}
          maxLength={4000}
          placeholder={
            '어떤 문제가 있었는지 구체적으로 적어주세요.\n\n예시)\n- 화면/영역: 선물 목록 > 우측 상단 필터 버튼\n- 재현: 필터 버튼을 눌렀더니 아무 반응이 없음\n- 기대 동작: 필터 시트가 열려야 함'
          }
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
        {screenshot ? (
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
  );
}

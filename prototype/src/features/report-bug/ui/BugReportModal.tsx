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
  onClose: () => void;
  onSubmit: (category: ReportCategory, message: string) => Promise<boolean>;
};

export function BugReportModal({ onClose, onSubmit }: BugReportModalProps) {
  const [category, setCategory] = useState<ReportCategory>('bug');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const submitting = useRef(false);
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !submitting.current) onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);
  const submit = async () => {
    const trimmed = message.trim();
    if (!trimmed || submitting.current) return;
    submitting.current = true;
    setSending(true);
    try {
      if (await onSubmit(category, trimmed)) onClose();
    } finally {
      submitting.current = false;
      setSending(false);
    }
  };
  return (
    <div
      className="bug-report-overlay"
      data-bug-report-widget
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !submitting.current) onClose();
      }}
    >
      <section
        className="bug-report-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="bug-report-title"
      >
        <h2 id="bug-report-title">의견 남기기</h2>
        <div className="bug-report-categories" role="group" aria-label="의견 종류">
          {CATEGORIES.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={category === id ? 'bug-report-chip selected' : 'bug-report-chip'}
              disabled={sending}
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
          disabled={sending}
          placeholder={PLACEHOLDERS[category]}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
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

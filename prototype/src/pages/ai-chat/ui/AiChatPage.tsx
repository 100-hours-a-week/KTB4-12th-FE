import { KeyboardTextarea, useKeyboardInsets } from '../../../mobile';
import { ScreenHeader } from '../../../shared/ui';

export function AiChatPage({
  value,
  onChange,
  onBack,
  onUnavailable,
}: {
  value: string;
  onChange: (value: string) => void;
  onBack: () => void;
  onUnavailable: () => void;
}) {
  const { bottomInset } = useKeyboardInsets();

  return (
    <section className="page ai-chat-page">
      <ScreenHeader title="AI 챗봇" onBack={onBack} />
      <div className="ai-chat-thread" aria-live="polite">
        <div className="ai-chat-message assistant">
          <span className="ai-chat-avatar" aria-hidden="true">
            🤖
          </span>
          <div>
            <strong>AI 챗봇</strong>
            <p>안녕하세요! 선물 고민을 같이 해결해드릴게요.</p>
            <p>누구에게, 어떤 상황의 선물인지 알려주세요.</p>
          </div>
        </div>
        <div className="ai-chat-notice">
          특정 개인을 판단할 수 있는 개인정보는 입력하지 말아주세요.
        </div>
      </div>
      <div className="ai-chat-suggestions" aria-label="추천 질문">
        <button type="button" onClick={() => onChange('친한 친구의 생일 선물을 추천해줘')}>
          친구 생일 선물
        </button>
        <button type="button" onClick={() => onChange('5만원대 실용적인 선물을 추천해줘')}>
          5만원대 실용적인 선물
        </button>
      </div>
      <label
        className="ai-composer"
        data-scroll-drag="ignore"
        style={{ marginBottom: `calc(${bottomInset}px + 16px)` }}
      >
        <KeyboardTextarea
          value={value}
          maxLength={100}
          placeholder="메시지를 입력하세요..."
          onChange={(event) => onChange(event.target.value)}
        />
        <span className={value.length >= 100 ? 'limit' : value.length >= 90 ? 'warning' : ''}>
          {value.length}/100
        </span>
        <button
          type="button"
          aria-label="메시지 전송"
          disabled={!value.trim()}
          onClick={onUnavailable}
        >
          ↑
        </button>
      </label>
    </section>
  );
}

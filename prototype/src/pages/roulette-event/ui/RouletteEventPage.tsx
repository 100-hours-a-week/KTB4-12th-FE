import { type CSSProperties, useState } from 'react';
import { createPortal } from 'react-dom';

import { BottomSheet, useScreenPortal } from '../../../mobile';
import { AppDialog, ScreenHeader } from '../../../shared/ui';
import { ROULETTE_REWARDS } from '../model/rewards';
import { useRoulette } from '../model/useRoulette';
import { useRouletteTickets } from '../model/useRouletteTickets';

const assets = '/assets/roulette';
export function RouletteEventPage({
  onBack,
  userId,
}: {
  onBack: () => void;
  userId: number | null;
}) {
  const tickets = useRouletteTickets();
  const {
    canSpin,
    pending,
    boardReady,
    geometry,
    wheel,
    labels,
    spinning,
    soundEnabled,
    toggleSound,
    spin: startSpin,
    result,
    error,
    dismissResult,
  } = useRoulette({ userId, status: tickets.status, refresh: tickets.refresh });
  const [portal, setPortal] = useState<HTMLElement | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const { screenRef } = useScreenPortal();
  function spin() {
    setPortal(screenRef.current);
    void startSpin();
  }
  return (
    <section className="page roulette-event-page">
      <ScreenHeader
        title="룰렛 이벤트"
        onBack={onBack}
        action={
          <button
            type="button"
            className="roulette-sound"
            aria-label="룰렛 효과음"
            aria-pressed={soundEnabled}
            onClick={toggleSound}
          >
            소리 {soundEnabled ? '켜짐' : '꺼짐'}
          </button>
        }
      />
      <div className="roulette-event-banner">
        <div className="roulette-hero">
          <h2>
            오늘의 행운을<span>돌려봐!</span>
          </h2>
          <p>선물하는 즐거움에 보너스를 더해요</p>
          <div className="roulette-stage">
            <img
              className="roulette-pointer"
              src={`${assets}/pointer.webp`}
              alt="당첨 위치"
              draggable={false}
            />
            <div className="roulette-assembly">
              <img
                className="roulette-frame"
                src={`${assets}/frame.webp`}
                alt=""
                draggable={false}
              />
              <div
                ref={wheel}
                className="roulette-disc"
                style={{ backgroundImage: geometry.background }}
                role="img"
                aria-label={boardReady ? '2배·3배 쿠폰과 꽝 룰렛' : '준비 중인 룰렛 이벤트'}
              />
              <div ref={labels} className="roulette-labels" aria-hidden="true">
                {ROULETTE_REWARDS.map((reward, index) => (
                  <div
                    key={index}
                    className="roulette-prize-label"
                    data-sector-angle={geometry.sectors[index].width}
                    data-sector-center={geometry.sectors[index].center}
                    style={{
                      left: `${geometry.sectors[index].left}%`,
                      top: `${geometry.sectors[index].top}%`,
                      display: geometry.sectors[index].width === 0 ? 'none' : undefined,
                    }}
                  >
                    <strong>{boardReady ? reward.value : '?'}</strong>
                    <small>{boardReady ? reward.caption : '준비 중'}</small>
                  </div>
                ))}
              </div>
              <div className="roulette-hub-backplate" aria-hidden="true">
                <span />
              </div>
              <img
                className="roulette-hub"
                src={`${assets}/hub-source.webp`}
                alt=""
                draggable={false}
              />
            </div>
          </div>
        </div>
      </div>
      <div className="roulette-event-content">
        <button
          type="button"
          className="roulette-spin"
          disabled={!canSpin || spinning || (tickets.loading && !pending)}
          aria-busy={spinning}
          onClick={spin}
        >
          {spinning
            ? '두근두근, 행운을 찾는 중…'
            : pending
              ? '결과 다시 확인'
              : !boardReady
                ? '룰렛 추첨 준비 중'
                : tickets.status?.remaining === 0
                  ? '참여권이 없어요'
                  : '행운 돌리기'}
        </button>
        <p className="roulette-participation" role="status">
          {pending
            ? '미확정 결과가 있어요. 같은 요청으로 결과를 확인해 주세요.'
            : boardReady
              ? '참여권 1장으로 한 번씩, 보유한 만큼 참여할 수 있어요.'
              : '참여권은 모아 두고, 추첨이 열리면 사용할 수 있어요.'}
        </p>
        {error ? (
          <p className="roulette-error" role="alert">
            {error}
          </p>
        ) : null}
        <article className="roulette-ticket" aria-label="내 참여권" aria-busy={tickets.loading}>
          <div>
            <h3>내 참여권</h3>
            {tickets.loading ? <p role="status">참여권을 확인하고 있어요…</p> : null}
            {!tickets.loading && tickets.status ? (
              <div role="status">
                <p>남은 참여권 {tickets.status.remaining.toLocaleString()}장</p>
                <p>
                  오늘 출석 지급 {tickets.status.attendanceGranted}장 · 선물 지급{' '}
                  {tickets.status.giftGranted}장
                </p>
              </div>
            ) : null}
            {tickets.error ? <p role="alert">{tickets.error}</p> : null}
            <button
              type="button"
              className="roulette-rules-button"
              disabled={tickets.loading}
              onClick={() => void tickets.refresh()}
            >
              {tickets.error ? '다시 확인' : '참여권 새로고침'}
            </button>
          </div>
        </article>
        <button type="button" className="roulette-rules-button" onClick={() => setRulesOpen(true)}>
          이벤트 이용안내
        </button>
        <p className="roulette-disclaimer">미사용 참여권은 다음 날에도 유지돼요.</p>
      </div>
      <BottomSheet open={rulesOpen} onOpenChange={setRulesOpen} title="룰렛 이벤트 이용안내">
        <ul className="roulette-rules">
          <li>한국 시간 기준 매일 출석 참여권 1장을 지급해요.</li>
          <li>결제가 성공하고 선물 발송이 확정되면 보낸 사람에게 선물당 참여권 1장을 지급해요.</li>
          <li>미사용 참여권은 이월되며, 보유한 참여권만큼 참여할 수 있어요.</li>
          <li>전환 당일에 이미 출석 크레딧을 받았다면 참여권을 추가 지급하지 않아요.</li>
          {boardReady ? (
            <>
              <li>쿠폰은 선물 완료 보상에 1회 적용되며, 사용 만료 기한이 없어요.</li>
              <li>꽝도 참여권 1장을 사용해요.</li>
              {tickets.status?.segments?.map((segment) => (
                <li key={segment.segmentId}>
                  {segment.segmentId + 1}번 칸 · {ROULETTE_REWARDS[segment.segmentId].value} ·{' '}
                  {segment.probability}%
                </li>
              ))}
            </>
          ) : (
            <li>룰렛 추첨과 보상 지급은 준비 중이에요.</li>
          )}
        </ul>
        <button type="button" className="primary" onClick={() => setRulesOpen(false)}>
          확인했어요
        </button>
      </BottomSheet>
      {result && portal
        ? createPortal(
            <>
              {result.won ? (
                <div className="roulette-confetti" aria-hidden="true">
                  {Array.from({ length: 14 }, (_, index) => (
                    <img
                      key={index}
                      src="/assets/brand/sunjalal-app-icon.png"
                      alt=""
                      style={
                        {
                          '--confetti-x': `${(index * 37) % 100}%`,
                          '--confetti-delay': `${(index % 5) * 0.08}s`,
                        } as CSSProperties
                      }
                    />
                  ))}
                </div>
              ) : null}
              <AppDialog
                title={result.won ? '오늘의 행운 도착!' : '다음 행운을 기다려요'}
                confirmLabel="확인"
                cancelLabel="닫기"
                onCancel={dismissResult}
                onConfirm={dismissResult}
                body={
                  <span className="roulette-result">
                    <img src="/assets/brand/sunjalal-app-icon.png" alt="" />
                    <strong>{result.label}</strong>
                    <span>{result.description}</span>
                  </span>
                }
              />
            </>,
            portal,
          )
        : null}
    </section>
  );
}

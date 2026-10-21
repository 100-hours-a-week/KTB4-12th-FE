import { Pencil1Icon, StarFilledIcon, StarIcon, TrashIcon } from '@radix-ui/react-icons';
import { useEffect, useId, useState } from 'react';

import {
  createGiftReview,
  deleteGiftReview,
  fetchGiftReview,
  type GiftReview,
  updateGiftReview,
} from '../../../entities/review';
import { KeyboardTextarea, useKeyboard } from '../../../mobile';
import { ApiError } from '../../../shared/api/client';
import { AppDialog } from '../../../shared/ui';

function reviewError(reason: unknown) {
  if (!(reason instanceof ApiError)) return '리뷰를 처리하지 못했습니다. 다시 시도해 주세요.';
  if (reason.code === 'REVIEW_ALREADY_EXISTS') return '이미 작성한 리뷰가 있어요.';
  if (reason.code === 'REVIEW_NOT_FOUND') return '작성된 리뷰를 찾을 수 없어요.';
  return reason.message;
}

function isReviewNotFound(reason: unknown) {
  return reason instanceof ApiError && reason.code === 'REVIEW_NOT_FOUND';
}

const RATING_LABELS = [
  '별점을 선택해 주세요',
  '아쉬워요',
  '조금 아쉬워요',
  '괜찮아요',
  '좋아요',
  '정말 좋아요',
];

export function GiftReviewSection({ giftId }: { giftId: number }) {
  const keyboard = useKeyboard();
  const titleId = useId();
  const contentId = useId();
  const [loadError, setLoadError] = useState('');
  const [retryKey, setRetryKey] = useState(0);
  const [notice, setNotice] = useState('');
  const [review, setReview] = useState<GiftReview | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(0);
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [deleteOpen, setDeleteOpen] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError('');
    setError('');
    setNotice('');
    void fetchGiftReview(giftId)
      .then((nextReview) => {
        if (!active) return;
        setReview(nextReview);
        setRating(nextReview.rating);
        setContent(nextReview.content ?? '');
      })
      .catch((reason: unknown) => {
        if (!active) return;
        if (isReviewNotFound(reason)) {
          setReview(null);
          setRating(0);
          setContent('');
          return;
        }
        setLoadError(reviewError(reason));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [giftId, retryKey]);

  const submit = async () => {
    if (!rating || busy) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const input = { rating, content: content.trim() || null };
      const nextReview = review
        ? await updateGiftReview(giftId, input)
        : await createGiftReview(giftId, input);
      setReview(nextReview);
      setRating(nextReview.rating);
      setContent(nextReview.content ?? '');
      setEditing(false);
      keyboard.hide();
      setNotice('리뷰를 저장했어요.');
    } catch (reason) {
      setError(reviewError(reason));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await deleteGiftReview(giftId);
      setReview(null);
      setRating(0);
      setContent('');
      setEditing(false);
      setDeleteOpen(false);
      setNotice('리뷰를 삭제했어요. 다시 작성할 수 있어요.');
    } catch (reason) {
      setError(reviewError(reason));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="gift-review-section" aria-labelledby={titleId} aria-busy={loading || busy}>
      <div className="gift-review-heading">
        <h2 id={titleId}>리뷰</h2>
        {review && !editing && !loading && !loadError ? (
          <div className="gift-review-actions">
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setError('');
                setNotice('');
                setEditing(true);
              }}
            >
              <Pencil1Icon aria-hidden="true" /> 수정
            </button>
            <button
              type="button"
              className="text-button"
              onClick={() => {
                keyboard.hide();
                setDeleteOpen(true);
              }}
            >
              <TrashIcon aria-hidden="true" /> 삭제
            </button>
          </div>
        ) : null}
      </div>

      {loading ? (
        <div className="gift-review-loading" role="status">
          <span className="loading-dot" /> 리뷰를 불러오는 중이에요
        </div>
      ) : loadError ? (
        <div className="gift-review-load-error">
          <p className="form-error" role="alert">
            {loadError}
          </p>
          <button type="button" className="secondary" onClick={() => setRetryKey((key) => key + 1)}>
            다시 시도
          </button>
        </div>
      ) : review && !editing ? (
        <div className="gift-review-readonly">
          <div className="gift-review-score">
            <strong>
              {review.rating.toFixed(1)}
              <small> / 5</small>
            </strong>
            <span className="gift-review-stars" aria-label={`${review.rating}점`}>
              {Array.from({ length: 5 }, (_, index) =>
                index < review.rating ? (
                  <StarFilledIcon aria-hidden="true" key={index} />
                ) : (
                  <StarIcon aria-hidden="true" key={index} />
                ),
              )}
            </span>
          </div>
          <p className={!review.content ? 'gift-review-no-content' : undefined}>
            {review.content || '별점으로 마음을 남겼어요.'}
          </p>
        </div>
      ) : (
        <div className="gift-review-form">
          <div className="gift-review-rating-panel">
            <p>선물은 어땠나요?</p>
            <div className="gift-review-rating" role="group" aria-label="별점 선택">
              {Array.from({ length: 5 }, (_, index) => {
                const value = index + 1;
                return (
                  <button
                    type="button"
                    className={value <= rating ? 'selected' : ''}
                    aria-label={`${value}점`}
                    aria-pressed={value === rating}
                    disabled={busy}
                    onClick={() => {
                      setRating(value);
                      setNotice('');
                    }}
                    key={value}
                  >
                    {value <= rating ? (
                      <StarFilledIcon aria-hidden="true" />
                    ) : (
                      <StarIcon aria-hidden="true" />
                    )}
                  </button>
                );
              })}
            </div>
            <span className="gift-review-rating-caption" aria-live="polite">
              {RATING_LABELS[rating]}
            </span>
          </div>
          <div className="gift-review-content-label">
            <label htmlFor={contentId}>
              후기 <span>선택</span>
            </label>
            <small>{content.length}/300</small>
          </div>
          <KeyboardTextarea
            id={contentId}
            value={content}
            maxLength={300}
            disabled={busy}
            placeholder="마음에 들었던 점을 자유롭게 남겨주세요."
            onChange={(event) => setContent(event.target.value)}
          />
          {error ? (
            <p className="form-error" role="alert">
              {error}
            </p>
          ) : null}
          <div className="gift-review-form-footer">
            {editing ? (
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => {
                  keyboard.hide();
                  setRating(review?.rating ?? 0);
                  setContent(review?.content ?? '');
                  setError('');
                  setEditing(false);
                }}
              >
                취소
              </button>
            ) : null}
            <button
              type="button"
              className="primary"
              disabled={!rating || busy}
              onClick={() => void submit()}
            >
              {busy ? '저장 중' : review ? '리뷰 수정' : '리뷰 작성'}
            </button>
          </div>
        </div>
      )}
      {error && review && !editing ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      {notice ? (
        <p className="gift-review-notice" role="status">
          {notice}
        </p>
      ) : null}
      {deleteOpen ? (
        <AppDialog
          title="리뷰를 삭제할까요?"
          body="삭제한 리뷰는 다시 작성할 수 있어요."
          confirmLabel="삭제"
          danger
          busy={busy}
          onCancel={() => setDeleteOpen(false)}
          onConfirm={() => void remove()}
        />
      ) : null}
    </section>
  );
}

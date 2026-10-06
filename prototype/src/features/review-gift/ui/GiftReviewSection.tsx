import { useEffect, useState } from 'react';

import {
  createGiftReview,
  deleteGiftReview,
  fetchGiftReview,
  type GiftReview,
  updateGiftReview,
} from '../../../entities/review';
import { KeyboardTextarea } from '../../../mobile';
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

function stars(rating: number) {
  return Array.from({ length: 5 }, (_, index) => (index < rating ? '★' : '☆')).join('');
}

export function GiftReviewSection({ giftId }: { giftId: number }) {
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
    setError('');
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
        setError(reviewError(reason));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [giftId]);

  const submit = async () => {
    if (!rating || busy) return;
    setBusy(true);
    setError('');
    try {
      const input = { rating, content: content.trim() || null };
      const nextReview = review
        ? await updateGiftReview(giftId, input)
        : await createGiftReview(giftId, input);
      setReview(nextReview);
      setRating(nextReview.rating);
      setContent(nextReview.content ?? '');
      setEditing(false);
    } catch (reason) {
      setError(reviewError(reason));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    setError('');
    try {
      await deleteGiftReview(giftId);
      setReview(null);
      setRating(0);
      setContent('');
      setEditing(false);
      setDeleteOpen(false);
    } catch (reason) {
      setError(reviewError(reason));
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <section className="gift-review-section">리뷰를 불러오는 중...</section>;

  return (
    <section className="gift-review-section" aria-labelledby="gift-review-title">
      <div className="gift-review-heading">
        <h2 id="gift-review-title">리뷰</h2>
        {review && !editing ? (
          <button type="button" className="text-button" onClick={() => setEditing(true)}>
            수정
          </button>
        ) : null}
      </div>

      {review && !editing ? (
        <div className="gift-review-readonly">
          <strong aria-label={`${review.rating}점`}>{stars(review.rating)}</strong>
          <p>{review.content || '작성한 내용이 없어요.'}</p>
          <button
            type="button"
            className="text-button danger-text"
            onClick={() => setDeleteOpen(true)}
          >
            삭제
          </button>
        </div>
      ) : (
        <div className="gift-review-form">
          <div className="gift-review-rating" role="group" aria-label="별점 선택">
            {Array.from({ length: 5 }, (_, index) => {
              const value = index + 1;
              return (
                <button
                  type="button"
                  className={value <= rating ? 'selected' : ''}
                  aria-label={`${value}점`}
                  aria-pressed={value === rating}
                  onClick={() => setRating(value)}
                  key={value}
                >
                  ★
                </button>
              );
            })}
          </div>
          <KeyboardTextarea
            value={content}
            maxLength={300}
            placeholder="선물은 어땠나요? (선택)"
            onChange={(event) => setContent(event.target.value)}
          />
          <div className="gift-review-form-footer">
            <small>{content.length}/300</small>
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

      {error ? <p className="form-error">{error}</p> : null}
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

import { type ReactNode, useCallback, useEffect, useState } from 'react';

import {
  fetchReceivedGiftDetail,
  fetchReceivedGifts,
  fetchSentGiftDetail,
  fetchSentGifts,
  GiftDetailContent,
  GiftHistoryCard,
  type ReceivedGift,
  type SentGift,
} from '../../../entities/gift';
import { GiftReviewSection } from '../../../features/review-gift';
import { useCursorList } from '../../../shared/lib/useCursorList';
import { AsyncContentState, InfiniteCursor, ScreenHeader } from '../../../shared/ui';

type ListPageProps = {
  onBack: () => void;
  onSelect: (giftId: number) => void;
  action?: ReactNode;
};

export function ReceivedGiftsPage({ onBack, onSelect, action }: ListPageProps) {
  const loader = useCallback((cursor: string | null) => fetchReceivedGifts(cursor), []);
  const list = useCursorList(loader, 'received');
  return (
    <GiftListPage
      title="받은 선물"
      emptyLabel="아직 받은 선물이 없어요"
      items={list.items}
      action={action}
      onBack={onBack}
      onSelect={onSelect}
      cursor={list}
    />
  );
}

export function SentGiftsPage({ onBack, onSelect, action }: ListPageProps) {
  const loader = useCallback((cursor: string | null) => fetchSentGifts(cursor), []);
  const list = useCursorList(loader, 'sent');
  return (
    <GiftListPage
      title="보낸 선물"
      emptyLabel="아직 보낸 선물이 없어요"
      items={list.items}
      action={action}
      onBack={onBack}
      onSelect={onSelect}
      cursor={list}
    />
  );
}

function GiftListPage({
  title,
  emptyLabel,
  items,
  action,
  onBack,
  onSelect,
  cursor,
}: {
  title: string;
  emptyLabel: string;
  items: Array<ReceivedGift | SentGift>;
  action?: ReactNode;
  onBack: () => void;
  onSelect: (giftId: number) => void;
  cursor: ReturnType<typeof useCursorList<ReceivedGift | SentGift>>;
}) {
  return (
    <section className="page gift-history-page">
      <ScreenHeader title={title} onBack={onBack} action={action} />
      <div className="gift-history-list">
        {items.map((gift) => (
          <GiftHistoryCard gift={gift} onClick={() => onSelect(gift.giftId)} key={gift.giftId} />
        ))}
      </div>
      <InfiniteCursor
        {...cursor}
        itemCount={items.length}
        emptyLabel={emptyLabel}
        onLoadMore={cursor.loadMore}
        onRetry={cursor.retry}
      />
    </section>
  );
}

type DetailPageProps = { giftId: number; onBack: () => void; action?: ReactNode };

export function ReceivedGiftDetailPage(props: DetailPageProps) {
  return <GiftDetailPage {...props} received />;
}

export function SentGiftDetailPage(props: DetailPageProps) {
  return <GiftDetailPage {...props} received={false} />;
}

function GiftDetailPage({
  giftId,
  onBack,
  action,
  received,
}: DetailPageProps & { received: boolean }) {
  const [gift, setGift] = useState<ReceivedGift | SentGift | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      setGift(received ? await fetchReceivedGiftDetail(giftId) : await fetchSentGiftDetail(giftId));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '선물 정보를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, [giftId, received]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="page gift-detail-page">
      <ScreenHeader
        title={received ? '받은 선물 상세' : '보낸 선물 상세'}
        onBack={onBack}
        action={action}
      />
      <AsyncContentState loading={loading} error={error} onRetry={() => void load()} />
      {gift ? (
        <>
          <GiftDetailContent gift={gift} />
          {received ? <GiftReviewSection giftId={giftId} /> : null}
        </>
      ) : null}
    </section>
  );
}

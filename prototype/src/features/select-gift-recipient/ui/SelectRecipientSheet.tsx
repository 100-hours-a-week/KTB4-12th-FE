import { Cross1Icon, MagnifyingGlassIcon } from '@radix-ui/react-icons';
import { useCallback, useEffect, useState } from 'react';

import { fetchFriends, type Friend } from '../../../entities/friend';
import { BottomSheet, KeyboardInput } from '../../../mobile';
import { recoverQaScenario } from '../../../shared/config/qaScenario';
import { useCursorList } from '../../../shared/lib/useCursorList';
import { InfiniteCursor } from '../../../shared/ui';

type SelectRecipientSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (friend: Friend) => void;
};

export function SelectRecipientSheet({ open, onOpenChange, onSelect }: SelectRecipientSheetProps) {
  const [searchInput, setSearchInput] = useState('');
  const searchQuery = searchInput.trim();
  const loader = useCallback(
    (cursor: string | null) => fetchFriends(cursor, searchQuery),
    [searchQuery],
  );
  const list = useCursorList(loader, searchQuery);

  useEffect(() => {
    if (!open) setSearchInput('');
  }, [open]);

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="받는 사람 선택" snap={0.85}>
      <button
        type="button"
        className="sheet-close"
        aria-label="받는 사람 선택 닫기"
        onClick={() => onOpenChange(false)}
      >
        <Cross1Icon />
      </button>
      <div className="inline-search">
        <MagnifyingGlassIcon aria-hidden="true" />
        <KeyboardInput
          aria-label="친구 이름 검색"
          placeholder="친구 이름 검색"
          value={searchInput}
          onChange={(event) => setSearchInput(event.target.value)}
        />
      </div>
      <div className="friend-list">
        {list.items.map((friend) => (
          <article className="friend-card" key={friend.friendId}>
            <div>
              <strong>{friend.name}</strong>
              <small>
                {friend.birth
                  ? `생일 ${friend.birth.slice(-5).replace('-', '월 ')}일`
                  : '생일 비공개'}
              </small>
              <span>{friend.email}</span>
            </div>
            <button type="button" className="pill-button" onClick={() => onSelect(friend)}>
              선택
            </button>
          </article>
        ))}
      </div>
      <InfiniteCursor
        {...list}
        itemCount={list.items.length}
        emptyLabel={searchQuery ? '검색 결과가 없어요' : '등록된 친구가 없어요'}
        onLoadMore={list.loadMore}
        onRetry={() => {
          recoverQaScenario('friend-list-error');
          list.retry();
        }}
      />
    </BottomSheet>
  );
}

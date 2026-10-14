import { CheckIcon, Cross1Icon, MagnifyingGlassIcon, PlusIcon } from '@radix-ui/react-icons';
import { useEffect, useRef, useState } from 'react';

import { addFriend } from '../../../entities/friend';
import { type SearchedUser, searchUserByEmail } from '../../../entities/user';
import { BottomSheet, KeyboardInput } from '../../../mobile';
import { getSessionVersion } from '../../../shared/api/session';

type SearchState =
  | { status: 'idle' }
  | { status: 'searching' }
  | { status: 'found'; user: SearchedUser }
  | { status: 'empty' };

type AddFriendSheetProps = {
  open: boolean;
  currentUserId: number | null;
  onOpenChange: (open: boolean) => void;
  onAdded: () => void;
  onError: (message: string) => void;
};

export function AddFriendSheet({
  open,
  currentUserId,
  onOpenChange,
  onAdded,
  onError,
}: AddFriendSheetProps) {
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState('');
  const [searchState, setSearchState] = useState<SearchState>({ status: 'idle' });
  const [addedUserIds, setAddedUserIds] = useState<number[]>([]);
  const [adding, setAdding] = useState(false);
  const searchVersion = useRef(0);
  const hasSearchQuery = query.trim().length > 0;

  useEffect(() => {
    if (!open) {
      searchVersion.current += 1;
      setEditing(false);
      setQuery('');
      setSearchState({ status: 'idle' });
      setAddedUserIds([]);
    }
  }, [open]);

  const search = async () => {
    const email = query.trim();
    if (!email || searchState.status === 'searching') return;
    setSearchState({ status: 'searching' });
    const version = ++searchVersion.current;
    const sessionVersion = getSessionVersion();
    try {
      const user = await searchUserByEmail(email);
      if (version !== searchVersion.current || sessionVersion !== getSessionVersion()) return;
      setSearchState(user ? { status: 'found', user } : { status: 'empty' });
    } catch (reason) {
      if (version !== searchVersion.current || sessionVersion !== getSessionVersion()) return;
      setSearchState({ status: 'idle' });
      onError(reason instanceof Error ? reason.message : '검색에 실패했습니다.');
    }
  };

  const add = async (user: SearchedUser) => {
    if (adding || addedUserIds.includes(user.userId)) return;
    setAdding(true);
    const version = getSessionVersion();
    try {
      await addFriend(user.userId, user.name);
      if (version !== getSessionVersion()) return;
      setAddedUserIds((current) => [...current, user.userId]);
      onAdded();
    } catch (reason) {
      if (version !== getSessionVersion()) return;
      onError(reason instanceof Error ? reason.message : '친구 추가에 실패했습니다.');
    } finally {
      if (version === getSessionVersion()) setAdding(false);
    }
  };

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="친구 추가" snap={0.68}>
      <button
        type="button"
        className="sheet-close"
        aria-label="친구 추가 닫기"
        onClick={() => onOpenChange(false)}
      >
        <Cross1Icon />
      </button>
      <form
        className="friend-search-row"
        onSubmit={(event) => {
          event.preventDefault();
          void search();
        }}
      >
        <MagnifyingGlassIcon />
        {editing ? (
          <KeyboardInput
            autoFocus
            aria-label="친구 이메일 검색"
            value={query}
            onChange={(event) => {
              searchVersion.current += 1;
              setQuery(event.target.value);
              setSearchState({ status: 'idle' });
            }}
            placeholder="이메일을 검색해 주세요"
          />
        ) : (
          <button
            type="button"
            className="friend-search-trigger"
            aria-label="친구 이메일 검색"
            onClick={() => setEditing(true)}
          >
            {query || '이메일을 검색해 주세요'}
          </button>
        )}
        <button
          type="submit"
          className="search-action"
          disabled={!hasSearchQuery || searchState.status === 'searching'}
        >
          {searchState.status === 'searching' ? '검색 중' : '검색'}
        </button>
      </form>
      <div className="friend-results">
        {searchState.status === 'found' ? (
          <article className="friend-result">
            <div>
              <strong>{searchState.user.name}</strong>
              <span>{searchState.user.email}</span>
            </div>
            {searchState.user.userId !== currentUserId ? (
              <button
                type="button"
                className="circle-action"
                aria-label={`${searchState.user.name} ${
                  addedUserIds.includes(searchState.user.userId) ? '요청 보냄' : '추가'
                }`}
                disabled={adding || addedUserIds.includes(searchState.user.userId)}
                onClick={() => add(searchState.user)}
              >
                {addedUserIds.includes(searchState.user.userId) ? <CheckIcon /> : <PlusIcon />}
              </button>
            ) : null}
          </article>
        ) : null}
        {searchState.status === 'empty' ? (
          <p className="cursor-status">일치하는 사용자가 없어요</p>
        ) : null}
      </div>
    </BottomSheet>
  );
}

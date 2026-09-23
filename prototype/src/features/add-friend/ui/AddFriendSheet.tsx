import { CheckIcon, Cross1Icon, MagnifyingGlassIcon, PlusIcon } from '@radix-ui/react-icons';
import { useEffect, useState } from 'react';

import { addFriend } from '../../../entities/friend';
import { type SearchedUser, searchUserByEmail } from '../../../entities/user';
import { BottomSheet, KeyboardInput } from '../../../mobile';

type SearchState =
  | { status: 'idle' }
  | { status: 'searching' }
  | { status: 'found'; user: SearchedUser }
  | { status: 'empty' }
  | { status: 'error'; message: string };

type AddFriendSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdded: () => void;
};

export function AddFriendSheet({ open, onOpenChange, onAdded }: AddFriendSheetProps) {
  const [editing, setEditing] = useState(false);
  const [query, setQuery] = useState('');
  const [searchState, setSearchState] = useState<SearchState>({ status: 'idle' });
  const [addedUserIds, setAddedUserIds] = useState<number[]>([]);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (!open) {
      setEditing(false);
      setQuery('');
      setSearchState({ status: 'idle' });
    }
  }, [open]);

  const search = async () => {
    const email = query.trim();
    if (!email || searchState.status === 'searching') return;
    setSearchState({ status: 'searching' });
    try {
      const user = await searchUserByEmail(email);
      setSearchState(user ? { status: 'found', user } : { status: 'empty' });
    } catch (reason) {
      setSearchState({
        status: 'error',
        message: reason instanceof Error ? reason.message : '검색에 실패했습니다.',
      });
    }
  };

  const add = async (user: SearchedUser) => {
    if (adding) return;
    setAdding(true);
    try {
      await addFriend(user.userId);
      setAddedUserIds((current) => [...current, user.userId]);
      onAdded();
    } catch (reason) {
      setSearchState({
        status: 'error',
        message: reason instanceof Error ? reason.message : '친구 추가에 실패했습니다.',
      });
    } finally {
      setAdding(false);
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
      <div className="friend-search-row">
        <MagnifyingGlassIcon />
        {editing ? (
          <KeyboardInput
            autoFocus
            aria-label="친구 이메일 검색"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
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
          type="button"
          className="search-action"
          disabled={searchState.status === 'searching'}
          onClick={search}
        >
          {searchState.status === 'searching' ? '검색 중' : '검색'}
        </button>
      </div>
      <div className="friend-results">
        {searchState.status === 'found' ? (
          <article className="friend-result">
            <div>
              <strong>{searchState.user.name}</strong>
              <span>{searchState.user.email}</span>
            </div>
            <button
              type="button"
              className="circle-action"
              aria-label={`${searchState.user.name} ${
                addedUserIds.includes(searchState.user.userId) ? '추가됨' : '추가'
              }`}
              disabled={adding}
              onClick={() => add(searchState.user)}
            >
              {addedUserIds.includes(searchState.user.userId) ? <CheckIcon /> : <PlusIcon />}
            </button>
          </article>
        ) : null}
        {searchState.status === 'empty' ? (
          <p className="cursor-status">일치하는 사용자가 없어요</p>
        ) : null}
        {searchState.status === 'error' ? (
          <p className="cursor-status" role="alert">
            {searchState.message}
          </p>
        ) : null}
      </div>
    </BottomSheet>
  );
}

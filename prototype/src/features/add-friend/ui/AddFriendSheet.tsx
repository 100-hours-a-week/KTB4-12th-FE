import { CheckIcon, Cross1Icon, MagnifyingGlassIcon } from '@radix-ui/react-icons';
import { useEffect, useRef, useState } from 'react';

import { addFriend } from '../../../entities/friend';
import { type SearchedUser, searchUserByEmail } from '../../../entities/user';
import { BottomSheet, KeyboardInput } from '../../../mobile';
import { getSessionVersion } from '../../../shared/api/session';
import { EMAIL_FORMAT_ERROR, isValidEmailFormat } from '../../../shared/lib/authValidation';

type SearchState =
  | { status: 'idle' }
  | { status: 'searching' }
  | { status: 'found'; user: SearchedUser }
  | { status: 'empty' }
  | { status: 'error'; message: string };

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
  const hasValidEmail = isValidEmailFormat(query.trim());

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
    if (!isValidEmailFormat(email)) {
      setSearchState({ status: 'error', message: EMAIL_FORMAT_ERROR });
      return;
    }
    setSearchState({ status: 'searching' });
    const version = ++searchVersion.current;
    const sessionVersion = getSessionVersion();
    try {
      const user = await searchUserByEmail(email);
      if (version !== searchVersion.current || sessionVersion !== getSessionVersion()) return;
      setSearchState(user ? { status: 'found', user } : { status: 'empty' });
    } catch (reason) {
      if (version !== searchVersion.current || sessionVersion !== getSessionVersion()) return;
      setSearchState({
        status: 'error',
        message: reason instanceof Error ? reason.message : '검색에 실패했습니다.',
      });
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
            aria-invalid={searchState.status === 'error'}
            aria-describedby={searchState.status === 'error' ? 'friend-search-error' : undefined}
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
          aria-busy={searchState.status === 'searching'}
          disabled={!hasValidEmail || searchState.status === 'searching'}
        >
          <span>{searchState.status === 'searching' ? '검색 중…' : '검색'}</span>
        </button>
      </form>
      {searchState.status === 'error' ? (
        <p id="friend-search-error" className="field-error friend-search-error" role="alert">
          {searchState.message}
        </p>
      ) : null}
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
                className="friend-request-action"
                aria-label={`${searchState.user.name} ${
                  addedUserIds.includes(searchState.user.userId)
                    ? '요청 보냄'
                    : adding
                      ? '요청 중'
                      : '친구 요청'
                }`}
                aria-busy={adding}
                disabled={adding || addedUserIds.includes(searchState.user.userId)}
                onClick={() => add(searchState.user)}
              >
                {addedUserIds.includes(searchState.user.userId) ? (
                  <>
                    <CheckIcon aria-hidden="true" />
                    요청 보냄
                  </>
                ) : adding ? (
                  '요청 중…'
                ) : (
                  '친구 요청'
                )}
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

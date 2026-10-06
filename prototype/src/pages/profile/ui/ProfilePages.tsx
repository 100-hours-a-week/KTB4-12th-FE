import { GearIcon } from '@radix-ui/react-icons';
import { type ReactNode, useCallback, useEffect, useState } from 'react';

import { fetchPreference, savePreference } from '../../../entities/preference';
import type { MyProfile } from '../../../entities/user';
import {
  DislikeCategorySelector,
  useDislikeCategorySelection,
} from '../../../features/edit-dislike-categories';
import { KeyboardTextarea } from '../../../mobile';
import { AppDialog, AsyncContentState, ScreenHeader, SettingRow } from '../../../shared/ui';

function formatBirthday(birth: string) {
  return birth.replaceAll('-', '.');
}

function formatBirthdayLabel(birth: string) {
  const [, month, day] = birth.split('-');
  return `${month}월 ${day}일`;
}

export function MyPage({
  profile,
  onAccount,
  onReceived,
  onSent,
  onPreferences,
  onGiftPreference,
  action,
}: {
  profile: MyProfile | null;
  onAccount: () => void;
  onReceived: () => void;
  onSent: () => void;
  onPreferences: () => void;
  onGiftPreference: () => void;
  action?: ReactNode;
}) {
  return (
    <section className="page mypage-page">
      <ScreenHeader title="마이페이지" action={action} />
      <article className="profile-card">
        <div>
          <strong>{profile?.name ?? '…'}</strong>
          <span>{profile ? formatBirthdayLabel(profile.birth) : '…'}</span>
          <small>{profile?.email ?? ''}</small>
        </div>
        <button type="button" className="primary compact" onClick={onAccount}>
          <GearIcon /> 내 정보 관리
        </button>
      </article>
      <div className="settings-list">
        <SettingRow label="내 정보 및 공개 설정" value="설정" onClick={onAccount} />
        <SettingRow
          label="받은 선물"
          value={profile ? `${profile.giftSummary.receivedCount}건` : '-건'}
          onClick={onReceived}
        />
        <SettingRow
          label="보낸 선물"
          value={profile ? `${profile.giftSummary.sentCount}건` : '-건'}
          onClick={onSent}
        />
        <SettingRow label="비선호 카테고리" value="설정" onClick={onPreferences} />
        <SettingRow label="내 선물 취향" value="작성" onClick={onGiftPreference} />
      </div>
    </section>
  );
}

export function AccountPage({
  profile,
  onBack,
  onBirthday,
  onBirthdayPublic,
  onLogout,
  action,
}: {
  profile: MyProfile | null;
  onBack: () => void;
  onBirthday: () => void;
  onBirthdayPublic: () => void;
  onLogout: () => void;
  action?: ReactNode;
}) {
  return (
    <section className="page account-page">
      <ScreenHeader title="내 정보 및 공개 설정" onBack={onBack} action={action} />
      <article className="account-intro">
        <strong>정보 공개 설정</strong>
        <p>이름은 항상 공개되며, 생일 공개만 관리해요.</p>
      </article>
      <div className="account-list">
        <SettingRow
          label="생년월일"
          value={`${profile ? formatBirthday(profile.birth) : '…'}  수정`}
          onClick={onBirthday}
        />
        <button
          type="button"
          className="setting-row"
          role="switch"
          aria-checked={profile?.isBirthdayPublic ?? false}
          onClick={onBirthdayPublic}
        >
          <span>생일 공개</span>
          <span>
            {profile?.isBirthdayPublic ? '공개' : '비공개'}
            <i className={`switch ${profile?.isBirthdayPublic ? 'on' : ''}`} />
          </span>
        </button>
        <SettingRow label="로그아웃" value="" onClick={onLogout} />
      </div>
    </section>
  );
}

export function PreferencesPage({
  onBack,
  onSaved,
  action,
}: {
  onBack: () => void;
  onSaved: () => void;
  action?: ReactNode;
}) {
  const selection = useDislikeCategorySelection();
  return (
    <section className="page preferences-page">
      <ScreenHeader title="비선호 카테고리" onBack={onBack} action={action} />
      <p className="preference-help">
        선택한 카테고리는 친구들이 선물할 때<br />
        경고로 표시돼요. (최대 {selection.maxSelectableCount}개)
      </p>
      <div className="preference-toolbar">
        <span>{selection.selected.length}개 선택</span>
        <button
          type="button"
          disabled={!selection.selected.length || selection.saving}
          onClick={selection.reset}
        >
          전체 초기화
        </button>
      </div>
      <AsyncContentState
        loading={selection.loading}
        error={selection.error}
        onRetry={() => void selection.load()}
      />
      {!selection.loading && !selection.error ? (
        <DislikeCategorySelector
          options={selection.options}
          selected={selection.selected}
          disabled={selection.saving}
          onToggle={selection.toggle}
        />
      ) : null}
      <button
        type="button"
        className="primary save-preferences"
        disabled={
          !selection.dirty || selection.saving || selection.loading || Boolean(selection.error)
        }
        onClick={async () => {
          if (await selection.save()) onSaved();
        }}
      >
        {selection.saving ? '저장 중' : '저장하기'}
      </button>
    </section>
  );
}

export function GiftPreferencePage({
  onBack,
  onSaved,
  onDirtyChange,
  action,
}: {
  onBack: () => void;
  onSaved: () => void;
  onDirtyChange: (dirty: boolean) => void;
  action?: ReactNode;
}) {
  const [initial, setInitial] = useState('');
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [confirmBack, setConfirmBack] = useState(false);
  const dirty = value !== initial;
  const preferenceLength = [...value].length;

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const result = (await fetchPreference()) ?? '';
      setInitial(result);
      setValue(result);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '선물 취향을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  useEffect(() => onDirtyChange(dirty), [dirty, onDirtyChange]);

  const save = async () => {
    if (!value.trim()) return;
    setSaving(true);
    setError('');
    try {
      const result = (await savePreference(value.trim() || null)) ?? '';
      setInitial(result);
      setValue(result);
      onSaved();
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : '저장에 실패했습니다. 다시 시도해 주세요.',
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="page gift-preference-page">
      <ScreenHeader
        title="내 선물 취향"
        onBack={() => (dirty ? setConfirmBack(true) : onBack())}
        action={action}
      />
      <AsyncContentState
        loading={loading}
        error={error && !value ? error : ''}
        onRetry={() => void load()}
      />
      {!loading ? (
        <>
          <p className="preference-help">
            AI만 보는 비밀 메모예요. 솔직하게 적을수록 취향 저격 선물이 도착해요.
          </p>
          <label className="preference-textarea">
            <KeyboardTextarea
              value={value}
              maxLength={500}
              placeholder="좋아하는 스타일, 색상, 필요한 물건을 자유롭게 적어주세요."
              onChange={(event) => setValue([...event.target.value].slice(0, 500).join(''))}
            />
            <span>{preferenceLength}/500</span>
          </label>
          {error ? <p className="field-error">{error}</p> : null}
          <button
            type="button"
            className="primary save-preferences"
            disabled={!dirty || saving}
            onClick={() => void save()}
          >
            {saving ? '저장 중' : '저장하기'}
          </button>
        </>
      ) : null}
      {confirmBack ? (
        <AppDialog
          title="변경사항을 저장하지 않고 나갈까요?"
          body="작성 중인 선물 취향은 저장되지 않아요."
          cancelLabel="계속 작성"
          confirmLabel="나가기"
          onCancel={() => setConfirmBack(false)}
          onConfirm={onBack}
        />
      ) : null}
    </section>
  );
}

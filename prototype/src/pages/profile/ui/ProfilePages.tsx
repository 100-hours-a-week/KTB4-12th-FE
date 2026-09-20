import { CheckIcon, GearIcon } from '@radix-ui/react-icons';
import { useEffect, useState } from 'react';

import { categories as categoryIcons } from '../../../entities/category';
import { fetchDislikeCategories, saveDislikeCategories } from '../../../entities/preference';
import type { MyProfile } from '../../../entities/user';
import { ScreenHeader, SettingRow } from '../../../shared/ui';

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
  onSent,
  onReceived,
  onPreferences,
}: {
  profile: MyProfile | null;
  onAccount: () => void;
  onSent: () => void;
  onReceived: () => void;
  onPreferences: () => void;
}) {
  return (
    <section className="page mypage-page">
      <ScreenHeader title="마이페이지" />
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
        <SettingRow
          label="보낸 선물"
          value={profile ? `${profile.giftSummary.sentCount}건` : '-건'}
          onClick={onSent}
        />
        <SettingRow
          label="받은 선물"
          value={profile ? `${profile.giftSummary.receivedCount}건` : '-건'}
          onClick={onReceived}
        />
        <SettingRow label="비선호 카테고리" value="설정" onClick={onPreferences} />
      </div>
    </section>
  );
}

type AccountPageProps = {
  profile: MyProfile | null;
  onBack: () => void;
  onBirthday: () => void;
  onBirthdayPublic: () => void;
  onLogout: () => void;
};

export function AccountPage({
  profile,
  onBack,
  onBirthday,
  onBirthdayPublic,
  onLogout,
}: AccountPageProps) {
  return (
    <section className="page account-page">
      <ScreenHeader title="내 정보 및 공개 설정" onBack={onBack} />
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

export function PreferencesPage({ onBack }: { onBack: () => void }) {
  const [options, setOptions] = useState<
    Array<{ categoryId: number; name: string; isSelected: boolean }>
  >([]);
  const [selected, setSelected] = useState<number[]>([]);
  const [maxSelectableCount, setMaxSelectableCount] = useState(5);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchDislikeCategories()
      .then((result) => {
        if (cancelled) return;
        setMaxSelectableCount(result.maxSelectableCount);
        setOptions(result.categories);
        setSelected(
          result.categories.filter((item) => item.isSelected).map((item) => item.categoryId),
        );
      })
      .catch((reason) => {
        if (!cancelled)
          setLoadError(
            reason instanceof Error ? reason.message : '카테고리를 불러오지 못했습니다.',
          );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggle = (categoryId: number) => {
    setSaved(false);
    setSelected((current) =>
      current.includes(categoryId)
        ? current.filter((item) => item !== categoryId)
        : current.length < maxSelectableCount
          ? [...current, categoryId]
          : current,
    );
  };

  const save = async () => {
    if (saving) return;
    setSaving(true);
    setSaved(false);
    try {
      await saveDislikeCategories(selected);
      setSaved(true);
    } catch {
      setSaved(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="page preferences-page">
      <ScreenHeader title="비선호 카테고리" onBack={onBack} />
      <p className="preference-help">
        선택한 카테고리는 친구들이 선물할 때
        <br />
        경고로 표시돼요. (최대 {maxSelectableCount}개)
      </p>
      {loadError ? (
        <div className="cursor-status">
          <span>{loadError}</span>
          <button type="button" onClick={() => window.location.reload()}>
            다시 시도
          </button>
        </div>
      ) : loading ? (
        <p className="cursor-status">카테고리를 불러오는 중</p>
      ) : (
        <div className="category-list">
          {options.map(({ categoryId, name }) => {
            const active = selected.includes(categoryId);
            const Icon =
              categoryIcons.find((category) => category.name === name)?.Icon ?? CheckIcon;
            return (
              <button
                type="button"
                className="category-row"
                aria-pressed={active}
                onClick={() => toggle(categoryId)}
                key={categoryId}
              >
                <span>
                  <Icon />
                  {name}
                </span>
                <span className={active ? 'select-dot active' : 'select-dot'}>
                  {active ? <CheckIcon /> : null}
                </span>
              </button>
            );
          })}
        </div>
      )}
      <button
        type="button"
        className="primary save-preferences"
        disabled={saving || loading || Boolean(loadError)}
        onClick={() => void save()}
      >
        {saved ? (
          <>
            <CheckIcon /> 저장했어요
          </>
        ) : saving ? (
          '저장 중'
        ) : (
          '저장하기'
        )}
      </button>
    </section>
  );
}

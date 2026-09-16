import { CheckIcon, GearIcon } from '@radix-ui/react-icons';

import { categories } from '../../../entities/category';
import { ScreenHeader, SettingRow } from '../../../shared/ui';

export function MyPage({
  onAccount,
  onSent,
  onReceived,
  onPreferences,
}: {
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
          <strong>홍길동</strong>
          <span>01월 01일</span>
          <small>email@email.com</small>
        </div>
        <button type="button" className="primary compact" onClick={onAccount}>
          <GearIcon /> 내 정보 관리
        </button>
      </article>
      <div className="settings-list">
        <SettingRow label="보낸 선물" value="12건" onClick={onSent} />
        <SettingRow label="받은 선물" value="8건" onClick={onReceived} />
        <SettingRow label="비선호 카테고리" value="설정" onClick={onPreferences} />
      </div>
    </section>
  );
}

type AccountPageProps = {
  birthday: string;
  birthdayPublic: boolean;
  onBack: () => void;
  onBirthday: () => void;
  onBirthdayPublic: () => void;
  onLogout: () => void;
};

export function AccountPage({
  birthday,
  birthdayPublic,
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
        <SettingRow label="생년월일" value={`${birthday}  수정`} onClick={onBirthday} />
        <button
          type="button"
          className="setting-row"
          role="switch"
          aria-checked={birthdayPublic}
          onClick={onBirthdayPublic}
        >
          <span>생일 공개</span>
          <span>
            {birthdayPublic ? '공개' : '비공개'}
            <i className={`switch ${birthdayPublic ? 'on' : ''}`} />
          </span>
        </button>
        <SettingRow label="로그아웃" value="" onClick={onLogout} />
      </div>
    </section>
  );
}

type PreferencesPageProps = {
  selected: string[];
  saved: boolean;
  onBack: () => void;
  onToggle: (name: string) => void;
  onSave: () => void;
};

export function PreferencesPage({
  selected,
  saved,
  onBack,
  onToggle,
  onSave,
}: PreferencesPageProps) {
  return (
    <section className="page preferences-page">
      <ScreenHeader title="비선호 카테고리" onBack={onBack} />
      <p className="preference-help">
        선택한 카테고리는 친구들이 선물할 때<br />
        경고로 표시돼요. (최대 5개)
      </p>
      <div className="category-list">
        {categories.map(({ name, Icon }) => {
          const active = selected.includes(name);
          return (
            <button
              type="button"
              className="category-row"
              aria-pressed={active}
              onClick={() => onToggle(name)}
              key={name}
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
      <button type="button" className="primary save-preferences" onClick={onSave}>
        {saved ? (
          <>
            <CheckIcon /> 저장했어요
          </>
        ) : (
          '저장하기'
        )}
      </button>
    </section>
  );
}

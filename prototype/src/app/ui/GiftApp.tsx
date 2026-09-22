import { lazy, Suspense, useCallback, useEffect, useState } from 'react';

import {
  login as apiLogin,
  logout as apiLogout,
  signup as apiSignup,
  type SignupTermConsent,
} from '../../entities/auth';
import { fetchProductCategories, type Product } from '../../entities/product';
import {
  completeOnboarding,
  fetchMe,
  type MyProfile,
  type SearchedUser,
  updateMe,
} from '../../entities/user';
import { AddFriendSheet } from '../../features/add-friend';
import { EditBirthdaySheet } from '../../features/edit-birthday';
import { ProductFilterSheet } from '../../features/filter-products';
import { MobileScroll, useKeyboard, useScreenPortal } from '../../mobile';
import type { SignupDraft } from '../../pages/signup';
import { AUTH_FLAG_KEY, clearSession, loadSession, saveSession } from '../../shared/api/session';
import type { MainTabRoute, Route } from '../../shared/model/navigation';
import { AppDialog } from '../../shared/ui';
import { BottomNavigation } from '../../widgets/bottom-navigation';

const FriendsPage = lazy(() =>
  import('../../pages/friends').then((m) => ({ default: m.FriendsPage })),
);
const ReceivedGiftsPage = lazy(() =>
  import('../../pages/gift-history').then((m) => ({ default: m.ReceivedGiftsPage })),
);
const CompletePage = lazy(() =>
  import('../../pages/gifts').then((m) => ({ default: m.CompletePage })),
);
const GiftsPage = lazy(() => import('../../pages/gifts').then((m) => ({ default: m.GiftsPage })));
const ProductPage = lazy(() =>
  import('../../pages/gifts').then((m) => ({ default: m.ProductPage })),
);
const LoginPage = lazy(() => import('../../pages/login').then((m) => ({ default: m.LoginPage })));
const AccountPage = lazy(() =>
  import('../../pages/profile').then((m) => ({ default: m.AccountPage })),
);
const MyPage = lazy(() => import('../../pages/profile').then((m) => ({ default: m.MyPage })));
const PreferencesPage = lazy(() =>
  import('../../pages/profile').then((m) => ({ default: m.PreferencesPage })),
);
const SignupPage = lazy(() =>
  import('../../pages/signup').then((m) => ({ default: m.SignupPage })),
);
const TermsAgreementPage = lazy(() =>
  import('../../pages/signup').then((m) => ({ default: m.TermsAgreementPage })),
);

type DialogKind = 'birthdayConsent' | 'logout' | 'onboarding' | 'selectRecipient' | null;

const emptySignupDraft: SignupDraft = {
  name: '',
  birthday: '',
  email: '',
  emailVerified: false,
  password: '',
  passwordConfirmation: '',
};

export function GiftApp() {
  const keyboard = useKeyboard();
  const { screenRef } = useScreenPortal();
  const [route, setRoute] = useState<Route>(() =>
    window.localStorage.getItem(AUTH_FLAG_KEY) === 'signed-out' || !loadSession()
      ? 'login'
      : 'friends',
  );
  const [history, setHistory] = useState<Route[]>([]);
  const [friendSheetOpen, setFriendSheetOpen] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [birthdaySheetOpen, setBirthdaySheetOpen] = useState(false);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [friendsRefreshKey, setFriendsRefreshKey] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [giftRecipient, setGiftRecipient] = useState<SearchedUser | null>(null);
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [filterOptions, setFilterOptions] = useState<Array<{ categoryId: number; name: string }>>(
    [],
  );
  const [activeFilterIds, setActiveFilterIds] = useState<number[]>([]);
  const [pendingOnboarding, setPendingOnboarding] = useState(false);
  const [signupDraft, setSignupDraft] = useState<SignupDraft>(emptySignupDraft);

  const dismissKeyboard = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    keyboard.hide();
    screenRef.current?.scrollTo({ top: 0, left: 0 });
    window.requestAnimationFrame(() => screenRef.current?.scrollTo({ top: 0, left: 0 }));
  }, [keyboard, screenRef]);

  const navigate = (next: Route) => {
    dismissKeyboard();
    setHistory((value) => [...value, route]);
    setRoute(next);
  };

  const goBack = () => {
    dismissKeyboard();
    setRoute(history.at(-1) ?? 'friends');
    setHistory((value) => value.slice(0, -1));
  };

  const setTab = (next: MainTabRoute) => {
    dismissKeyboard();
    setHistory([]);
    setRoute(next);
    setGiftRecipient(null);
    if (next === 'mypage') void refreshProfile();
    if (pendingOnboarding) {
      setPendingOnboarding(false);
      void completeOnboarding().catch(() => undefined);
    }
  };

  const refreshProfile = useCallback(() => {
    fetchMe()
      .then(setProfile)
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    const handleExpired = () => {
      setHistory([]);
      setRoute('login');
    };
    window.addEventListener('prototype:session-expired', handleExpired);
    return () => window.removeEventListener('prototype:session-expired', handleExpired);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetchProductCategories()
      .then((tree) => {
        if (cancelled) return;
        const leaves = tree.flatMap((category) =>
          category.children.length
            ? category.children.map((child) => ({
                categoryId: child.categoryId,
                name: child.name,
              }))
            : [{ categoryId: category.categoryId, name: category.name }],
        );
        setFilterOptions(leaves);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const enterApp = (isFirstLogin: boolean) => {
    if (isFirstLogin) setDialog('onboarding');
    setTab('friends');
  };

  const login = async (email: string, password: string) => {
    const result = await apiLogin(email, password);
    saveSession({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken ?? '',
      expiresIn: result.expiresIn,
      user: result.user,
    });
    enterApp(result.isFirstLogin);
  };

  const logout = () => {
    dismissKeyboard();
    setDialog(null);
    void apiLogout()
      .catch(() => undefined)
      .finally(() => {
        clearSession();
        setHistory([]);
        setRoute('login');
      });
  };

  const completeSignup = async (consents: SignupTermConsent[]) => {
    const draft = signupDraft;
    await apiSignup({
      name: draft.name.trim(),
      birth: draft.birthday.replaceAll('.', '-'),
      email: draft.email.trim(),
      password: draft.password,
      termConsents: consents,
    });
    setSignupDraft(emptySignupDraft);
    const result = await apiLogin(draft.email.trim(), draft.password);
    saveSession({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken ?? '',
      expiresIn: result.expiresIn,
      user: result.user,
    });
    enterApp(result.isFirstLogin);
  };

  const setBirthdayPublic = (isBirthdayPublic: boolean) => {
    setProfile((current) => (current ? { ...current, isBirthdayPublic } : current));
    void updateMe({ isBirthdayPublic }).catch(() => refreshProfile());
  };

  const saveBirthday = (birthday: string) => {
    dismissKeyboard();
    setBirthdaySheetOpen(false);
    setProfile((current) =>
      current ? { ...current, birth: birthday.replaceAll('.', '-') } : current,
    );
    void updateMe({ birth: birthday.replaceAll('.', '-') }).catch(() => refreshProfile());
  };

  const renderPage = () => {
    if (route === 'friends')
      return (
        <FriendsPage
          refreshKey={friendsRefreshKey}
          onAdd={() => setFriendSheetOpen(true)}
          onGift={(friend) => {
            setGiftRecipient(friend);
            navigate('gifts');
          }}
        />
      );
    if (route === 'login') return <LoginPage onLogin={login} onSignup={() => navigate('signup')} />;
    if (route === 'signup')
      return (
        <SignupPage
          draft={signupDraft}
          onDraftChange={setSignupDraft}
          onBack={goBack}
          onComplete={() => navigate('terms')}
        />
      );
    if (route === 'terms')
      return <TermsAgreementPage onBack={goBack} onComplete={completeSignup} />;
    if (route === 'gifts')
      return (
        <GiftsPage
          filterCount={activeFilterIds.length}
          filterCategoryIds={activeFilterIds}
          onFilter={() => setFilterSheetOpen(true)}
          onProduct={(product) => {
            setSelectedProduct(product);
            setQuantity(1);
            navigate('product');
          }}
        />
      );
    if (route === 'mypage')
      return (
        <MyPage
          profile={profile}
          onAccount={() => navigate('account')}
          onReceived={() => navigate('received')}
          onPreferences={() => navigate('preferences')}
        />
      );
    if ((route === 'product' || route === 'complete') && !selectedProduct) return null;
    if (route === 'product' && selectedProduct)
      return (
        <ProductPage
          product={selectedProduct}
          quantity={quantity}
          onDecrease={() => setQuantity((value) => Math.max(1, value - 1))}
          onIncrease={() => setQuantity((value) => value + 1)}
          onBack={goBack}
          onGift={() => {
            if (!giftRecipient) {
              setDialog('selectRecipient');
              return;
            }
            navigate('complete');
          }}
        />
      );
    if (route === 'complete' && selectedProduct)
      return (
        <CompletePage
          product={selectedProduct}
          quantity={quantity}
          recipient={giftRecipient}
          onFriends={() => setTab('friends')}
        />
      );
    if (route === 'received') return <ReceivedGiftsPage onBack={goBack} />;
    if (route === 'preferences') return <PreferencesPage onBack={goBack} />;
    return (
      <AccountPage
        profile={profile}
        onBack={goBack}
        onBirthday={() => setBirthdaySheetOpen(true)}
        onBirthdayPublic={() => {
          if (profile?.isBirthdayPublic) setBirthdayPublic(false);
          else setDialog('birthdayConsent');
        }}
        onLogout={() => setDialog('logout')}
      />
    );
  };

  const showBottomNav = route === 'friends' || route === 'gifts' || route === 'mypage';

  return (
    <div className="gift-app" data-testid="gift-app" data-route={route}>
      <MobileScroll key={route} className="app-screen">
        <div className={`screen-body ${showBottomNav ? 'has-bottom-nav' : ''}`}>
          <Suspense
            fallback={
              <div className="cursor-status">
                <span className="loading-dot" />
                불러오는 중
              </div>
            }
          >
            {renderPage()}
          </Suspense>
        </div>
      </MobileScroll>
      {showBottomNav ? <BottomNavigation route={route} onSelect={setTab} /> : null}

      <AddFriendSheet
        open={friendSheetOpen}
        onOpenChange={(open) => {
          if (!open) dismissKeyboard();
          setFriendSheetOpen(open);
        }}
        onAdded={() => setFriendsRefreshKey((value) => value + 1)}
      />
      <ProductFilterSheet
        open={filterSheetOpen}
        options={filterOptions}
        selected={activeFilterIds}
        onToggle={(categoryId) =>
          setActiveFilterIds((current) =>
            current.includes(categoryId)
              ? current.filter((item) => item !== categoryId)
              : [...current, categoryId],
          )
        }
        onClear={() => setActiveFilterIds([])}
        onOpenChange={setFilterSheetOpen}
      />
      <EditBirthdaySheet
        open={birthdaySheetOpen}
        birthday={(profile?.birth ?? '2000-01-01').replaceAll('-', '.')}
        onOpenChange={setBirthdaySheetOpen}
        onSave={saveBirthday}
      />

      {dialog === 'birthdayConsent' ? (
        <AppDialog
          title="생일을 공개할까요?"
          body={
            <>
              나를 친구로 등록한 모든 사용자에게
              <br />
              생일 월·일이 보여요.
              <br />
              언제든 다시 비공개로 바꿀 수 있어요.
            </>
          }
          confirmLabel="동의하고 공개"
          onCancel={() => setDialog(null)}
          onConfirm={() => {
            setBirthdayPublic(true);
            setDialog(null);
          }}
        />
      ) : null}
      {dialog === 'logout' ? (
        <AppDialog
          title="로그아웃하시겠어요?"
          body="현재 기기에서 로그인 세션이 종료됩니다."
          confirmLabel="로그아웃"
          danger
          onCancel={() => setDialog(null)}
          onConfirm={logout}
        />
      ) : null}
      {dialog === 'selectRecipient' ? (
        <AppDialog
          title="받는 사람을 선택해 주세요"
          body="친구 목록에서 선물할 친구를 먼저 선택해 주세요."
          confirmLabel="친구 보기"
          onCancel={() => setDialog(null)}
          onConfirm={() => {
            setDialog(null);
            setTab('friends');
          }}
        />
      ) : null}
      {dialog === 'onboarding' ? (
        <AppDialog
          title="처음 오셨네요"
          body={
            <>
              생일 공개와 비선호 카테고리를 설정하면
              <br />
              친구가 더 마음에 맞는 선물을 볼 수 있어요.
            </>
          }
          confirmLabel="설정하고 시작"
          onCancel={() => {
            setDialog(null);
            void completeOnboarding().catch(() => undefined);
          }}
          onConfirm={() => {
            setDialog(null);
            setPendingOnboarding(true);
            navigate('preferences');
          }}
        />
      ) : null}
    </div>
  );
}

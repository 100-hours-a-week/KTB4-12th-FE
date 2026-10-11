import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import {
  login as apiLogin,
  logout as apiLogout,
  signup as apiSignup,
  type SignupTermConsent,
} from '../../entities/auth';
import {
  getGiftConditionError,
  type GiftPreflight,
  MAX_GIFT_QUANTITY,
  preflightGift,
  sendGift,
  type SentGiftResult,
} from '../../entities/gift';
import { fetchUnreadNotificationCount, type Notification } from '../../entities/notification';
import { fetchProductCategories, type Product, type ProductCategory } from '../../entities/product';
import {
  completeOnboarding,
  fetchMe,
  type MyProfile,
  type SearchedUser,
  updateMe,
} from '../../entities/user';
import { AddFriendSheet } from '../../features/add-friend';
import { EditBirthdaySheet } from '../../features/edit-birthday';
import { OnboardingPreferenceSheet } from '../../features/edit-dislike-categories';
import { ProductFilterSheet } from '../../features/filter-products';
import { BugReportWidget } from '../../features/report-bug';
import { SelectRecipientSheet } from '../../features/select-gift-recipient';
import { NotificationButton, NotificationSheet } from '../../features/view-notifications';
import { MobileScroll, useKeyboard, useScreenPortal } from '../../mobile';
import { AiChatPage } from '../../pages/ai-chat';
import type { SignupDraft } from '../../pages/signup';
import { ApiError } from '../../shared/api/client';
import { AUTH_FLAG_KEY, clearSession, loadSession, saveSession } from '../../shared/api/session';
import { getQaInitialRoute } from '../../shared/config/qaScenario';
import type { MainTabRoute, Route } from '../../shared/model/navigation';
import { AppDialog, Toast } from '../../shared/ui';
import { BottomNavigation } from '../../widgets/bottom-navigation';

const FriendsPage = lazy(() =>
  import('../../pages/friends').then((m) => ({ default: m.FriendsPage })),
);
const ReceivedGiftsPage = lazy(() =>
  import('../../pages/gift-history').then((m) => ({ default: m.ReceivedGiftsPage })),
);
const SentGiftsPage = lazy(() =>
  import('../../pages/gift-history').then((m) => ({ default: m.SentGiftsPage })),
);
const ReceivedGiftDetailPage = lazy(() =>
  import('../../pages/gift-history').then((m) => ({ default: m.ReceivedGiftDetailPage })),
);
const SentGiftDetailPage = lazy(() =>
  import('../../pages/gift-history').then((m) => ({ default: m.SentGiftDetailPage })),
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
const GiftPreferencePage = lazy(() =>
  import('../../pages/profile').then((m) => ({ default: m.GiftPreferencePage })),
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

type DialogKind = 'birthdayConsent' | 'logout' | 'leavePreference' | null;
type GiftDialog =
  | { kind: 'preference'; preflight: GiftPreflight }
  | { kind: 'confirm'; preflight: GiftPreflight }
  | { kind: 'conditions'; title: string; body: string }
  | null;

const emptySignupDraft: SignupDraft = {
  name: '',
  birthday: '',
  email: '',
  emailVerified: false,
  password: '',
  passwordConfirmation: '',
};
const MAIN_TAB_STORAGE_KEY = 'gift-prototype-main-tab';
const SELECTED_PRODUCT_STORAGE_KEY = 'gift-prototype-selected-product';
const DETAIL_ROUTE_STORAGE_KEY = 'gift-prototype-detail-route';

type RestorableRoute =
  | 'account'
  | 'received'
  | 'sent'
  | 'received-detail'
  | 'sent-detail'
  | 'preferences'
  | 'gift-preference';
type StoredDetailRoute = { route: RestorableRoute; returnRoute: MainTabRoute; giftId?: number };

function getStoredMainTab(): MainTabRoute {
  const tab = window.localStorage.getItem(MAIN_TAB_STORAGE_KEY);
  return tab === 'gifts' || tab === 'mypage' ? tab : 'friends';
}

function getStoredProduct(): Product | null {
  try {
    const raw = window.localStorage.getItem(SELECTED_PRODUCT_STORAGE_KEY);
    if (!raw) return null;
    const product = JSON.parse(raw) as Partial<Product>;
    const valid =
      typeof product.productId === 'number' &&
      typeof product.brandName === 'string' &&
      typeof product.productName === 'string' &&
      typeof product.price === 'number' &&
      typeof product.thumbnailUrl === 'string';
    if (!valid) {
      window.localStorage.removeItem(SELECTED_PRODUCT_STORAGE_KEY);
      return null;
    }
    return product as Product;
  } catch {
    window.localStorage.removeItem(SELECTED_PRODUCT_STORAGE_KEY);
    return null;
  }
}

function getStoredDetailRoute(): StoredDetailRoute | null {
  try {
    const raw = window.localStorage.getItem(DETAIL_ROUTE_STORAGE_KEY);
    if (!raw) return null;
    const detail = JSON.parse(raw) as StoredDetailRoute;
    const routes: RestorableRoute[] = [
      'account',
      'received',
      'sent',
      'received-detail',
      'sent-detail',
      'preferences',
      'gift-preference',
    ];
    const tabs: MainTabRoute[] = ['friends', 'gifts', 'mypage'];
    if (!routes.includes(detail.route) || !tabs.includes(detail.returnRoute)) return null;
    if (detail.route.endsWith('-detail') && typeof detail.giftId !== 'number') return null;
    return detail;
  } catch {
    return null;
  }
}

function isRestorableRoute(route: Route): route is RestorableRoute {
  return [
    'account',
    'received',
    'sent',
    'received-detail',
    'sent-detail',
    'preferences',
    'gift-preference',
  ].includes(route);
}

function makeIdempotencyKey() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (char) => {
    const random = (Math.random() * 16) | 0;
    return (char === 'x' ? random : (random & 0x3) | 0x8).toString(16);
  });
}

export function GiftApp() {
  const keyboard = useKeyboard();
  const { screenRef } = useScreenPortal();
  const storedProduct = getStoredProduct();
  const storedDetail = getStoredDetailRoute();
  const [route, setRoute] = useState<Route>(() => {
    if (window.localStorage.getItem(AUTH_FLAG_KEY) === 'signed-out' || !loadSession())
      return 'login';
    return (
      getQaInitialRoute() ??
      (storedProduct ? 'product' : (storedDetail?.route ?? getStoredMainTab()))
    );
  });
  const [history, setHistory] = useState<Route[]>(
    storedProduct ? ['gifts'] : storedDetail ? [storedDetail.returnRoute] : [],
  );
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(storedProduct);
  const [selectedGiftId, setSelectedGiftId] = useState<number | null>(storedDetail?.giftId ?? null);
  const [giftRecipient, setGiftRecipient] = useState<SearchedUser | null>(null);
  const [giftResult, setGiftResult] = useState<SentGiftResult | null>(null);
  const [giftDialog, setGiftDialog] = useState<GiftDialog>(null);
  const [giftBusy, setGiftBusy] = useState(false);
  const idempotencyKey = useRef<string | null>(null);
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [friendSheetOpen, setFriendSheetOpen] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [birthdaySheetOpen, setBirthdaySheetOpen] = useState(false);
  const [recipientSheetOpen, setRecipientSheetOpen] = useState(false);
  const [recipientSelectionMode, setRecipientSelectionMode] = useState<'gift' | 'browse'>('gift');
  const [notificationSheetOpen, setNotificationSheetOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [friendsRefreshKey, setFriendsRefreshKey] = useState(0);
  const [filterOptions, setFilterOptions] = useState<ProductCategory[]>([]);
  const [filterLoading, setFilterLoading] = useState(false);
  const [filterError, setFilterError] = useState('');
  const [activeFilterIds, setActiveFilterIds] = useState<number[]>([]);
  const [signupDraft, setSignupDraft] = useState<SignupDraft>(emptySignupDraft);
  const [toast, setToast] = useState<string | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const [aiDraft, setAiDraft] = useState('');
  const [giftPreferenceDirty, setGiftPreferenceDirty] = useState(false);
  const [pendingTab, setPendingTab] = useState<MainTabRoute | null>(null);
  const scrollTops = useRef<Partial<Record<Route, number>>>({});
  const currentScroll = useCallback(
    () =>
      screenRef.current?.querySelector<HTMLElement>(
        '[data-testid="mobile-scroll"]:not(.route-preserved-scroll)',
      ),
    [screenRef],
  );
  useLayoutEffect(() => {
    const target = scrollTops.current[route] ?? 0;
    const first = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => currentScroll()?.scrollTo({ top: target }));
    });
    return () => window.cancelAnimationFrame(first);
  }, [currentScroll, route]);

  const dismissKeyboard = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    keyboard.hide();
  }, [keyboard]);

  const navigate = (next: Route, giftId = selectedGiftId) => {
    dismissKeyboard();
    scrollTops.current[route] = currentScroll()?.scrollTop ?? 0;
    setHistory((value) => [...value, route]);
    if (next !== 'product' && next !== 'ai-chat' && next !== 'complete') {
      setSelectedProduct(null);
      window.localStorage.removeItem(SELECTED_PRODUCT_STORAGE_KEY);
    }
    if (isRestorableRoute(next)) {
      const returnRoute =
        route === 'friends' || route === 'gifts' || route === 'mypage' ? route : 'mypage';
      window.localStorage.setItem(
        DETAIL_ROUTE_STORAGE_KEY,
        JSON.stringify({ route: next, returnRoute, giftId: giftId ?? undefined }),
      );
    } else {
      window.localStorage.removeItem(DETAIL_ROUTE_STORAGE_KEY);
    }
    setRoute(next);
  };

  const goBack = () => {
    dismissKeyboard();
    const next = history.at(-1) ?? 'friends';
    setRoute(next);
    setHistory((value) => value.slice(0, -1));
    window.localStorage.removeItem(DETAIL_ROUTE_STORAGE_KEY);
    if (next === 'gifts' || next === 'friends') {
      setSelectedProduct(null);
      window.localStorage.removeItem(SELECTED_PRODUCT_STORAGE_KEY);
    }
  };

  const setTabNow = (next: MainTabRoute) => {
    dismissKeyboard();
    setHistory([]);
    setRoute(next);
    window.localStorage.setItem(MAIN_TAB_STORAGE_KEY, next);
    window.localStorage.removeItem(DETAIL_ROUTE_STORAGE_KEY);
    setSelectedProduct(null);
    window.localStorage.removeItem(SELECTED_PRODUCT_STORAGE_KEY);
  };

  const setTab = (next: MainTabRoute) => {
    if (route === 'gift-preference' && giftPreferenceDirty) {
      setPendingTab(next);
      setDialog('leavePreference');
      return;
    }
    setTabNow(next);
  };

  const openAiChat = () => {
    setFriendSheetOpen(false);
    setFilterSheetOpen(false);
    setBirthdaySheetOpen(false);
    setRecipientSheetOpen(false);
    setNotificationSheetOpen(false);
    setOnboardingOpen(false);
    navigate('ai-chat');
  };

  const refreshProfile = useCallback(
    () =>
      void fetchMe()
        .then(setProfile)
        .catch(() => undefined),
    [],
  );
  const refreshUnread = useCallback(
    () =>
      void fetchUnreadNotificationCount()
        .then(setUnreadCount)
        .catch(() => undefined),
    [setUnreadCount],
  );
  useEffect(() => {
    if (route === 'login' || route === 'signup' || route === 'terms' || !loadSession()) return;
    refreshProfile();
    refreshUnread();
    const timer = window.setInterval(refreshUnread, 10_000);
    return () => window.clearInterval(timer);
  }, [route, refreshProfile, refreshUnread]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const expired = (event: Event) => {
      setHistory([]);
      setRoute('login');
      setGiftRecipient(null);
      setRecipientSheetOpen(false);
      if ((event as CustomEvent<{ hadSession: boolean }>).detail?.hadSession)
        setToast('세션이 만료됐어요. 다시 로그인해 주세요.');
    };
    window.addEventListener('prototype:session-expired', expired);
    return () => window.removeEventListener('prototype:session-expired', expired);
  }, []);

  const loadProductCategories = useCallback(() => {
    setFilterLoading(true);
    setFilterError('');
    return fetchProductCategories()
      .then(setFilterOptions)
      .catch(() => setFilterError('카테고리를 불러오지 못했습니다.'))
      .finally(() => setFilterLoading(false));
  }, []);

  const beginGift = async (recipient = giftRecipient) => {
    if (!selectedProduct) return;
    if (!recipient) {
      setRecipientSelectionMode('gift');
      setRecipientSheetOpen(true);
      return;
    }
    setGiftBusy(true);
    try {
      const preflight = await preflightGift({
        productId: selectedProduct.productId,
        recipientUserId: recipient.userId,
        quantity,
      });
      setGiftDialog(
        preflight.preferenceWarning
          ? { kind: 'preference', preflight }
          : { kind: 'confirm', preflight },
      );
    } catch (reason) {
      setToast(reason instanceof Error ? reason.message : '선물 조건을 확인하지 못했습니다.');
    } finally {
      setGiftBusy(false);
    }
  };

  const finalizeGift = async (preflight: GiftPreflight) => {
    if (!selectedProduct || !giftRecipient) return;
    idempotencyKey.current ??= makeIdempotencyKey();
    setGiftBusy(true);
    try {
      const result = await sendGift(
        {
          productId: selectedProduct.productId,
          recipientUserId: giftRecipient.userId,
          quantity,
          expectedUnitPrice: preflight.product.unitPrice,
        },
        idempotencyKey.current,
      );
      setGiftResult(result);
      setGiftRecipient(null);
      setGiftDialog(null);
      navigate('complete');
    } catch (reason) {
      const conditionError = reason instanceof ApiError ? getGiftConditionError(reason.code) : null;
      if (conditionError) {
        setGiftDialog({ kind: 'conditions', ...conditionError });
      } else {
        setToast(
          reason instanceof Error
            ? reason.message
            : '선물을 보내지 못했습니다. 다시 시도해 주세요.',
        );
      }
    } finally {
      setGiftBusy(false);
    }
  };

  const login = async (email: string, password: string) => {
    const result = await apiLogin(email, password);
    saveSession({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken ?? '',
      expiresIn: result.expiresIn,
      user: result.user,
    });
    setTabNow('friends');
    if (result.isFirstLogin) setOnboardingOpen(true);
  };
  const logout = () => {
    setDialog(null);
    void apiLogout()
      .catch(() => undefined)
      .finally(() => {
        clearSession();
        setGiftRecipient(null);
        setRecipientSheetOpen(false);
        setHistory([]);
        setRoute('login');
      });
  };
  const completeSignup = async (consents: SignupTermConsent[]) => {
    await apiSignup({
      name: signupDraft.name.trim(),
      birth: signupDraft.birthday.replaceAll('.', '-'),
      email: signupDraft.email.trim(),
      password: signupDraft.password,
      termConsents: consents,
    });
    setSignupDraft(emptySignupDraft);
    setHistory([]);
    setRoute('login');
    setToast('회원가입이 완료됐어요. 로그인해 주세요.');
  };

  const notificationAction =
    route === 'login' || route === 'signup' || route === 'terms' ? undefined : (
      <NotificationButton count={unreadCount} onClick={() => setNotificationSheetOpen(true)} />
    );
  const renderGiftsPage = () => (
    <GiftsPage
      filterCount={activeFilterIds.length}
      filterCategoryIds={activeFilterIds}
      recipientName={giftRecipient?.name}
      recipientUserId={giftRecipient?.userId}
      onSelectRecipient={() => {
        setRecipientSelectionMode('browse');
        setRecipientSheetOpen(true);
      }}
      onClearRecipient={() => {
        setGiftRecipient(null);
        idempotencyKey.current = null;
      }}
      action={route === 'gifts' ? notificationAction : undefined}
      onFilter={() => {
        setFilterSheetOpen(true);
        if (!filterOptions.length && !filterLoading) void loadProductCategories();
      }}
      onProduct={(product) => {
        setSelectedProduct(product);
        window.localStorage.setItem(SELECTED_PRODUCT_STORAGE_KEY, JSON.stringify(product));
        setQuantity(1);
        idempotencyKey.current = null;
        navigate('product');
      }}
    />
  );

  const selectHistoryGift = (giftId: number, detail: 'sent-detail' | 'received-detail') => {
    setSelectedGiftId(giftId);
    navigate(detail, giftId);
  };
  const renderPage = () => {
    if (route === 'friends')
      return (
        <FriendsPage
          refreshKey={friendsRefreshKey}
          action={notificationAction}
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
    if (route === 'gifts') return renderGiftsPage();
    if (route === 'product' && selectedProduct)
      return (
        <ProductPage
          product={selectedProduct}
          quantity={quantity}
          action={notificationAction}
          onDecrease={() => setQuantity((value) => Math.max(1, value - 1))}
          onIncrease={() => setQuantity((value) => Math.min(MAX_GIFT_QUANTITY, value + 1))}
          onBack={goBack}
          onGift={() => void beginGift()}
        />
      );
    if (route === 'ai-chat')
      return (
        <AiChatPage
          value={aiDraft}
          onChange={setAiDraft}
          onBack={goBack}
          onUnavailable={() => setToast('AI 추천 기능은 준비 중이에요.')}
        />
      );
    if (route === 'mypage')
      return (
        <MyPage
          profile={profile}
          action={notificationAction}
          onAccount={() => navigate('account')}
          onReceived={() => navigate('received')}
          onSent={() => navigate('sent')}
          onPreferences={() => navigate('preferences')}
          onGiftPreference={() => navigate('gift-preference')}
        />
      );
    if (route === 'account')
      return (
        <AccountPage
          profile={profile}
          action={notificationAction}
          onBack={goBack}
          onBirthday={() => setBirthdaySheetOpen(true)}
          onBirthdayPublic={() =>
            profile?.isBirthdayPublic
              ? void updateMe({ isBirthdayPublic: false }).then(refreshProfile)
              : setDialog('birthdayConsent')
          }
          onLogout={() => setDialog('logout')}
        />
      );
    if (route === 'received')
      return (
        <ReceivedGiftsPage
          onBack={goBack}
          action={notificationAction}
          onSelect={(id) => selectHistoryGift(id, 'received-detail')}
        />
      );
    if (route === 'sent')
      return (
        <SentGiftsPage
          onBack={goBack}
          action={notificationAction}
          onSelect={(id) => selectHistoryGift(id, 'sent-detail')}
        />
      );
    if (route === 'received-detail' && selectedGiftId != null)
      return (
        <ReceivedGiftDetailPage
          giftId={selectedGiftId}
          onBack={goBack}
          action={notificationAction}
        />
      );
    if (route === 'sent-detail' && selectedGiftId != null)
      return (
        <SentGiftDetailPage giftId={selectedGiftId} onBack={goBack} action={notificationAction} />
      );
    if (route === 'preferences')
      return (
        <PreferencesPage
          action={notificationAction}
          onBack={goBack}
          onSaved={() => {
            setToast('비선호 카테고리를 저장했습니다.');
            goBack();
          }}
        />
      );
    if (route === 'gift-preference')
      return (
        <GiftPreferencePage
          action={notificationAction}
          onBack={goBack}
          onDirtyChange={setGiftPreferenceDirty}
          onSaved={() => setToast('저장되었습니다.')}
        />
      );
    if (route === 'complete' && giftResult)
      return (
        <CompletePage
          result={giftResult}
          action={notificationAction}
          onFriends={() => setTabNow('friends')}
          onSent={() => {
            setSelectedGiftId(giftResult.giftId);
            navigate('sent-detail', giftResult.giftId);
          }}
        />
      );
    return null;
  };

  const showBottomNav = route === 'friends' || route === 'gifts' || route === 'mypage';
  const bottomRoute: MainTabRoute =
    route === 'ai-chat'
      ? 'gifts'
      : route === 'gift-preference'
        ? 'mypage'
        : (route as MainTabRoute);
  const preserveGiftList = route === 'gifts' || route === 'product';
  const showFloatingAiMenu =
    route !== 'login' && route !== 'signup' && route !== 'terms' && route !== 'ai-chat';

  return (
    <div className="gift-app" data-testid="gift-app" data-route={route}>
      {preserveGiftList ? (
        <MobileScroll
          key="gifts"
          className={`app-screen ${route === 'product' ? 'route-preserved-scroll' : ''}`}
        >
          <div className="screen-body has-bottom-nav">
            <Suspense fallback={null}>{renderGiftsPage()}</Suspense>
          </div>
        </MobileScroll>
      ) : null}
      {route !== 'gifts' ? (
        <MobileScroll key={route} className="app-screen">
          <div className={`screen-body ${showBottomNav ? 'has-bottom-nav' : ''}`}>
            <Suspense
              fallback={
                <div className="cursor-status">
                  <span className="loading-dot" /> 불러오는 중
                </div>
              }
            >
              {renderPage()}
            </Suspense>
          </div>
        </MobileScroll>
      ) : null}
      {showBottomNav ? <BottomNavigation route={bottomRoute} onSelect={setTab} /> : null}
      <Toast message={toast} container={screenRef.current} />
      <BugReportWidget
        key={`bug-report-${route}`}
        route={route}
        containerRef={screenRef}
        enabledInProduction
        raised={showBottomNav}
        showAiAction={showFloatingAiMenu}
        onOpenAi={openAiChat}
      />
      <AddFriendSheet
        open={friendSheetOpen}
        currentUserId={profile?.userId ?? loadSession()?.user?.userId ?? null}
        onOpenChange={setFriendSheetOpen}
        onAdded={() => setFriendsRefreshKey((value) => value + 1)}
        onError={setToast}
      />
      <ProductFilterSheet
        open={filterSheetOpen}
        options={filterOptions}
        selected={activeFilterIds}
        loading={filterLoading}
        error={filterError}
        onApply={setActiveFilterIds}
        onRetry={() => void loadProductCategories()}
        onOpenChange={setFilterSheetOpen}
      />
      <EditBirthdaySheet
        open={birthdaySheetOpen}
        birthday={(profile?.birth ?? '2000-01-01').replaceAll('-', '.')}
        onOpenChange={setBirthdaySheetOpen}
        onSave={(birthday) => {
          setBirthdaySheetOpen(false);
          void updateMe({ birth: birthday.replaceAll('.', '-') }).then(refreshProfile);
        }}
      />
      <SelectRecipientSheet
        open={recipientSheetOpen}
        onOpenChange={setRecipientSheetOpen}
        onSelect={(friend) => {
          setGiftRecipient(friend);
          setRecipientSheetOpen(false);
          idempotencyKey.current = null;
          if (recipientSelectionMode === 'gift') void beginGift(friend);
        }}
      />
      <NotificationSheet
        open={notificationSheetOpen}
        onOpenChange={setNotificationSheetOpen}
        onRead={(count) => setUnreadCount(count)}
        onSelect={(notification: Notification) => {
          if (notification.referenceType !== 'GIFT' || notification.referenceId == null) return;
          setSelectedGiftId(notification.referenceId);
          navigate('received-detail', notification.referenceId);
        }}
      />
      {onboardingOpen ? (
        <OnboardingPreferenceSheet
          open
          onSkip={() => {
            setOnboardingOpen(false);
            void completeOnboarding();
          }}
          onComplete={() => {
            setOnboardingOpen(false);
            setToast('비선호 카테고리가 저장되었습니다.');
            void completeOnboarding();
          }}
        />
      ) : null}
      {dialog === 'birthdayConsent' ? (
        <AppDialog
          title="생일을 공개할까요?"
          body="나를 친구로 등록한 사용자에게 생일 월·일이 보여요."
          confirmLabel="동의하고 공개"
          onCancel={() => setDialog(null)}
          onConfirm={() => {
            setDialog(null);
            void updateMe({ isBirthdayPublic: true }).then(refreshProfile);
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
      {dialog === 'leavePreference' ? (
        <AppDialog
          title="변경사항을 저장하지 않고 이동할까요?"
          body="작성 중인 선물 취향은 저장되지 않아요."
          cancelLabel="계속 작성"
          confirmLabel="이동하기"
          onCancel={() => {
            setDialog(null);
            setPendingTab(null);
          }}
          onConfirm={() => {
            const next = pendingTab;
            setDialog(null);
            setPendingTab(null);
            setGiftPreferenceDirty(false);
            if (next) setTabNow(next);
          }}
        />
      ) : null}
      {giftDialog?.kind === 'preference' ? (
        <AppDialog
          title="정말 보내시겠어요?"
          body={`${giftRecipient?.name ?? '받는 분'}님이 ${giftDialog.preflight.preferenceWarning?.categoryName} 카테고리를 선호하지 않을 수 있어요.`}
          cancelLabel="다른 선물 보기"
          confirmLabel="그래도 선물하기"
          busy={giftBusy}
          onCancel={() => {
            setGiftDialog(null);
            setSelectedProduct(null);
            window.localStorage.removeItem(SELECTED_PRODUCT_STORAGE_KEY);
            setRoute('gifts');
          }}
          onConfirm={() => setGiftDialog({ kind: 'confirm', preflight: giftDialog.preflight })}
        />
      ) : null}
      {giftDialog?.kind === 'confirm' ? (
        <AppDialog
          title={`${giftRecipient?.name ?? '받는 분'}님에게 이 선물을 보낼까요?`}
          body="상품과 수량을 확인한 뒤 선물을 보내주세요."
          cancelLabel="다시 선택하기"
          confirmLabel="선물 보내기"
          busy={giftBusy}
          onCancel={() => setGiftDialog(null)}
          onConfirm={() => void finalizeGift(giftDialog.preflight)}
        />
      ) : null}
      {giftDialog?.kind === 'conditions' ? (
        <AppDialog
          title={giftDialog.title}
          body={giftDialog.body}
          cancelLabel="닫기"
          confirmLabel="다시 확인하러 가기"
          onCancel={() => setGiftDialog(null)}
          onConfirm={() => {
            setGiftDialog(null);
            setRoute('product');
          }}
        />
      ) : null}
    </div>
  );
}

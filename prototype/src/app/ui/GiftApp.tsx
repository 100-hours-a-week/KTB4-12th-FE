import { lazy, Suspense, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

import {
  login as apiLogin,
  logout as apiLogout,
  signup as apiSignup,
  type SignupTermConsent,
} from '../../entities/auth';
import {
  type Friend,
  type FriendRequest,
  type FriendRequestAction,
  type FriendRequestDirection,
  processFriendRequest,
  removeFriend,
} from '../../entities/friend';
import {
  getGiftConditionError,
  type GiftPreflight,
  MAX_GIFT_QUANTITY,
  preflightGift,
  sendGift,
  type SentGiftResult,
} from '../../entities/gift';
import {
  fetchUnreadNotificationCount,
  markNotificationRead,
  type Notification,
  subscribeNotifications,
} from '../../entities/notification';
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
import {
  NotificationBanner,
  NotificationButton,
  NotificationSheet,
} from '../../features/view-notifications';
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
  const [sessionKey, setSessionKey] = useState(0);
  const [profile, setProfile] = useState<MyProfile | null>(null);
  const sessionVersion = useRef(0);
  const [quantity, setQuantity] = useState(1);
  const [friendSheetOpen, setFriendSheetOpen] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [birthdaySheetOpen, setBirthdaySheetOpen] = useState(false);
  const [birthdaySheetSession, setBirthdaySheetSession] = useState(0);
  const [recipientSheetOpen, setRecipientSheetOpen] = useState(false);
  const [recipientSelectionMode, setRecipientSelectionMode] = useState<'gift' | 'browse'>('gift');
  const [notificationBanner, setNotificationBanner] = useState<Notification | null>(null);
  const [notificationRefreshKey, setNotificationRefreshKey] = useState(0);
  const [notificationBannerBusy, setNotificationBannerBusy] = useState(false);
  const notificationSelectionBusy = useRef(false);
  const [notificationSheetOpen, setNotificationSheetOpen] = useState(false);
  const [onboardingOpen, setOnboardingOpen] = useState(false);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [friendsRefreshKey, setFriendsRefreshKey] = useState(0);
  const [friendsView, setFriendsView] = useState<'friends' | FriendRequestDirection>('friends');
  const [friendRequestDialog, setFriendRequestDialog] = useState<{
    request: FriendRequest;
    action: FriendRequestAction;
  } | null>(null);
  const [friendRequestBusy, setFriendRequestBusy] = useState(false);
  const [friendToRemove, setFriendToRemove] = useState<Friend | null>(null);
  const [friendRemoveBusy, setFriendRemoveBusy] = useState(false);
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
    // Browser focus scrolling must stay inside MobileScroll when a route changes.
    screenRef.current?.scrollTo({ top: 0, left: 0 });
    const target = scrollTops.current[route] ?? 0;
    const first = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => currentScroll()?.scrollTo({ top: target }));
    });
    return () => window.cancelAnimationFrame(first);
  }, [currentScroll, route, screenRef]);

  const dismissKeyboard = useCallback(() => {
    if (
      document.activeElement instanceof HTMLElement &&
      document.activeElement.matches('input, textarea, [contenteditable="true"]')
    ) {
      document.activeElement.blur();
    }
    keyboard.hide();
  }, [keyboard]);

  const resetSessionState = useCallback(() => {
    dismissKeyboard();
    sessionVersion.current += 1;
    setSessionKey((value) => value + 1);
    setProfile(null);
    setUnreadCount(0);
    setNotificationBanner(null);
    setNotificationBannerBusy(false);
    notificationSelectionBusy.current = false;
    setGiftRecipient(null);
    setSelectedProduct(null);
    setSelectedGiftId(null);
    setGiftResult(null);
    setGiftDialog(null);
    setGiftBusy(false);
    idempotencyKey.current = null;
    setQuantity(1);
    setFriendSheetOpen(false);
    setFilterSheetOpen(false);
    setBirthdaySheetOpen(false);
    setRecipientSheetOpen(false);
    setNotificationSheetOpen(false);
    setOnboardingOpen(false);
    setDialog(null);
    setFriendRequestDialog(null);
    setFriendRequestBusy(false);
    setFriendToRemove(null);
    setFriendRemoveBusy(false);
    setFriendsView('friends');
    setActiveFilterIds([]);
    setAiDraft('');
    setGiftPreferenceDirty(false);
    setPendingTab(null);
    setSignupDraft(emptySignupDraft);
    setToast(null);
    setHistory([]);
    scrollTops.current = {};
  }, [dismissKeyboard]);

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

  const refreshProfile = useCallback(() => {
    if (!loadSession()) return;
    const version = sessionVersion.current;
    void fetchMe()
      .then((nextProfile) => {
        if (version === sessionVersion.current) setProfile(nextProfile);
      })
      .catch(() => undefined);
  }, []);
  const refreshUnread = useCallback(() => {
    if (!loadSession()) return;
    const version = sessionVersion.current;
    void fetchUnreadNotificationCount()
      .then((count) => {
        if (version === sessionVersion.current) setUnreadCount(count);
      })
      .catch(() => undefined);
  }, []);
  const updateProfile = async (updates: Parameters<typeof updateMe>[0]) => {
    const version = sessionVersion.current;
    try {
      await updateMe(updates);
      if (version === sessionVersion.current) refreshProfile();
    } catch (reason) {
      if (version !== sessionVersion.current) return;
      setToast(reason instanceof Error ? reason.message : '내 정보를 저장하지 못했습니다.');
    }
  };
  useEffect(() => {
    if (route === 'login' || route === 'signup' || route === 'terms' || !loadSession()) return;
    refreshProfile();
    refreshUnread();
  }, [route, refreshProfile, refreshUnread]);
  const notificationsEnabled =
    route !== 'login' && route !== 'signup' && route !== 'terms' && Boolean(loadSession());
  useEffect(() => {
    if (!notificationsEnabled) return;
    return subscribeNotifications((notification) => {
      setNotificationBanner(notification);
      setNotificationRefreshKey((value) => value + 1);
      refreshUnread();
    }, refreshUnread);
  }, [notificationsEnabled, sessionKey, refreshUnread]);
  useEffect(() => {
    if (!notificationBanner || notificationBannerBusy) return;
    const timer = window.setTimeout(() => setNotificationBanner(null), 6000);
    return () => window.clearTimeout(timer);
  }, [notificationBanner, notificationBannerBusy]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(timer);
  }, [toast]);
  useEffect(() => {
    const expired = (event: Event) => {
      resetSessionState();
      setRoute('login');
      if ((event as CustomEvent<{ hadSession: boolean }>).detail?.hadSession)
        setToast('세션이 만료됐어요. 다시 로그인해 주세요.');
    };
    window.addEventListener('prototype:session-expired', expired);
    return () => window.removeEventListener('prototype:session-expired', expired);
  }, [resetSessionState]);

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
    const version = sessionVersion.current;
    setGiftBusy(true);
    try {
      const preflight = await preflightGift({
        productId: selectedProduct.productId,
        recipientUserId: recipient.userId,
        quantity,
      });
      if (version !== sessionVersion.current) return;
      setGiftDialog(
        preflight.preferenceWarning
          ? { kind: 'preference', preflight }
          : { kind: 'confirm', preflight },
      );
    } catch (reason) {
      if (version !== sessionVersion.current) return;
      setToast(reason instanceof Error ? reason.message : '선물 조건을 확인하지 못했습니다.');
    } finally {
      if (version === sessionVersion.current) setGiftBusy(false);
    }
  };

  const finalizeGift = async (preflight: GiftPreflight) => {
    if (!selectedProduct || !giftRecipient) return;
    idempotencyKey.current ??= makeIdempotencyKey();
    const version = sessionVersion.current;
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
      if (version !== sessionVersion.current) return;
      setGiftResult(result);
      setGiftRecipient(null);
      setGiftDialog(null);
      navigate('complete');
    } catch (reason) {
      if (version !== sessionVersion.current) return;
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
      if (version === sessionVersion.current) setGiftBusy(false);
    }
  };

  const login = async (email: string, password: string) => {
    const result = await apiLogin(email, password);
    resetSessionState();
    saveSession({
      accessToken: result.accessToken,
      refreshToken: result.refreshToken ?? '',
      expiresIn: result.expiresIn,
      user: result.user,
    });
    setTabNow('friends');
    if (result.isFirstLogin) setOnboardingOpen(true);
  };
  const completeFriendRequest = async () => {
    if (!friendRequestDialog || friendRequestBusy) return;
    const version = sessionVersion.current;
    setFriendRequestBusy(true);
    try {
      await processFriendRequest(friendRequestDialog.request.requestId, friendRequestDialog.action);
      if (version !== sessionVersion.current) return;
      setFriendRequestDialog(null);
      setFriendsRefreshKey((value) => value + 1);
      setToast(
        {
          accept: '친구 요청을 수락했습니다.',
          reject: '친구 요청을 거절했습니다.',
          cancel: '친구 요청을 취소했습니다.',
        }[friendRequestDialog.action],
      );
    } catch (reason) {
      if (version !== sessionVersion.current) return;
      setToast(
        reason instanceof Error
          ? reason.message
          : '친구 요청을 처리하지 못했습니다. 다시 시도해 주세요.',
      );
      if (
        reason instanceof ApiError &&
        [
          'FRIEND_REQUEST_NOT_FOUND',
          'FRIEND_REQUEST_ALREADY_PROCESSED',
          'FRIEND_REQUEST_FORBIDDEN',
        ].includes(reason.code ?? '')
      ) {
        setFriendRequestDialog(null);
        setFriendsRefreshKey((value) => value + 1);
      }
    } finally {
      if (version === sessionVersion.current) setFriendRequestBusy(false);
    }
  };
  const deleteFriend = async () => {
    if (!friendToRemove || friendRemoveBusy) return;
    const version = sessionVersion.current;
    setFriendRemoveBusy(true);
    try {
      await removeFriend(friendToRemove.friendId);
      if (version !== sessionVersion.current) return;
      setFriendToRemove(null);
      setFriendsRefreshKey((value) => value + 1);
      if (giftRecipient?.userId === friendToRemove.userId) setGiftRecipient(null);
      setToast('친구를 삭제했습니다.');
    } catch (reason) {
      if (version !== sessionVersion.current) return;
      setToast(
        reason instanceof Error
          ? reason.message
          : '친구를 삭제하지 못했습니다. 다시 시도해 주세요.',
      );
      if (reason instanceof ApiError && reason.code === 'FRIEND_NOT_FOUND') {
        setFriendToRemove(null);
        setFriendsRefreshKey((value) => value + 1);
        if (giftRecipient?.userId === friendToRemove.userId) setGiftRecipient(null);
      }
    } finally {
      if (version === sessionVersion.current) setFriendRemoveBusy(false);
    }
  };
  const logout = () => {
    const version = sessionVersion.current;
    setDialog(null);
    void apiLogout()
      .catch(() => undefined)
      .finally(() => {
        if (version !== sessionVersion.current) return;
        clearSession();
        resetSessionState();
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

  const selectNotification = (notification: Notification) => {
    if (notification.type === 'FRIEND_REQUEST_RECEIVED') {
      setFriendsView('received');
      setFriendsRefreshKey((value) => value + 1);
      setTabNow('friends');
      return;
    }
    if (notification.referenceType !== 'GIFT' || notification.referenceId == null) return;
    setSelectedGiftId(notification.referenceId);
    navigate('received-detail', notification.referenceId);
  };
  const selectBanner = async () => {
    if (!notificationBanner || notificationSelectionBusy.current) return;
    const version = sessionVersion.current;
    const selected = notificationBanner;
    notificationSelectionBusy.current = true;
    setNotificationBannerBusy(true);
    try {
      const result = await markNotificationRead(selected.notificationId);
      if (version !== sessionVersion.current) return;
      setUnreadCount(result.unreadCount);
      setNotificationRefreshKey((value) => value + 1);
      setNotificationBanner((current) =>
        current?.notificationId === selected.notificationId ? null : current,
      );
      setNotificationSheetOpen(false);
      selectNotification(selected);
    } catch (reason) {
      if (version === sessionVersion.current)
        setToast(reason instanceof Error ? reason.message : '알림을 읽지 못했습니다.');
    } finally {
      if (version === sessionVersion.current) {
        notificationSelectionBusy.current = false;
        setNotificationBannerBusy(false);
      }
    }
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
          view={friendsView}
          onViewChange={setFriendsView}
          onRemove={(friend) => {
            dismissKeyboard();
            setFriendToRemove(friend);
          }}
          onRequestAction={(request, action) => {
            dismissKeyboard();
            setFriendRequestDialog({ request, action });
          }}
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
          onBirthday={() => {
            setBirthdaySheetSession((session) => session + 1);
            setBirthdaySheetOpen(true);
          }}
          onBirthdayPublic={() =>
            profile?.isBirthdayPublic
              ? void updateProfile({ isBirthdayPublic: false })
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
      <NotificationBanner
        notification={notificationBanner}
        busy={notificationBannerBusy}
        onSelect={() => void selectBanner()}
        onDismiss={() => setNotificationBanner(null)}
      />
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
        key={`friend-${sessionKey}`}
        open={friendSheetOpen}
        currentUserId={loadSession()?.user?.userId ?? profile?.userId ?? null}
        onOpenChange={setFriendSheetOpen}
        onAdded={() => {
          setFriendsRefreshKey((value) => value + 1);
          setToast('친구 요청을 보냈습니다.');
        }}
        onError={setToast}
      />
      <ProductFilterSheet
        key={`filter-${sessionKey}`}
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
        key={`birthday-${sessionKey}-${birthdaySheetSession}`}
        open={birthdaySheetOpen}
        birthday={(profile?.birth ?? '2000-01-01').replaceAll('-', '.')}
        onOpenChange={setBirthdaySheetOpen}
        onSave={(birthday) => {
          setBirthdaySheetOpen(false);
          void updateProfile({ birth: birthday.replaceAll('.', '-') });
        }}
      />
      <SelectRecipientSheet
        key={`recipient-${sessionKey}`}
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
        key={`notification-${sessionKey}`}
        open={notificationSheetOpen}
        onOpenChange={setNotificationSheetOpen}
        onRead={(count) => setUnreadCount(count)}
        refreshKey={notificationRefreshKey}
        onSelect={selectNotification}
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
            void updateProfile({ isBirthdayPublic: true });
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
      {friendRequestDialog ? (
        <AppDialog
          title={
            { accept: '친구 요청 수락', reject: '친구 요청 거절', cancel: '친구 요청 취소' }[
              friendRequestDialog.action
            ]
          }
          body={
            friendRequestDialog.action === 'cancel'
              ? `${friendRequestDialog.request.receiverName}님에게 보낸 친구 요청을 취소할까요?`
              : `${friendRequestDialog.request.requesterName}님의 친구 요청을 ${friendRequestDialog.action === 'accept' ? '수락' : '거절'}할까요?`
          }
          confirmLabel={
            { accept: '수락', reject: '거절', cancel: '요청 취소' }[friendRequestDialog.action]
          }
          cancelLabel="돌아가기"
          danger={friendRequestDialog.action !== 'accept'}
          busy={friendRequestBusy}
          onCancel={() => {
            if (!friendRequestBusy) setFriendRequestDialog(null);
          }}
          onConfirm={() => void completeFriendRequest()}
        />
      ) : null}
      {friendToRemove ? (
        <AppDialog
          title="친구 삭제"
          body={`${friendToRemove.name}님을 친구 목록에서 삭제할까요?`}
          confirmLabel="삭제"
          cancelLabel="돌아가기"
          danger
          busy={friendRemoveBusy}
          onCancel={() => {
            if (!friendRemoveBusy) setFriendToRemove(null);
          }}
          onConfirm={() => void deleteFriend()}
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

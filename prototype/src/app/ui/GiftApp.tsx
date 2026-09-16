import { useState } from 'react';

import { mockProducts, type Product } from '../../entities/product';
import { AddFriendSheet } from '../../features/add-friend';
import { EditBirthdaySheet } from '../../features/edit-birthday';
import { ProductFilterSheet } from '../../features/filter-products';
import { MobileScroll, useKeyboard, useScreenPortal } from '../../mobile';
import { FriendsPage } from '../../pages/friends';
import { ReceivedGiftsPage, SentGiftsPage } from '../../pages/gift-history';
import { CompletePage, GiftsPage, ProductPage } from '../../pages/gifts';
import { LoginPage, TEST_ACCOUNT } from '../../pages/login';
import { AccountPage, MyPage, PreferencesPage } from '../../pages/profile';
import { type SignupDraft, SignupPage, TermsAgreementPage } from '../../pages/signup';
import type { MainTabRoute, Route } from '../../shared/model/navigation';
import { AppDialog } from '../../shared/ui';
import { BottomNavigation } from '../../widgets/bottom-navigation';

type DialogKind = 'birthdayConsent' | 'logout' | null;

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
    window.localStorage.getItem('prototype-auth') === 'signed-out' ? 'login' : 'friends',
  );
  const [history, setHistory] = useState<Route[]>([]);
  const [friendSheetOpen, setFriendSheetOpen] = useState(false);
  const [filterSheetOpen, setFilterSheetOpen] = useState(false);
  const [birthdaySheetOpen, setBirthdaySheetOpen] = useState(false);
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [friendSearchEditing, setFriendSearchEditing] = useState(false);
  const [addedFriends, setAddedFriends] = useState<string[]>(['김민주']);
  const [query, setQuery] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [selectedProduct, setSelectedProduct] = useState<Product>(mockProducts[0]);
  const [birthday, setBirthday] = useState('2000.01.01');
  const [birthdayPublic, setBirthdayPublic] = useState(false);
  const [selectedCategories, setSelectedCategories] = useState(['뷰티', '카페/디저트', '생활']);
  const [activeFilters, setActiveFilters] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const [signupDraft, setSignupDraft] = useState<SignupDraft>(emptySignupDraft);

  const dismissKeyboard = () => {
    if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    keyboard.hide();
    screenRef.current?.scrollTo({ top: 0, left: 0 });
    window.requestAnimationFrame(() => screenRef.current?.scrollTo({ top: 0, left: 0 }));
  };

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
  };

  const handleFriendSheetChange = (open: boolean) => {
    setFriendSearchEditing(false);
    if (!open) dismissKeyboard();
    setFriendSheetOpen(open);
  };

  const login = (email: string, password: string) => {
    if (email !== TEST_ACCOUNT.email || password !== TEST_ACCOUNT.password) return false;
    window.localStorage.setItem('prototype-auth', 'signed-in');
    window.localStorage.setItem('accessToken', 'prototype-test-token');
    setTab('friends');
    return true;
  };

  const logout = () => {
    dismissKeyboard();
    window.localStorage.setItem('prototype-auth', 'signed-out');
    window.localStorage.removeItem('accessToken');
    setHistory([]);
    setRoute('login');
    setDialog(null);
  };

  const renderPage = () => {
    if (route === 'friends')
      return (
        <FriendsPage onAdd={() => handleFriendSheetChange(true)} onGift={() => navigate('gifts')} />
      );
    if (route === 'login') return <LoginPage onLogin={login} onSignup={() => navigate('signup')} />;
    if (route === 'signup')
      return (
        <SignupPage
          draft={signupDraft}
          onDraftChange={setSignupDraft}
          onComplete={() => navigate('terms')}
        />
      );
    if (route === 'terms')
      return (
        <TermsAgreementPage
          onBack={goBack}
          onComplete={() => {
            window.localStorage.setItem('prototype-auth', 'signed-in');
            window.localStorage.setItem('accessToken', 'prototype-test-token');
            setSignupDraft(emptySignupDraft);
            setTab('friends');
          }}
        />
      );
    if (route === 'gifts')
      return (
        <GiftsPage
          filterCount={activeFilters.length}
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
          onAccount={() => navigate('account')}
          onSent={() => navigate('sent')}
          onReceived={() => navigate('received')}
          onPreferences={() => navigate('preferences')}
        />
      );
    if (route === 'product')
      return (
        <ProductPage
          product={selectedProduct}
          quantity={quantity}
          onDecrease={() => setQuantity((value) => Math.max(1, value - 1))}
          onIncrease={() => setQuantity((value) => value + 1)}
          onBack={goBack}
          onGift={() => navigate('complete')}
        />
      );
    if (route === 'complete')
      return (
        <CompletePage
          product={selectedProduct}
          quantity={quantity}
          onFriends={() => setTab('friends')}
          onReceived={() => navigate('received')}
        />
      );
    if (route === 'sent') return <SentGiftsPage onBack={goBack} />;
    if (route === 'received') return <ReceivedGiftsPage onBack={goBack} />;
    if (route === 'preferences')
      return (
        <PreferencesPage
          selected={selectedCategories}
          saved={saved}
          onBack={goBack}
          onToggle={(name) => {
            setSaved(false);
            setSelectedCategories((current) =>
              current.includes(name)
                ? current.filter((item) => item !== name)
                : current.length < 5
                  ? [...current, name]
                  : current,
            );
          }}
          onSave={() => setSaved(true)}
        />
      );
    return (
      <AccountPage
        birthday={birthday}
        birthdayPublic={birthdayPublic}
        onBack={goBack}
        onBirthday={() => setBirthdaySheetOpen(true)}
        onBirthdayPublic={() =>
          birthdayPublic ? setBirthdayPublic(false) : setDialog('birthdayConsent')
        }
        onLogout={() => setDialog('logout')}
      />
    );
  };

  const showBottomNav = route === 'friends' || route === 'gifts' || route === 'mypage';

  return (
    <div className="gift-app" data-testid="gift-app" data-route={route}>
      <MobileScroll key={route} className="app-screen">
        <div className={`screen-body ${showBottomNav ? 'has-bottom-nav' : ''}`}>{renderPage()}</div>
      </MobileScroll>
      {showBottomNav ? <BottomNavigation route={route} onSelect={setTab} /> : null}

      <AddFriendSheet
        open={friendSheetOpen}
        editing={friendSearchEditing}
        query={query}
        addedFriends={addedFriends}
        onOpenChange={handleFriendSheetChange}
        onStartEditing={() => setFriendSearchEditing(true)}
        onQueryChange={setQuery}
        onToggleFriend={(name) =>
          setAddedFriends((current) =>
            current.includes(name) ? current.filter((item) => item !== name) : [...current, name],
          )
        }
      />
      <ProductFilterSheet
        open={filterSheetOpen}
        selected={activeFilters}
        onToggle={(name) =>
          setActiveFilters((current) =>
            current.includes(name) ? current.filter((item) => item !== name) : [...current, name],
          )
        }
        onClear={() => setActiveFilters([])}
        onOpenChange={setFilterSheetOpen}
      />
      <EditBirthdaySheet
        open={birthdaySheetOpen}
        birthday={birthday}
        onOpenChange={setBirthdaySheetOpen}
        onBirthdayChange={setBirthday}
        onSave={() => {
          dismissKeyboard();
          setBirthdaySheetOpen(false);
        }}
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
    </div>
  );
}

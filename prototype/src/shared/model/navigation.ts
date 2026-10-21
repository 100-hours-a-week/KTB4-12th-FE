export type MainTabRoute = 'friends' | 'gifts' | 'mypage';
export type Route =
  | MainTabRoute
  | 'login'
  | 'signup'
  | 'terms'
  | 'product'
  | 'received'
  | 'sent'
  | 'received-detail'
  | 'sent-detail'
  | 'preferences'
  | 'gift-preference'
  | 'ai-chat'
  | 'account';

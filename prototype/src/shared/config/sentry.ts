import * as Sentry from '@sentry/react';

const DEFAULT_SENTRY_DSN =
  'https://00698bc9b8e640d9e7a49a29a0115fce@o4512162552086528.ingest.us.sentry.io/4512162950348800';

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN || DEFAULT_SENTRY_DSN,
  environment: import.meta.env.MODE,
});

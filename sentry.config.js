import * as Sentry from 'sentry-expo';
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  enableInExpoDevelopment: true,
  debug: true,
});
export default Sentry;

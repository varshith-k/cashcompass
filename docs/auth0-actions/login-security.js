/**
 * CashCompass sign-in security: Auth0 post-login Action.
 * Paste into Auth0 → Actions → Library → Create Action → "Login / Post Login",
 * deploy it, then add it to Actions → Triggers → post-login (docs/AUTH0_SETUP.md §7).
 *
 * Two-factor sign-in is optional: users who turn on "Two-factor sign-in" in
 * CashCompass Settings (app_metadata.login_security === "app") are asked for a
 * code from an authenticator app (Google Authenticator, Authy or similar) after
 * their password or Google sign-in. On the first sign-in Auth0 shows a QR code
 * to set it up. Everyone else signs in as usual.
 *
 * Auth0 can only email a code to users who already have another factor, so
 * an emailed code can't be the default for everyone.
 */
exports.onExecutePostLogin = async (event, api) => {
  const optedIn = event.user.app_metadata && event.user.app_metadata.login_security === "app";
  if (!optedIn) return;
  api.multifactor.enable("any", { allowRememberBrowser: false });
};

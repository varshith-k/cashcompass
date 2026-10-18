/**
 * CashCompass sign-in security: Auth0 post-login Action.
 * Paste into Auth0 → Actions → Library → Create Action → "Login / Post Login",
 * deploy it, then add it to Actions → Triggers → post-login (docs/AUTH0_SETUP.md §7).
 *
 * - 2FA is always on: after the password or Google sign-in, Auth0 emails a 6-digit code.
 * - MFA is optional: users who turn on "Use an authenticator app" in CashCompass Settings
 *   (app_metadata.login_security === "app") use Google Authenticator, Authy or similar instead.
 * - A code can only be emailed to a verified address, so until a user verifies their
 *   email they're asked to set up an authenticator app instead.
 */
exports.onExecutePostLogin = async (event, api) => {
  const wantsApp = event.user.app_metadata && event.user.app_metadata.login_security === "app";
  const hasApp = (event.user.enrolledFactors || []).some((factor) => factor.type === "otp");

  if (wantsApp || !event.user.email_verified) {
    if (hasApp) {
      api.authentication.challengeWith({ type: "otp" });
    } else {
      // First time: Auth0 shows a QR code to scan, then asks for the code.
      api.authentication.enrollWith({ type: "otp" });
    }
    return;
  }

  api.authentication.challengeWith({ type: "email" });
};

// Maps SDK/Auth0 error codes to fixed, user-safe copy. The raw error message
// is never shown: OAuth errors can echo attacker-controlled query params.

export type AuthErrorCode =
  | "access_denied"
  | "session_expired"
  | "configuration"
  | "unavailable"
  | "unknown";

export const AUTH_ERROR_COPY: Record<AuthErrorCode, { title: string; message: string }> = {
  access_denied: {
    title: "Sign-in was cancelled",
    message: "You didn't finish signing in, or access was declined. You can try again whenever you're ready.",
  },
  session_expired: {
    title: "Your sign-in link expired",
    message: "The sign-in attempt took too long or was opened in a different browser. Please start again.",
  },
  configuration: {
    title: "Sign-in isn't available right now",
    message: "CashCompass couldn't reach its sign-in service. Please try again in a moment.",
  },
  unavailable: {
    title: "We couldn't reach the sign-in service",
    message: "This is usually temporary. Check your connection and try again.",
  },
  unknown: {
    title: "Something went wrong while signing in",
    message: "Please try again. If it keeps happening, clear this site's cookies and retry.",
  },
};

/** Normalizes an SDK `error.code` (or OAuth `error` value) to an AuthErrorCode. */
export function classifyAuthError(code: string | null | undefined): AuthErrorCode {
  switch (code) {
    case "access_denied":
    case "unauthorized":
    case "login_required":
    case "consent_required":
      return "access_denied";
    case "missing_state":
    case "invalid_state":
    case "authorization_code_grant_request_error":
      return "session_expired";
    case "invalid_configuration":
    case "invalid_client":
    case "unauthorized_client":
      return "configuration";
    case "discovery_error":
    case "temporarily_unavailable":
    case "server_error":
      return "unavailable";
    default:
      return code && code in AUTH_ERROR_COPY ? (code as AuthErrorCode) : "unknown";
  }
}

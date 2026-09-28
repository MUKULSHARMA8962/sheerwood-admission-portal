import { useCallback, useEffect, useMemo, useRef } from "react";
import { useAuth } from "react-oidc-context";
import { deriveRole } from "./cognito";
import { CognitoAuthContext } from "./CognitoAuthContext";
import { setAdmissionStorageOwner } from "../services/admission";
import { clearBrowserAuthStorage, markSignedOut } from "./signOutState";

const INACTIVITY_TIMEOUT_MS = 60_000;
const activityEvents = ["pointerdown", "pointermove", "keydown", "touchstart", "wheel", "scroll"];

export function CognitoAuthProvider({ children }) {
  const auth = useAuth();
  const inactivityTimerRef = useRef(null);
  const lastActivityRef = useRef(Date.now());
  const session = useMemo(() => {
    const profile = auth.user?.profile || null;
    return profile ? {
      accessToken: auth.user.access_token,
      idToken: auth.user.id_token,
      expiresAt: auth.user.expires_at ? auth.user.expires_at * 1000 : 0,
      user: {
        email: profile.email || profile["cognito:username"] || "",
        name: profile.name || profile.given_name || profile.email || "User",
        role: deriveRole(profile),
        claims: profile,
      },
    } : null;
  }, [auth.user]);

  useEffect(() => {
    setAdmissionStorageOwner(session?.user?.claims?.sub || session?.user?.email);
  }, [session]);

  const signOut = useCallback(async () => {
    try {
      await auth.removeUser();
    } catch {
      // Continue with the hosted logout even if the browser store is already
      // unavailable or has been cleared by another tab.
    }
    markSignedOut();
    clearBrowserAuthStorage();
    setAdmissionStorageOwner("");
    const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID || "2oii9hos09ek2r06iasb4otbgg";
    const logoutUri = import.meta.env.VITE_COGNITO_LOGOUT_URI || `${window.location.origin}/`;
    const cognitoDomain = import.meta.env.VITE_COGNITO_DOMAIN || "https://us-east-1pgsbc8uit.auth.us-east-1.amazoncognito.com";
    window.location.replace(`${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`);
  }, [auth]);

  useEffect(() => {
    if (!session) return undefined;

    let hasSignedOut = false;
    lastActivityRef.current = Date.now();

    const signOutForInactivity = () => {
      if (hasSignedOut) return;
      hasSignedOut = true;
      void signOut();
    };

    const scheduleInactivityCheck = () => {
      window.clearTimeout(inactivityTimerRef.current);
      const remainingTime = INACTIVITY_TIMEOUT_MS - (Date.now() - lastActivityRef.current);
      inactivityTimerRef.current = window.setTimeout(
        remainingTime <= 0 ? signOutForInactivity : scheduleInactivityCheck,
        Math.max(remainingTime, 0),
      );
    };

    const recordActivity = () => {
      lastActivityRef.current = Date.now();
      scheduleInactivityCheck();
    };

    const checkVisibility = () => {
      if (document.visibilityState === "visible") scheduleInactivityCheck();
    };

    activityEvents.forEach((eventName) => window.addEventListener(eventName, recordActivity, { passive: true }));
    document.addEventListener("visibilitychange", checkVisibility);
    scheduleInactivityCheck();

    return () => {
      window.clearTimeout(inactivityTimerRef.current);
      activityEvents.forEach((eventName) => window.removeEventListener(eventName, recordActivity));
      document.removeEventListener("visibilitychange", checkVisibility);
    };
  }, [session, signOut]);

  const value = useMemo(() => ({
    session,
    user: session?.user || null,
    isLoading: auth.isLoading,
    isConfigured: Boolean(auth.settings?.authority && auth.settings?.client_id),
    signIn: (returnTo = "") => auth.signinRedirect({ state: { returnTo } }),
    signOut,
    setSession: () => {},
  }), [auth, session, signOut]);

  return <CognitoAuthContext.Provider value={value}>{children}</CognitoAuthContext.Provider>;
}

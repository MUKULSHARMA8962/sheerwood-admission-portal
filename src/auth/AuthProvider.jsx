import { useMemo } from "react";
import { useAuth } from "react-oidc-context";
import { deriveRole } from "./cognito";
import { CognitoAuthContext } from "./CognitoAuthContext";

export function CognitoAuthProvider({ children }) {
  const auth = useAuth();
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

  const value = useMemo(() => ({
    session,
    user: session?.user || null,
    isLoading: auth.isLoading,
    isConfigured: Boolean(auth.settings?.authority && auth.settings?.client_id),
    signIn: (returnTo = "") => auth.signinRedirect({ state: { returnTo } }),
    signOut: async () => {
      await auth.removeUser();
      const clientId = import.meta.env.VITE_COGNITO_CLIENT_ID || "2oii9hos09ek2r06iasb4otbgg";
      const logoutUri = import.meta.env.VITE_COGNITO_LOGOUT_URI || `${window.location.origin}/`;
      const cognitoDomain = import.meta.env.VITE_COGNITO_DOMAIN || "https://us-east-1pgsbc8uit.auth.us-east-1.amazoncognito.com";
      window.location.assign(`${cognitoDomain}/logout?client_id=${clientId}&logout_uri=${encodeURIComponent(logoutUri)}`);
    },
    setSession: () => {},
  }), [auth, session]);

  return <CognitoAuthContext.Provider value={value}>{children}</CognitoAuthContext.Provider>;
}

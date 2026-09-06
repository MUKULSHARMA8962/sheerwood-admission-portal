import { useEffect, useMemo, useState } from "react";
import { getStoredCognitoSession, isCognitoConfigured, startCognitoSignIn, startCognitoSignOut } from "./cognito";
import { CognitoAuthContext } from "./CognitoAuthContext";

export function CognitoAuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    setSession(getStoredCognitoSession());
    setIsLoading(false);
  }, []);

  const value = useMemo(() => ({
    session,
    user: session?.user || null,
    isLoading,
    isConfigured: isCognitoConfigured(),
    signIn: startCognitoSignIn,
    signOut: startCognitoSignOut,
    setSession,
  }), [isLoading, session]);

  return <CognitoAuthContext.Provider value={value}>{children}</CognitoAuthContext.Provider>;
}

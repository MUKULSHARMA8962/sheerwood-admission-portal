import { useEffect, useRef, useState } from "react";
import { getCognitoConfigurationError } from "../auth/cognito";
import { useCognitoAuth } from "../auth/useCognitoAuth";
import { ROUTES } from "../constants/routes";
import "../auth/AuthCallback.css";

// The public site URL is the admissions entry point. Start the Hosted UI
// immediately instead of rendering the marketing home page or local login UI.
export default function DirectCognitoEntry() {
  const { session, isConfigured, isLoading, signIn } = useCognitoAuth();
  const hasStarted = useRef(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (session || isLoading || !isConfigured || hasStarted.current) return;
    hasStarted.current = true;
    signIn(ROUTES.admissionDetails).catch((reason) => {
      setError(reason.message || "Cognito sign-in could not be started.");
      hasStarted.current = false;
    });
  }, [isConfigured, isLoading, session, signIn]);

  if (!error && isConfigured) return null;

  return <main className="auth-callback-page"><section className="auth-callback-card"><p>SHERWOOD COLLEGE</p><h1>We could not start sign-in</h1><div className="auth-callback-status error" role="alert">{error || getCognitoConfigurationError()}</div></section></main>;
}

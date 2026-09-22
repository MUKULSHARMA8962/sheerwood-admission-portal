import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { getCognitoConfigurationError } from "../auth/cognito";
import { useCognitoAuth } from "../auth/useCognitoAuth";
import "../auth/AuthCallback.css";

export default function Login() {
  const location = useLocation();
  const { signIn, isConfigured } = useCognitoAuth();
  const params = new URLSearchParams(location.search);
  const returnTo = params.get("returnTo") || (params.get("flow") === "admission" ? "/admission-details" : "");
  const hasStartedSignIn = useRef(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!isConfigured || hasStartedSignIn.current) return;

    hasStartedSignIn.current = true;
    signIn(returnTo).catch((reason) => {
      setError(reason.message || "Cognito sign-in could not be started.");
      hasStartedSignIn.current = false;
    });
  }, [isConfigured, returnTo, signIn]);

  const message = error || (!isConfigured ? getCognitoConfigurationError() : "Opening secure Cognito sign-in…");

  return (
    <main className="auth-callback-page" aria-live="polite">
      <section className="auth-callback-card">
        <p>SHEERWOOD COLLEGE</p>
        <h1>{error || !isConfigured ? "We could not start sign-in" : "Redirecting securely…"}</h1>
        <div className={error || !isConfigured ? "auth-callback-status error" : "auth-callback-status"} role={error || !isConfigured ? "alert" : undefined}>{message}</div>
      </section>
    </main>
  );
}

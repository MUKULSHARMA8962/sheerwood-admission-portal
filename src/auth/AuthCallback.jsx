import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { completeCognitoSignIn, getDefaultRouteForRole } from "./cognito";
import { useCognitoAuth } from "./useCognitoAuth";
import "./AuthCallback.css";

export default function AuthCallback() {
  const location = useLocation();
  const navigate = useNavigate();
  const { setSession } = useCognitoAuth();
  const [error, setError] = useState("");
  const hasStarted = useRef(false);

  useEffect(() => {
    if (hasStarted.current) return undefined;
    hasStarted.current = true;
    let active = true;
    completeCognitoSignIn(location.search)
      .then(({ session, returnTo }) => {
        if (!active) return;
        setSession(session);
        navigate(returnTo || getDefaultRouteForRole(session.user.role), { replace: true });
      })
      .catch((reason) => {
        if (active) setError(reason.message || "Cognito sign-in could not be completed.");
      });
    return () => {
      active = false;
    };
  }, [location.search, navigate, setSession]);

  return <main className="auth-callback-page"><section className="auth-callback-card"><span className="auth-callback-crest">S</span><p>SHEERWOOD COLLEGE</p><h1>{error ? "We could not sign you in" : "Signing you in securely…"}</h1><div className={error ? "auth-callback-status error" : "auth-callback-status"}>{error || "Completing your Cognito sign-in. Please wait."}</div>{error && <button onClick={() => navigate("/login", { replace: true })}>Return to sign in</button>}</section></main>;
}

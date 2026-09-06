import { Navigate, useLocation } from "react-router-dom";
import { getCognitoConfigurationError } from "./cognito";
import { useCognitoAuth } from "./useCognitoAuth";
import "./AuthCallback.css";

export default function RequireCognitoAuth({ children, roles }) {
  const location = useLocation();
  const { session, isConfigured, isLoading } = useCognitoAuth();
  const returnTo = `${location.pathname}${location.search}`;

  if (isLoading) return <main className="auth-callback-page"><section className="auth-callback-card"><p>SHEERWOOD INTERNATIONAL SCHOOL</p><h1>Checking your secure session…</h1></section></main>;
  if (!isConfigured) return <Navigate to={`/login?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  if (!session) return <Navigate to={`/login?returnTo=${encodeURIComponent(returnTo)}`} replace />;
  if (roles && !roles.includes(session.user.role)) return <main className="auth-callback-page"><section className="auth-callback-card"><p>SHEERWOOD INTERNATIONAL SCHOOL</p><h1>This account does not have access</h1><div className="auth-callback-status error">Your Cognito role is {session.user.role || "not configured"}. Please use the correct school account.</div><button onClick={() => window.location.assign("/login")}>Return to sign in</button></section></main>;
  return children;
}

export function CognitoConfigurationMessage() {
  return <p className="auth-configuration-message" role="alert">{getCognitoConfigurationError()}</p>;
}

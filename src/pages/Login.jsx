import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { getCognitoConfigurationError } from "../auth/cognito";
import { useCognitoAuth } from "../auth/useCognitoAuth";
import "./Login.css";
import "./LoginDemo.css";
import "./LoginStudent.css";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, isConfigured } = useCognitoAuth();
  const admissionFlow = new URLSearchParams(location.search).get("flow") === "admission";
  const returnTo = new URLSearchParams(location.search).get("returnTo") || (admissionFlow ? "/new-user-dashboard" : "");
  const description = admissionFlow ? "Sign in or create an account securely to open the admission form." : "Use your school account to continue to the correct portal.";
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    try {
      await signIn(returnTo);
    } catch (reason) {
      setError(reason.message || "Cognito sign-in could not be started.");
    }
  }

  return (
    <main className="login-page">
      <button className="back" onClick={() => navigate("/")}>← Back to website</button>

      <section className="login-box">
        <aside className="login-side">
          <Link className="brand light" to="/"><span className="logo">S</span><span><strong>Sheerwood</strong><small>International School</small></span></Link>
          <div><span className="side-label">SHEERWOOD ADMISSIONS</span><h1>{admissionFlow ? "Your admission journey starts here." : "Welcome back to your admission journey."}</h1><p>{admissionFlow ? "A quick email verification keeps your admission application secure and easy to continue." : "Sign in to continue your application, upload documents and track its progress."}</p></div>
          <div className="secure">✓ Secure parent admission portal</div>
        </aside>

        <form className="login-form" onSubmit={submit}>
          <span className="label">{admissionFlow ? "PARENT ADMISSION" : "SHEERWOOD PORTALS"}</span><h2>{admissionFlow ? "Start your admission" : "Sign in securely"}</h2><p>{description}</p>
          {!isConfigured && <p className="auth-configuration-message" role="alert">{getCognitoConfigurationError()}</p>}
          {error && <p className="auth-configuration-message" role="alert">{error}</p>}
          <section className="demo-access"><div><span>SECURE COGNITO SIGN-IN</span><small>Roles are assigned from your Cognito account after sign-in.</small></div></section>
          <button className="signin" type="submit" disabled={!isConfigured}>Continue with Cognito →</button>
          {!admissionFlow && <><div className="or"><span>or</span></div><button className="track" type="button" onClick={() => navigate("/track-application")}>Track application without login</button><small className="new">New parent? <Link to="/register">Create an account in Cognito</Link><br />Already applied? Use your school account above.</small></>}
        </form>
      </section>
    </main>
  );
}

import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useCognitoAuth } from "../auth/useCognitoAuth";
import { getCognitoConfigurationError } from "../auth/cognito";
import campusImage from "../assets/sheerwood-campus-aerial-web.jpg";
import SchoolCrest from "../components/SchoolCrest";
import "./Register.css";

export default function Register() {
  const navigate = useNavigate();
  const { signIn, isConfigured } = useCognitoAuth();
  const [message, setMessage] = useState("");

  async function beginRegistration() {
    setMessage("");
    try {
      await signIn("/admission-details");
    } catch (reason) {
      setMessage(reason.message || "Cognito account setup could not be started.");
    }
  }

  return <main className="register-page">
    <button className="register-back" onClick={() => navigate("/")}>← Back to website</button>
    <section className="register-shell">
      <aside className="register-visual" style={{ backgroundImage: `linear-gradient(135deg, #032e20e6, #07512eac), url(${campusImage})` }}>
        <Link className="register-brand" to="/"><SchoolCrest /><div><strong>Sherwood</strong><small>College</small></div></Link>
        <div className="register-visual-copy"><p>PARENT ADMISSION PORTAL</p><h1>Every great journey begins with a first step.</h1><span>Create your parent account to start, save and track your child’s admission application.</span></div>
        <div className="register-benefits"><span>✓ Save your application progress</span><span>✓ Upload documents securely</span><span>✓ Track admissions in one place</span></div>
      </aside>

      <section className="register-form-wrap">
        <header><span className="register-label">PARENT REGISTRATION</span><h2>Create your account</h2><p>Already have an account? <Link to="/login">Sign in</Link></p></header>
        {message && <div className="register-message" role="alert">{message}<button onClick={() => setMessage("")} aria-label="Dismiss message">×</button></div>}
        {!isConfigured && <div className="register-message" role="alert">{getCognitoConfigurationError()}</div>}
        <section className="register-form" aria-label="Cognito account setup">
          <label>Account setup is managed securely by Cognito.</label>
          <p>Your hosted sign-in page can offer account creation, password recovery, email verification and any configured MFA options.</p>
          <button className="register-submit" type="button" disabled={!isConfigured} onClick={beginRegistration}>Continue to Cognito →</button>
          <small>Your information is protected and used only for the admissions process.</small>
        </section>
      </section>
    </section>
  </main>;
}

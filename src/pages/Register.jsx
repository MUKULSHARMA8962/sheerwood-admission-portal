import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import campusImage from "../assets/sheerwood-campus-aerial-web.jpg";
import "./Register.css";

export default function Register() {
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [form, setForm] = useState({ firstName: "", lastName: "", email: "", phone: "", password: "", confirmPassword: "", consent: false });
  const [message, setMessage] = useState("");

  function update(event) {
    const { name, value, checked, type } = event.target;
    setForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  }

  function submit(event) {
    event.preventDefault();
    if (form.password.length < 8) {
      setMessage("Please use a password with at least 8 characters.");
      return;
    }
    if (form.password !== form.confirmPassword) {
      setMessage("Your passwords do not match. Please try again.");
      return;
    }
    if (!form.consent) {
      setMessage("Please accept the terms to create your account.");
      return;
    }
    setMessage("Account created successfully. You can now continue to your parent dashboard.");
  }

  return <main className="register-page">
    <button className="register-back" onClick={() => navigate("/")}>← Back to website</button>
    <section className="register-shell">
      <aside className="register-visual" style={{ backgroundImage: `linear-gradient(135deg, #032e20e6, #07512eac), url(${campusImage})` }}>
        <Link className="register-brand" to="/"><span>S</span><div><strong>Sheerwood</strong><small>International School</small></div></Link>
        <div className="register-visual-copy"><p>PARENT ADMISSION PORTAL</p><h1>Every great journey begins with a first step.</h1><span>Create your parent account to start, save and track your child’s admission application.</span></div>
        <div className="register-benefits"><span>✓ Save your application progress</span><span>✓ Upload documents securely</span><span>✓ Track admissions in one place</span></div>
      </aside>

      <section className="register-form-wrap">
        <header><span className="register-label">PARENT REGISTRATION</span><h2>Create your account</h2><p>Already have an account? <Link to="/login">Sign in</Link></p></header>
        {message && <div className={message.startsWith("Account") ? "register-message success" : "register-message"} role="status">{message}<button onClick={() => setMessage("")} aria-label="Dismiss message">×</button></div>}
        {message.startsWith("Account") ? <button className="register-dashboard" onClick={() => navigate("/dashboard", { state: { email: form.email } })}>Go to Parent Dashboard →</button> : <form className="register-form" onSubmit={submit}>
          <div className="register-name-fields"><label>First name<input name="firstName" value={form.firstName} onChange={update} placeholder="Rajesh" required /></label><label>Last name<input name="lastName" value={form.lastName} onChange={update} placeholder="Sharma" required /></label></div>
          <label>Email address<input name="email" type="email" value={form.email} onChange={update} placeholder="parent@example.com" required /></label>
          <label>Mobile number<input name="phone" type="tel" value={form.phone} onChange={update} placeholder="98765 43210" pattern="[0-9 +()-]{8,}" required /></label>
          <label>Create password<div className="register-password"><input name="password" type={showPassword ? "text" : "password"} value={form.password} onChange={update} placeholder="Minimum 8 characters" minLength="8" required /><button type="button" onClick={() => setShowPassword((current) => !current)}>{showPassword ? "Hide" : "Show"}</button></div></label>
          <label>Confirm password<input name="confirmPassword" type={showPassword ? "text" : "password"} value={form.confirmPassword} onChange={update} placeholder="Re-enter password" required /></label>
          <label className="register-consent"><input name="consent" type="checkbox" checked={form.consent} onChange={update} /><span>I agree to the <a href="#terms">Terms of Use</a> and <a href="#privacy">Privacy Policy</a>.</span></label>
          <button className="register-submit" type="submit">Create Parent Account →</button>
          <small>Your information is protected and used only for the admissions process.</small>
        </form>}
      </section>
    </section>
  </main>;
}

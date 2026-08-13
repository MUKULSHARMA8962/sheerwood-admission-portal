import { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import "./Login.css";
import "./LoginDemo.css";
import "./LoginStudent.css";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const admissionFlow = new URLSearchParams(location.search).get("flow") === "admission";
  const [showPassword, setShowPassword] = useState(false);
  const [authMethod, setAuthMethod] = useState(admissionFlow ? "otp" : "password");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpMessage, setOtpMessage] = useState("");
  const [form, setForm] = useState({ email: "", phone: "", password: "", remember: false, role: "parent" });
  const roleDetails = {
    parent: { label: "PARENT PORTAL", title: "Sign in", text: "Continue your admission application and track its progress.", route: "/dashboard" },
    student: { label: "STUDENT PORTAL", title: "Student sign in", text: "View attendance, homework, results, study material and your class schedule.", route: "/student/dashboard" },
    teacher: { label: "TEACHER PORTAL", title: "Teacher sign in", text: "Manage classes, attendance and student learning updates.", route: "/teacher/dashboard" },
    admin: { label: "ADMIN PORTAL", title: "Admin sign in", text: "Manage applications, students and admissions operations.", route: "/admin/dashboard" },
  };
  const selectedRole = roleDetails[form.role];
  const demoAccounts = {
    parent: { email: "rajesh.sharma@demo.edu", password: "Parent@123" },
    student: { email: "rahul.kumar@demo.edu", password: "Student@123" },
    teacher: { email: "meera.kapoor@demo.edu", password: "Teacher@123" },
    admin: { email: "admin@demo.edu", password: "Admin@123" },
  };

  function update(event) {
    const { name, value, checked, type } = event.target;
    setForm((current) => ({ ...current, [name]: type === "checkbox" ? checked : value }));
  }

  function selectRole(role) {
    setForm((current) => ({ ...current, role }));
    setOtpSent(false);
    setOtp("");
    setOtpMessage("");
    if (role !== "parent") setAuthMethod("password");
  }

  function selectAuthMethod(method) {
    setAuthMethod(method);
    setOtpSent(false);
    setOtp("");
    setOtpMessage("");
  }

  function submit(event) {
    event.preventDefault();

    if (form.role === "parent" && authMethod === "otp") {
      if (!otpSent) {
        if (form.phone.replace(/\D/g, "").length < 10) {
          setOtpMessage("Please enter a valid 10-digit mobile number.");
          return;
        }
        setOtpSent(true);
        setOtpMessage("OTP sent to your mobile number. Demo code: 123456");
        return;
      }
      if (otp !== "123456") {
        setOtpMessage("Enter the 6-digit OTP to continue. Demo code: 123456");
        return;
      }
      navigate(admissionFlow ? "/new-user-dashboard" : "/dashboard", { state: { phone: form.phone, role: "parent" } });
      return;
    }

    navigate(selectedRole.route, { state: { email: form.email, role: form.role } });
  }

  function demoLogin() {
    const account = demoAccounts[form.role];
    setForm((current) => ({ ...current, ...account }));
    navigate(selectedRole.route, { state: { email: account.email, role: form.role } });
  }

  const isOtpLogin = form.role === "parent" && authMethod === "otp";
  const title = admissionFlow ? "Start your admission" : selectedRole.title;
  const description = admissionFlow ? "Verify your mobile number with an OTP to open the admission form." : selectedRole.text;

  return (
    <main className="login-page">
      <button className="back" onClick={() => navigate("/")}>← Back to website</button>

      <section className="login-box">
        <aside className="login-side">
          <Link className="brand light" to="/"><span className="logo">S</span><span><strong>Sheerwood</strong><small>International School</small></span></Link>
          <div><span className="side-label">SHEERWOOD ADMISSIONS</span><h1>{admissionFlow ? "Your admission journey starts here." : "Welcome back to your admission journey."}</h1><p>{admissionFlow ? "A quick mobile verification keeps your admission application secure and easy to continue." : "Sign in to continue your application, upload documents and track its progress."}</p></div>
          <div className="secure">✓ Secure parent admission portal</div>
        </aside>

        <form className="login-form" onSubmit={submit}>
          <span className="label">{admissionFlow ? "PARENT ADMISSION" : selectedRole.label}</span><h2>{title}</h2><p>{description}</p>

          {!admissionFlow && <fieldset className="role-selector"><legend>Sign in as</legend><div>{[["parent", "Parent"], ["student", "Student"], ["teacher", "Teacher"], ["admin", "Admin"]].map(([value, label]) => <label className={form.role === value ? "selected" : ""} key={value}><input name="role" type="radio" value={value} checked={form.role === value} onChange={() => selectRole(value)} /><span>{label}</span></label>)}</div></fieldset>}

          {form.role === "parent" && <div className="login-methods" aria-label="Sign-in method"><button className={authMethod === "otp" ? "selected" : ""} type="button" onClick={() => selectAuthMethod("otp")}>OTP sign in</button><button className={authMethod === "password" ? "selected" : ""} type="button" onClick={() => selectAuthMethod("password")}>Password</button></div>}

          {!isOtpLogin && <section className="demo-access"><div><span>DEMO ACCESS</span><small>{demoAccounts[form.role].email} · {demoAccounts[form.role].password}</small></div><button type="button" onClick={demoLogin}>Open {form.role} dashboard →</button></section>}

          {isOtpLogin ? <>
            <label>Mobile number<input name="phone" type="tel" value={form.phone} onChange={update} placeholder="98765 43210" inputMode="numeric" pattern="[0-9 +()-]{8,}" required /></label>
            {otpSent && <label>Enter OTP<input className="otp-input" name="otp" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="• • • • • •" inputMode="numeric" autoComplete="one-time-code" maxLength="6" required /></label>}
            {otpMessage && <p className={otpSent && otpMessage.startsWith("OTP sent") ? "otp-message success" : "otp-message"} role="status">{otpMessage}</p>}
            <button className="signin" type="submit">{otpSent ? (admissionFlow ? "Verify & Start Admission →" : "Verify & Sign In →") : "Send OTP →"}</button>
            {otpSent && <button className="otp-resend" type="button" onClick={() => setOtpMessage("A new OTP has been sent. Demo code: 123456")}>Resend OTP</button>}
          </> : <>
            <label>Email address<input name="email" type="email" value={form.email} onChange={update} placeholder="parent@example.com" required /></label>
            <label>Password<div className="password"><input name="password" type={showPassword ? "text" : "password"} value={form.password} onChange={update} placeholder="Enter your password" required /><button type="button" onClick={() => setShowPassword(!showPassword)}>{showPassword ? "Hide" : "Show"}</button></div></label>
            <div className="options"><label><input name="remember" type="checkbox" checked={form.remember} onChange={update} /> Remember me</label><a href="#forgot">Forgot password?</a></div>
            <button className="signin" type="submit">Sign In →</button>
          </>}

          {!admissionFlow && <><div className="or"><span>or</span></div>{form.role === "parent" && <><button className="track" type="button" onClick={() => navigate("/track-application")}>Track application without login</button><small className="new">New parent? <Link to="/register">Create an account</Link><br />or <Link to="/login?flow=admission">start a new admission with OTP</Link></small></>}</>}
        </form>
      </section>
    </main>
  );
}

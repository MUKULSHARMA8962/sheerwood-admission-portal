import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import SchoolCrest from "../../components/SchoolCrest";
import "./Track_Application.css";

export default function TrackApplication() {
  const navigate = useNavigate();
  const [applicationNumber, setApplicationNumber] = useState("");
  const [submittedNumber, setSubmittedNumber] = useState("");
  const [message, setMessage] = useState("");

  function continueTracking(event) {
    event.preventDefault();
    const number = applicationNumber.trim().toUpperCase();
    if (number.length < 5) {
      setMessage("Please enter your application number.");
      return;
    }
    setMessage("");
    setSubmittedNumber(number);
  }

  return <main className="track-page">
    <header className="track-header"><Link className="track-brand" to="/"><SchoolCrest /><div><strong>Sheerwood</strong><small>International School</small></div></Link><button onClick={() => navigate("/login")}>Sign in</button></header>
    <section className="track-shell">
      <div className="track-heading"><p>APPLICATION STATUS</p><h1>Track Application</h1><small>Enter the application number from your admission form.</small></div>
      <form className="track-form" onSubmit={continueTracking} noValidate><label htmlFor="application-number">Application Number</label><div><input id="application-number" value={applicationNumber} onChange={(event) => { setApplicationNumber(event.target.value); setSubmittedNumber(""); setMessage(""); }} placeholder="AIS/2027-28/000124" autoCapitalize="characters" autoComplete="off" autoFocus /><button type="submit">Continue →</button></div>{message && <p role="alert">{message}</p>}</form>
      {submittedNumber && <section className="track-result" aria-live="polite"><p>APPLICATION NUMBER</p><strong>{submittedNumber}</strong><h2>Sign in to see your application</h2><small>Sign in with the same parent account to view the live status, documents, and approval updates for this application.</small><button onClick={() => navigate("/login?flow=admission&returnTo=/new-user-dashboard")}>Sign in securely →</button></section>}
    </section>
  </main>;
}
